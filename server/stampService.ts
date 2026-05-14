/**
 * 印鑑（ハンコ）自動生成サービス
 * 名字を入力すると、日本の丸印（実印・認印スタイル）のPNG画像を生成する。
 * 
 * @napi-rs/canvas を使用してサーバーサイドで画像を生成。
 * Noto Sans CJK JP フォントで日本語の文字化けを防止。
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

// CJK font candidates in order of preference (Linux, Alpine, macOS)
const CJK_BOLD_CANDIDATES = [
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",     // Debian/Ubuntu
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",          // Alpine
  "/opt/homebrew/share/fonts/noto/NotoSansCJK-Bold.ttc",      // macOS Homebrew
  "/Library/Fonts/NotoSansCJK-Bold.ttc",                      // macOS system
];
const CJK_REGULAR_CANDIDATES = [
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",  // Debian/Ubuntu
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",       // Alpine
  "/opt/homebrew/share/fonts/noto/NotoSansCJK-Regular.ttc",  // macOS Homebrew
  "/Library/Fonts/NotoSansCJK-Regular.ttc",                   // macOS system
];
// Bundled fallback: shared with pdf.ts
const BUNDLED_FONT = path.join(import.meta.dirname, "fonts", "NotoSansJP-Static-Regular.ttf");

let fontsRegistered = false;

function ensureFonts() {
  if (fontsRegistered) return;
  try {
    const boldPath = CJK_BOLD_CANDIDATES.find((p) => fs.existsSync(p))
      ?? (fs.existsSync(BUNDLED_FONT) ? BUNDLED_FONT : null);
    const regularPath = CJK_REGULAR_CANDIDATES.find((p) => fs.existsSync(p))
      ?? (fs.existsSync(BUNDLED_FONT) ? BUNDLED_FONT : null);

    if (boldPath) GlobalFonts.registerFromPath(boldPath, "NotoSansCJKBold");
    if (regularPath) GlobalFonts.registerFromPath(regularPath, "NotoSansCJKRegular");
    fontsRegistered = true;
    console.log(`[StampService] Fonts registered: bold=${boldPath ?? "none"}, regular=${regularPath ?? "none"}`);
  } catch (e) {
    console.warn("[StampService] Font registration failed:", e);
  }
}

export interface StampOptions {
  /** 印鑑に表示する名前（通常は名字） */
  name: string;
  /** 印鑑のサイズ（ピクセル） */
  size?: number;
  /** 印鑑の色（CSS color） */
  color?: string;
  /** 印鑑のスタイル */
  style?: "circle" | "square";
  /** 背景を透明にするか */
  transparent?: boolean;
}

/**
 * 丸印（印鑑）画像をPNGバッファとして生成する。
 * 
 * 文字数に応じて自動的にレイアウトを調整：
 * - 1文字: 中央に大きく配置
 * - 2文字: 縦書きで上下に配置
 * - 3文字: 縦書きで上中下に配置
 * - 4文字以上: 2列の縦書きで配置
 */
export function generateStampImage(opts: StampOptions): Buffer {
  ensureFonts();

  const size = opts.size ?? 200;
  const color = opts.color ?? "#d32f2f"; // 朱肉の赤
  const style = opts.style ?? "circle";
  const transparent = opts.transparent ?? true;
  const name = opts.name.trim();

  if (!name || name.length === 0) {
    throw new Error("名前を入力してください");
  }

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Clear background
  if (transparent) {
    ctx.clearRect(0, 0, size, size);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.45;
  const borderWidth = size * 0.04;

  // Draw stamp border
  ctx.strokeStyle = color;
  ctx.lineWidth = borderWidth;

  if (style === "circle") {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const margin = size * 0.08;
    ctx.strokeRect(margin, margin, size - margin * 2, size - margin * 2);
  }

  // Draw text
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const chars = Array.from(name); // Handle multi-byte chars properly
  const innerRadius = radius - borderWidth;

  if (chars.length === 1) {
    // Single character: centered, large
    const fontSize = innerRadius * 1.4;
    ctx.font = `bold ${fontSize}px NotoSansCJKBold, "Noto Sans CJK JP", sans-serif`;
    ctx.fillText(chars[0], cx, cy + fontSize * 0.03);
  } else if (chars.length === 2) {
    // Two characters: vertical, top and bottom
    const fontSize = innerRadius * 0.85;
    ctx.font = `bold ${fontSize}px NotoSansCJKBold, "Noto Sans CJK JP", sans-serif`;
    const gap = fontSize * 0.55;
    ctx.fillText(chars[0], cx, cy - gap);
    ctx.fillText(chars[1], cx, cy + gap);
  } else if (chars.length === 3) {
    // Three characters: vertical
    const fontSize = innerRadius * 0.65;
    ctx.font = `bold ${fontSize}px NotoSansCJKBold, "Noto Sans CJK JP", sans-serif`;
    const gap = fontSize * 0.85;
    ctx.fillText(chars[0], cx, cy - gap);
    ctx.fillText(chars[1], cx, cy);
    ctx.fillText(chars[2], cx, cy + gap);
  } else {
    // 4+ characters: split into two columns (right-to-left, top-to-bottom)
    const half = Math.ceil(chars.length / 2);
    const rightCol = chars.slice(0, half);  // Right column (read first)
    const leftCol = chars.slice(half);       // Left column

    const maxColChars = Math.max(rightCol.length, leftCol.length);
    const fontSize = Math.min(
      innerRadius * 0.55,
      (innerRadius * 1.6) / maxColChars
    );
    ctx.font = `bold ${fontSize}px NotoSansCJKBold, "Noto Sans CJK JP", sans-serif`;

    const colGap = fontSize * 0.6;
    const rowGap = fontSize * 0.9;

    // Right column (read first in Japanese)
    const rightX = cx + colGap;
    const rightStartY = cy - ((rightCol.length - 1) * rowGap) / 2;
    rightCol.forEach((char, i) => {
      ctx.fillText(char, rightX, rightStartY + i * rowGap);
    });

    // Left column
    const leftX = cx - colGap;
    const leftStartY = cy - ((leftCol.length - 1) * rowGap) / 2;
    leftCol.forEach((char, i) => {
      ctx.fillText(char, leftX, leftStartY + i * rowGap);
    });
  }

  // Add slight texture/aging effect for realism
  addStampTexture(ctx, size, color);

  return Buffer.from(canvas.toBuffer("image/png"));
}

/**
 * 印鑑にリアルな質感を追加する（朱肉のかすれ効果）
 */
function addStampTexture(ctx: any, size: number, color: string) {
  // Add subtle noise for ink texture
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Only modify non-transparent pixels
    if (data[i + 3] > 0) {
      // Random slight opacity variation for ink texture
      const variation = Math.random() * 0.15;
      data[i + 3] = Math.max(0, Math.min(255, data[i + 3] * (1 - variation)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * 印鑑画像をData URLとして生成する（フロントエンドでの表示用）
 */
export function generateStampDataUrl(opts: StampOptions): string {
  const buffer = generateStampImage(opts);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
