import type { jsPDF } from "jspdf";

/**
 * Draw an emoji into a PDF as a picture.
 *
 * jsPDF's built-in fonts are WinAnsi and have no emoji: `doc.text("🚀")`
 * printed "Ø=Þ€" on every BookCreator cover. The browser does have an emoji
 * font, so the emoji is drawn on a canvas and placed as an image, centred on
 * `centerX` with its baseline at `baselineY`, `size` document units tall — the
 * same box `doc.text(emoji, centerX, baselineY, { align: "center" })` would
 * have filled at that font size.
 *
 * Where there is no canvas to draw on, nothing is drawn: a missing picture is
 * better than mojibake. Returns whether the emoji was placed.
 */
export function drawEmoji(doc: jsPDF, emoji: string, centerX: number, baselineY: number, size: number): boolean {
  if (!emoji || typeof document === "undefined") return false;
  const px = 128;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext("2d");
  } catch {
    context = null;
  }
  if (!context) return false;
  context.font = `${Math.round(px * 0.8)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(emoji, px / 2, px / 2 + px * 0.04);
  // An emoji must never cost the reader the whole PDF: a canvas that cannot
  // export a PNG means no picture, not a failed download.
  let png: unknown;
  try {
    png = canvas.toDataURL("image/png");
  } catch {
    return false;
  }
  if (typeof png !== "string" || !png.startsWith("data:image/png")) return false;
  // A glyph sits mostly above its baseline: the picture starts 80% of its
  // height above the line the text would have stood on.
  doc.addImage(png, "PNG", centerX - size / 2, baselineY - size * 0.8, size, size);
  return true;
}
