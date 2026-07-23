// ─── Image Converter Module (browser-native via Canvas API) ──────────────────

import type {
  ConverterModule,
  ConversionResult,
  ImageOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { IMAGE_FORMATS } from "@/lib/types/fileStudio";

export const ImageModule: ConverterModule = {
  moduleType: "image",
  supportedInputFormats: [...IMAGE_FORMATS],
  supportedOutputFormats: ["jpg", "jpeg", "png", "webp"],
  canHandleInBrowser: true,

  async convert(
    file: File,
    options: ConversionOptions,
    onProgress: (pct: number) => void
  ): Promise<ConversionResult> {
    const opts = options as ImageOptions;
    const start = Date.now();

    try {
      onProgress(10);

      // Load the image into a bitmap
      const bitmap = await createImageBitmap(file);
      onProgress(30);

      const targetW = opts.width ?? bitmap.width;
      const targetH = opts.maintainAspect
        ? Math.round(bitmap.height * (targetW / bitmap.width))
        : opts.height ?? bitmap.height;

      if (!Number.isFinite(targetW) || !Number.isFinite(targetH) || targetW < 1 || targetH < 1 || targetW * targetH > 100_000_000) {
        throw new Error("Invalid or unsafe output dimensions.");
      }
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas conversion is unavailable in this browser.");
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      bitmap.close();
      onProgress(70);

      const quality = (opts.quality ?? 90) / 100;
      const mime = mimeFromFormat(opts.targetFormat);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error(`This browser cannot encode ${opts.targetFormat.toUpperCase()}.`)),
          mime,
          quality,
        );
      });
      if (blob.type !== mime) {
        throw new Error(`This browser cannot encode ${opts.targetFormat.toUpperCase()}.`);
      }

      onProgress(100);
      const url = URL.createObjectURL(blob);

      return {
        success: true,
        resultUrl: url,
        resultBlob: blob,
        resultSize: blob.size,
        processingMs: Date.now() - start,
        metadata: {
          width: targetW,
          height: targetH,
          format: opts.targetFormat,
          originalSize: file.size,
        },
      };
    } catch (err) {
      return {
        success: false,
        processingMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Image conversion failed",
      };
    }
  },
};

function mimeFromFormat(fmt: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    avif: "image/avif",
  };
  return map[fmt] ?? "image/png";
}
