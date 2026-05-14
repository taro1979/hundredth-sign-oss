import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eraser, PenLine, Type, Stamp } from "lucide-react";
import { SIGNATURE_FONT_OPTIONS, type SignatureFontId } from "@shared/validation";
import HankoGenerator from "./HankoGenerator";
import { useTranslation } from "react-i18next";

interface SignaturePadProps {
  signerName: string;
  onSignatureComplete: (data: {
    signatureDataUrl?: string;
    signatureFont?: SignatureFontId;
    signerName: string;
  }) => void;
  onCancel: () => void;
}

export default function SignaturePad({ signerName, onSignatureComplete, onCancel }: SignaturePadProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [mode, setMode] = useState<"draw" | "type" | "hanko">("type");
  const [selectedFont, setSelectedFont] = useState<SignatureFontId>("dancing-script");
  const [typedName, setTypedName] = useState(signerName);

  // Load Google Fonts
  useEffect(() => {
    const fontFamilies = SIGNATURE_FONT_OPTIONS.map(f => f.googleFont).join("&family=");
    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const renderTypedSignatureToPng = async (text: string, fontId: SignatureFontId) => {
    const fontOption = SIGNATURE_FONT_OPTIONS.find(f => f.id === fontId);
    const fontFamily = fontOption?.cssFamily ?? "serif";
    const baseFontSize = 64;
    const paddingX = 20;
    const maxWidth = 1000;
    const pixelRatio = Math.max(2, Math.ceil(window.devicePixelRatio || 1));

    try {
      if (document.fonts?.load) {
        await document.fonts.load(`${baseFontSize}px ${fontFamily}`);
      }
    } catch {
      // Font load failure shouldn't block signature creation.
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    ctx.font = `${baseFontSize}px ${fontFamily}`;
    let textWidth = ctx.measureText(text).width;
    let fontSize = baseFontSize;
    let width = textWidth + paddingX * 2;

    if (width > maxWidth) {
      const scale = maxWidth / width;
      fontSize = Math.max(32, Math.floor(baseFontSize * scale));
      ctx.font = `${fontSize}px ${fontFamily}`;
      textWidth = ctx.measureText(text).width;
      width = Math.min(maxWidth, textWidth + paddingX * 2);
    }

    const height = Math.ceil(fontSize * 1.6);
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);

    ctx.scale(pixelRatio, pixelRatio);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a2e";
    ctx.fillText(text, paddingX, height / 2);

    return canvas.toDataURL("image/png");
  };

  const handleComplete = async () => {
    if (mode === "draw") {
      if (!hasDrawn) return;
      const dataUrl = canvasRef.current?.toDataURL("image/png");
      onSignatureComplete({
        signatureDataUrl: dataUrl,
        signerName: typedName || signerName,
      });
    } else {
      if (!typedName.trim()) return;
      const trimmedName = typedName.trim();
      const signatureDataUrl = await renderTypedSignatureToPng(trimmedName, selectedFont);
      onSignatureComplete({
        signatureFont: selectedFont,
        signatureDataUrl,
        signerName: trimmedName,
      });
    }
  };

  const handleHankoComplete = (dataUrl: string) => {
    onSignatureComplete({
      signatureDataUrl: dataUrl,
      signerName: typedName || signerName,
    });
  };

  const currentFontOption = SIGNATURE_FONT_OPTIONS.find(f => f.id === selectedFont);

  // Extract last name for hanko default
  const defaultHankoName = (() => {
    const name = signerName.trim();
    // If it looks like Japanese name (contains kanji/kana), take first part
    if (/[\u3000-\u9fff]/.test(name)) {
      const parts = name.split(/[\s\u3000]+/);
      return parts[0] || name;
    }
    return name;
  })();

  return (
    <div className="bg-white rounded-xl border shadow-lg p-4 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <h3 className="text-lg font-bold mb-4">{t("signaturePad.title")}</h3>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "draw" | "type" | "hanko")}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="type" className="gap-1 text-xs sm:text-sm">
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">{t("signing.typeSignature")}</span>
            <span className="sm:hidden">{t("signing.typeSignature")}</span>
          </TabsTrigger>
          <TabsTrigger value="draw" className="gap-1 text-xs sm:text-sm">
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">{t("signing.drawSignature")}</span>
            <span className="sm:hidden">{t("signing.drawSignature")}</span>
          </TabsTrigger>
          <TabsTrigger value="hanko" className="gap-1 text-xs sm:text-sm">
            <Stamp className="h-4 w-4" />
            <span>{t("signaturePad.stampTab")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="type" className="space-y-4">
          <Input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={t("signaturePad.namePlaceholder")}
            className="text-lg"
          />
          <div className="grid grid-cols-2 gap-2">
            {SIGNATURE_FONT_OPTIONS.map(font => (
              <button
                key={font.id}
                className={`p-3 border-2 rounded-lg text-center transition-all ${
                  selectedFont === font.id
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedFont(font.id as SignatureFontId)}
              >
                <span
                  className="text-2xl block truncate"
                  style={{ fontFamily: font.cssFamily }}
                >
                  {typedName || signerName}
                </span>
                <span className="text-xs text-gray-500 mt-1 block">{font.name}</span>
              </button>
            ))}
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
            <span className="text-3xl" style={{ fontFamily: currentFontOption?.cssFamily }}>
              {typedName || signerName}
            </span>
          </div>
        </TabsContent>

        <TabsContent value="draw" className="space-y-4">
          <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair touch-none"
              style={{ height: 150 }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-gray-400">{t("signaturePad.drawHint")}</span>
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-2">
            <Eraser className="h-4 w-4" />
            {t("signing.clearSignature")}
          </Button>
        </TabsContent>

        <TabsContent value="hanko">
          <HankoGenerator
            defaultName={defaultHankoName}
            onComplete={handleHankoComplete}
            onCancel={onCancel}
          />
        </TabsContent>
      </Tabs>

      {mode !== "hanko" && (
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button
            onClick={handleComplete}
            disabled={(mode === "draw" && !hasDrawn) || (mode === "type" && !typedName.trim())}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {t("signaturePad.confirm")}
          </Button>
        </div>
      )}
    </div>
  );
}
