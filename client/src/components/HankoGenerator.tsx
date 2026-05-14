import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

type HankoStyle = "round" | "data" | "square";

interface HankoGeneratorProps {
  defaultName?: string;
  onComplete: (dataUrl: string) => void;
  onCancel: () => void;
}

const HANKO_STYLES: HankoStyle[] = ["round", "data", "square"];

const HANKO_COLORS = [
  { id: "red", labelKey: "red", color: "#C41E3A", bg: "#C41E3A" },
  { id: "vermillion", labelKey: "vermillion", color: "#E34234", bg: "#E34234" },
  { id: "dark", labelKey: "dark", color: "#8B0000", bg: "#8B0000" },
  { id: "blue", labelKey: "blue", color: "#1B4D89", bg: "#1B4D89" },
];

function drawRoundHanko(
  ctx: CanvasRenderingContext2D,
  name: string,
  color: string,
  size: number
) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4;

  ctx.clearRect(0, 0, size, size);

  // Outer circle
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner circle (thin)
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
  ctx.stroke();

  // Name text (vertical if 2+ chars)
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const chars = name.slice(0, 4); // Max 4 chars
  if (chars.length === 1) {
    ctx.font = `bold ${size * 0.45}px "Noto Serif JP", serif`;
    ctx.fillText(chars, cx, cy);
  } else if (chars.length === 2) {
    const fontSize = size * 0.35;
    ctx.font = `bold ${fontSize}px "Noto Serif JP", serif`;
    ctx.fillText(chars[0], cx, cy - fontSize * 0.55);
    ctx.fillText(chars[1], cx, cy + fontSize * 0.55);
  } else if (chars.length === 3) {
    const fontSize = size * 0.28;
    ctx.font = `bold ${fontSize}px "Noto Serif JP", serif`;
    ctx.fillText(chars[0], cx, cy - fontSize * 0.9);
    ctx.fillText(chars[1], cx, cy);
    ctx.fillText(chars[2], cx, cy + fontSize * 0.9);
  } else {
    const fontSize = size * 0.24;
    ctx.font = `bold ${fontSize}px "Noto Serif JP", serif`;
    chars.split("").forEach((ch, i) => {
      ctx.fillText(ch, cx, cy - fontSize * 1.2 + i * fontSize * 0.8);
    });
  }
}

function drawDataHanko(
  ctx: CanvasRenderingContext2D,
  name: string,
  color: string,
  size: number,
  dateStr: string,
  topLabel: string = "APPROVED"
) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4;

  ctx.clearRect(0, 0, size, size);

  // Outer circle
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Horizontal dividing lines (3 sections)
  const sectionHeight = (radius * 2) / 3;
  const topY = cy - radius;

  // Top line
  const lineY1 = topY + sectionHeight;
  const halfWidth1 = Math.sqrt(radius * radius - (lineY1 - cy) * (lineY1 - cy));
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth1, lineY1);
  ctx.lineTo(cx + halfWidth1, lineY1);
  ctx.stroke();

  // Bottom line
  const lineY2 = topY + sectionHeight * 2;
  const halfWidth2 = Math.sqrt(radius * radius - (lineY2 - cy) * (lineY2 - cy));
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth2, lineY2);
  ctx.lineTo(cx + halfWidth2, lineY2);
  ctx.stroke();

  // Top section label
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size * 0.14}px "Noto Serif JP", serif`;
  ctx.fillText(topLabel, cx, topY + sectionHeight / 2);

  // Middle section: date
  ctx.font = `${size * 0.1}px "Noto Serif JP", serif`;
  ctx.fillText(dateStr, cx, lineY1 + sectionHeight / 2);

  // Bottom section: name
  ctx.font = `bold ${size * 0.16}px "Noto Serif JP", serif`;
  const displayName = name.length > 4 ? name.slice(0, 4) : name;
  ctx.fillText(displayName, cx, lineY2 + sectionHeight / 2);
}

function drawSquareHanko(
  ctx: CanvasRenderingContext2D,
  name: string,
  color: string,
  size: number
) {
  const padding = 6;
  const innerSize = size - padding * 2;

  ctx.clearRect(0, 0, size, size);

  // Outer square
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(padding, padding, innerSize, innerSize);

  // Inner square
  ctx.lineWidth = 1;
  ctx.strokeRect(padding + 4, padding + 4, innerSize - 8, innerSize - 8);

  // Name text
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const chars = name.slice(0, 4);
  if (chars.length <= 2) {
    const fontSize = size * 0.35;
    ctx.font = `bold ${fontSize}px "Noto Serif JP", serif`;
    if (chars.length === 1) {
      ctx.fillText(chars, size / 2, size / 2);
    } else {
      ctx.fillText(chars[0], size / 2, size / 2 - fontSize * 0.45);
      ctx.fillText(chars[1], size / 2, size / 2 + fontSize * 0.45);
    }
  } else {
    const fontSize = size * 0.25;
    ctx.font = `bold ${fontSize}px "Noto Serif JP", serif`;
    // 2x2 grid layout
    if (chars.length === 3) {
      ctx.fillText(chars[0], size / 2, size / 2 - fontSize * 0.7);
      ctx.fillText(chars[1], size / 2 - fontSize * 0.4, size / 2 + fontSize * 0.5);
      ctx.fillText(chars[2], size / 2 + fontSize * 0.4, size / 2 + fontSize * 0.5);
    } else {
      ctx.fillText(chars[0], size / 2 - fontSize * 0.4, size / 2 - fontSize * 0.5);
      ctx.fillText(chars[1], size / 2 + fontSize * 0.4, size / 2 - fontSize * 0.5);
      ctx.fillText(chars[2], size / 2 - fontSize * 0.4, size / 2 + fontSize * 0.5);
      ctx.fillText(chars[3], size / 2 + fontSize * 0.4, size / 2 + fontSize * 0.5);
    }
  }
}

export default function HankoGenerator({ defaultName = "", onComplete, onCancel }: HankoGeneratorProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState(defaultName);
  const [style, setStyle] = useState<HankoStyle>("round");
  const [colorId, setColorId] = useState("red");
  const [topLabelIndex, setTopLabelIndex] = useState(0);
  const [fontLoaded, setFontLoaded] = useState(false);
  const topLabelOptions = [
    t("hankoGenerator.topLabels.approved"),
    t("hankoGenerator.topLabels.confirmed"),
    t("hankoGenerator.topLabels.checked"),
    t("hankoGenerator.topLabels.done"),
    t("hankoGenerator.topLabels.received"),
  ];

  const selectedColor = HANKO_COLORS.find(c => c.id === colorId)?.color || "#C41E3A";
  const canvasSize = 200;

  // Load Noto Serif JP font
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    // Wait for font to load
    const checkFont = () => {
      if (document.fonts.check('bold 20px "Noto Serif JP"')) {
        setFontLoaded(true);
      } else {
        setTimeout(checkFont, 100);
      }
    };
    setTimeout(checkFont, 200);

    return () => { document.head.removeChild(link); };
  }, []);

  // Draw hanko
  const drawHanko = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !name.trim()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvasSize * 2;
    canvas.height = canvasSize * 2;
    ctx.scale(2, 2);

    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

    switch (style) {
      case "round":
        drawRoundHanko(ctx, name.trim(), selectedColor, canvasSize);
        break;
      case "data":
        drawDataHanko(ctx, name.trim(), selectedColor, canvasSize, dateStr, topLabelOptions[topLabelIndex] ?? "");
        break;
      case "square":
        drawSquareHanko(ctx, name.trim(), selectedColor, canvasSize);
        break;
    }
  }, [name, style, selectedColor, topLabelOptions, topLabelIndex, fontLoaded]);

  useEffect(() => {
    drawHanko();
  }, [drawHanko]);

  const handleComplete = () => {
    const canvas = canvasRef.current;
    if (!canvas || !name.trim()) return;
    const dataUrl = canvas.toDataURL("image/png");
    onComplete(dataUrl);
  };
  const getStyleLabel = (styleId: HankoStyle) => t(`hankoGenerator.styles.${styleId}.label`);
  const getStyleDescription = (styleId: HankoStyle) => t(`hankoGenerator.styles.${styleId}.description`);

  return (
    <div className="bg-white rounded-xl border shadow-lg p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
      <h3 className="text-lg font-bold mb-4">{t("hankoGenerator.title")}</h3>

      {/* Name input */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t("hankoGenerator.nameLabel")}</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("hankoGenerator.namePlaceholder")}
          className="text-lg"
          maxLength={4}
        />
      </div>

      {/* Style selection */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 mb-2 block">{t("hankoGenerator.styleLabel")}</label>
        <div className="grid grid-cols-3 gap-2">
          {HANKO_STYLES.map(s => (
            <button
              key={s}
              className={`p-2 border-2 rounded-lg text-center transition-all ${
                style === s
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => setStyle(s)}
            >
              <span className="text-sm font-medium block">{getStyleLabel(s)}</span>
              <span className="text-xs text-gray-500">{getStyleDescription(s)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Data stamp label (only for data style) */}
      {style === "data" && (
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">{t("hankoGenerator.topLabel")}</label>
          <div className="flex flex-wrap gap-2">
            {topLabelOptions.map((label, index) => (
              <button
                key={label}
                className={`px-3 py-1 rounded-full text-sm border transition-all ${
                  topLabelIndex === index
                    ? "border-emerald-600 bg-emerald-50 text-emerald-600"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setTopLabelIndex(index)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color selection */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 mb-2 block">{t("hankoGenerator.colorLabel")}</label>
        <div className="flex gap-3">
          {HANKO_COLORS.map(c => (
            <button
              key={c.id}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                colorId === c.id ? "ring-2 ring-offset-2 ring-[#059669]" : ""
              }`}
              style={{ backgroundColor: c.bg }}
              onClick={() => setColorId(c.id)}
              title={t(`hankoGenerator.colors.${c.labelKey}`)}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="mb-4 flex justify-center">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
          <canvas
            ref={canvasRef}
            style={{ width: canvasSize, height: canvasSize }}
            className="block"
          />
          {!name.trim() && (
            <p className="text-center text-sm text-gray-400 mt-2">{t("hankoGenerator.enterNameHint")}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t">
        <Button variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button
          onClick={handleComplete}
          disabled={!name.trim()}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {t("hankoGenerator.useStamp")}
        </Button>
      </div>
    </div>
  );
}
