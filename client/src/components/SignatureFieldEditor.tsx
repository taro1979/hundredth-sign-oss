import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, PenLine, Calendar, User, Type } from "lucide-react";
import { nanoid } from "nanoid";
import { useTranslation } from "react-i18next";

export type SignatureFieldType = "signature" | "date" | "name" | "initials";

/**
 * All position/size values are percentages (0-100) relative to the PDF page dimensions.
 * This ensures coordinates are zoom-independent and can be stored/restored reliably.
 */
export interface SignatureField {
  id: string;
  page: number;
  /** X position as percentage of page width (0-100) */
  x: number;
  /** Y position as percentage of page height (0-100) */
  y: number;
  /** Width as percentage of page width */
  width: number;
  /** Height as percentage of page height */
  height: number;
  signerIndex: number;
  type: SignatureFieldType;
  required?: boolean;
  label?: string;
}

const SIGNER_COLORS = [
  "#059669", "#dc2626", "#16a34a", "#ea580c", "#7c3aed", "#0891b2",
  "#be185d", "#854d0e", "#1d4ed8", "#4f46e5",
];

const FIELD_TYPE_ICONS: Record<SignatureFieldType, React.ReactNode> = {
  signature: <PenLine className="h-3 w-3" />,
  date: <Calendar className="h-3 w-3" />,
  name: <User className="h-3 w-3" />,
  initials: <Type className="h-3 w-3" />,
};
const FIELD_TYPES: SignatureFieldType[] = ["signature", "date", "name", "initials"];

/**
 * Default sizes as percentage of page dimensions.
 * For A4 (ratio ~1:1.414), these produce visually balanced fields:
 * - signature: 20% width × 4.2% height ≈ 119px × 35px at 1x scale
 * - date/name: 15-18% width × 3% height ≈ compact text fields
 * - initials: 8% width × 4% height ≈ small square-ish
 *
 * The height values are intentionally kept proportional to width
 * considering the A4 aspect ratio (height = 1.414 × width).
 */
const DEFAULT_FIELD_SIZES: Record<SignatureFieldType, { width: number; height: number }> = {
  signature: { width: 20, height: 4.2 },
  date: { width: 15, height: 3 },
  name: { width: 18, height: 3 },
  initials: { width: 8, height: 4 },
};

// ==================== Toolbar (separate from overlay) ====================

interface ToolbarProps {
  selectedFieldType: SignatureFieldType;
  onFieldTypeChange: (type: SignatureFieldType) => void;
  selectedSigner: number;
  onSignerChange: (index: number) => void;
  signerCount: number;
  signerNames?: string[];
}

export function SignatureFieldToolbar({
  selectedFieldType,
  onFieldTypeChange,
  selectedSigner,
  onSignerChange,
  signerCount,
  signerNames = [],
}: ToolbarProps) {
  const { t } = useTranslation();
  const getFieldTypeLabel = (type: SignatureFieldType) => t(`signing.fieldType.${type}`);

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{t("documents.create.fieldLabel")}:</span>
        <div className="flex gap-1">
          {FIELD_TYPES.map(type => (
            <Button
              key={type}
              variant={selectedFieldType === type ? "default" : "outline"}
              size="sm"
              onClick={() => onFieldTypeChange(type)}
              className={`gap-1 ${selectedFieldType === type ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
            >
              {FIELD_TYPE_ICONS[type]}
              {getFieldTypeLabel(type)}
            </Button>
          ))}
        </div>
      </div>

      {signerCount > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{t("documents.create.signerLabel")}:</span>
          <Select value={String(selectedSigner)} onValueChange={(v) => onSignerChange(Number(v))}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: signerCount }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SIGNER_COLORS[i % SIGNER_COLORS.length] }} />
                    {signerNames[i] || t("documents.create.signerIndex", { count: i + 1 })}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ==================== Page Overlay (rendered inside each PDF page) ====================

interface PageOverlayProps {
  /** 0-based page index */
  pageIndex: number;
  fields: SignatureField[];
  onFieldsChange: (fields: SignatureField[]) => void;
  selectedFieldType: SignatureFieldType;
  selectedSigner: number;
  signerNames?: string[];
}

/**
 * This component is rendered as a child of each PDF page's overlay div.
 * It fills the entire page area (100% x 100%) and handles click-to-add and drag-to-move.
 * All coordinates are in percentages relative to this div.
 */
export function SignatureFieldPageOverlay({
  pageIndex,
  fields,
  onFieldsChange,
  selectedFieldType,
  selectedSigner,
  signerNames = [],
}: PageOverlayProps) {
  const { t } = useTranslation();
  const getFieldTypeLabel = (type: SignatureFieldType) => t(`signing.fieldType.${type}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const currentPageFields = fields.filter(f => f.page === pageIndex);

  // Click to add field
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingField) return;
    // Don't add if clicking on existing field
    if ((e.target as HTMLElement).closest("[data-field-id]")) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const size = DEFAULT_FIELD_SIZES[selectedFieldType];

    const newField: SignatureField = {
      id: nanoid(10),
      page: pageIndex,
      x: Math.max(0, Math.min(100 - size.width, xPct - size.width / 2)),
      y: Math.max(0, Math.min(100 - size.height, yPct - size.height / 2)),
      width: size.width,
      height: size.height,
      signerIndex: selectedSigner,
      type: selectedFieldType,
      required: true,
      label: `${getFieldTypeLabel(selectedFieldType)} (${signerNames[selectedSigner] || t("documents.create.signerIndex", { count: selectedSigner + 1 })})`,
    };
    onFieldsChange([...fields, newField]);
  }, [fields, onFieldsChange, selectedFieldType, selectedSigner, pageIndex, signerNames, draggingField]);

  const removeField = (fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onFieldsChange(fields.filter(f => f.id !== fieldId));
  };

  // Drag start
  const handleMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const field = fields.find(f => f.id === fieldId);
    if (!field || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const fieldLeftPx = (field.x / 100) * rect.width;
    const fieldTopPx = (field.y / 100) * rect.height;
    dragOffsetRef.current = {
      x: e.clientX - rect.left - fieldLeftPx,
      y: e.clientY - rect.top - fieldTopPx,
    };
    setDraggingField(fieldId);
  }, [fields]);

  // Drag move/end via window events
  useEffect(() => {
    if (!draggingField) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const field = fields.find(f => f.id === draggingField);
      if (!field) return;

      const newLeftPx = e.clientX - rect.left - dragOffsetRef.current.x;
      const newTopPx = e.clientY - rect.top - dragOffsetRef.current.y;
      const newX = Math.max(0, Math.min(100 - field.width, (newLeftPx / rect.width) * 100));
      const newY = Math.max(0, Math.min(100 - field.height, (newTopPx / rect.height) * 100));

      onFieldsChange(fields.map(f =>
        f.id === draggingField ? { ...f, x: newX, y: newY } : f
      ));
    };

    const handleMouseUp = () => {
      setDraggingField(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingField, fields, onFieldsChange]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-crosshair"
      onClick={handleClick}
    >
      {currentPageFields.map(field => {
        const color = SIGNER_COLORS[field.signerIndex % SIGNER_COLORS.length];
        return (
          <div
            key={field.id}
            data-field-id={field.id}
            className={`absolute border-2 rounded group select-none ${
              draggingField === field.id ? "cursor-grabbing z-50 ring-2 ring-blue-400" : "cursor-grab"
            }`}
            style={{
              left: `${field.x}%`,
              top: `${field.y}%`,
              width: `${field.width}%`,
              height: `${field.height}%`,
              borderColor: color,
              backgroundColor: `${color}20`,
            }}
            onMouseDown={(e) => handleMouseDown(e, field.id)}
          >
            {/* Label badge above the field */}
            <div className="absolute -top-5 left-0 flex items-center gap-1 whitespace-nowrap pointer-events-none">
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 h-4"
                style={{ backgroundColor: color, color: "white" }}
              >
                {FIELD_TYPE_ICONS[field.type]}
                <span className="ml-1">{signerNames[field.signerIndex] || t("documents.create.signerIndex", { count: field.signerIndex + 1 })}</span>
              </Badge>
            </div>
            {/* Delete button */}
            <button
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={(e) => removeField(field.id, e)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
            {/* Field type label inside */}
            <div className="flex items-center justify-center h-full text-xs pointer-events-none" style={{ color }}>
              {FIELD_TYPE_ICONS[field.type]}
              <span className="ml-1">{getFieldTypeLabel(field.type)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== Legacy default export (kept for backward compat) ====================
// Not used anymore - use SignatureFieldToolbar + SignatureFieldPageOverlay instead
export default function SignatureFieldEditor() {
  return null;
}
