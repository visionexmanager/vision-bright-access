import { jsPDF } from "jspdf";
import { afterEach, describe, expect, it, vi } from "vitest";
import { drawEmoji } from "@/lib/pdf/emojiImage";
import { drawnText } from "./helpers/pdfText";

// A BookCreator cover drew its emoji with doc.text in Helvetica, which has no
// emoji: the PDF said "Ø=Þ€". The emoji is now a picture drawn by the
// browser's own emoji font.

// 1×1 transparent PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

afterEach(() => vi.restoreAllMocks());

describe("emoji in PDFs", () => {
  it("shows why: Helvetica turns an emoji into mojibake", () => {
    const doc = new jsPDF({ unit: "pt", format: "a5" });
    doc.text("🚀", 100, 100);
    expect(drawnText(doc.output()).map((r) => r.text).join("")).toMatch(/Ø=Þ/);
  });

  it("places the emoji as an image, and writes no text for it", () => {
    const fillText = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillText } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(PNG);
    const doc = new jsPDF({ unit: "pt", format: "a5" });
    expect(drawEmoji(doc, "🚀", 100, 100, 48)).toBe(true);
    expect(fillText).toHaveBeenCalledWith("🚀", expect.any(Number), expect.any(Number));
    const pdf = doc.output();
    expect(pdf).toMatch(/\/Subtype \/Image/);
    expect(drawnText(pdf)).toEqual([]);
  });

  it("still produces the PDF when the canvas cannot export an image", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillText: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => { throw new Error("not implemented"); });
    const doc = new jsPDF({ unit: "pt", format: "a5" });
    expect(drawEmoji(doc, "🚀", 100, 100, 48)).toBe(false);
    expect(drawnText(doc.output())).toEqual([]);
  });

  it("draws nothing, rather than mojibake, where there is no canvas", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const doc = new jsPDF({ unit: "pt", format: "a5" });
    expect(drawEmoji(doc, "🚀", 100, 100, 48)).toBe(false);
    const pdf = doc.output();
    expect(pdf).not.toMatch(/\/Subtype \/Image/);
    expect(drawnText(pdf)).toEqual([]);
  });
});
