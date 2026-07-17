// ─── Developer Utilities Module (fully browser-native) ───────────────────────

import type {
  ConverterModule,
  ConversionResult,
  DeveloperOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { DEVELOPER_FORMATS } from "@/lib/types/fileStudio";

export const DeveloperModule: ConverterModule = {
  moduleType: "developer",
  supportedInputFormats: [...DEVELOPER_FORMATS],
  supportedOutputFormats: [...DEVELOPER_FORMATS],
  canHandleInBrowser: true,

  async convert(
    file: File,
    options: ConversionOptions,
    onProgress: (pct: number) => void
  ): Promise<ConversionResult> {
    const opts = options as DeveloperOptions;
    const start = Date.now();
    const inFmt = file.name.split(".").pop()?.toLowerCase() ?? "";

    try {
      onProgress(15);
      const text = await file.text();
      onProgress(40);

      let output = "";
      let mimeType = "text/plain";

      if (opts.targetFormat === "base64") {
        // Encode text to base64
        const bytes = new TextEncoder().encode(text);
        output = btoa(String.fromCharCode(...bytes));
        mimeType = "text/plain";
      } else if (inFmt === "base64") {
        // Decode base64
        output = atob(text.trim());
        mimeType = "text/plain";
      } else if (inFmt === "json" && opts.targetFormat === "json") {
        // Prettify / minify JSON
        const parsed = JSON.parse(text);
        output = opts.pretty !== false
          ? JSON.stringify(parsed, null, 2)
          : JSON.stringify(parsed);
        mimeType = "application/json";
      } else if (inFmt === "csv" && opts.targetFormat === "json") {
        output = JSON.stringify(csvToJson(text), null, 2);
        mimeType = "application/json";
      } else if (inFmt === "json" && opts.targetFormat === "csv") {
        output = jsonToCsv(JSON.parse(text));
        mimeType = "text/csv";
      } else if (opts.targetFormat === "hex") {
        const bytes = new TextEncoder().encode(text);
        output = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
        mimeType = "text/plain";
      } else {
        onProgress(100);
        return {
          success: false,
          processingMs: Date.now() - start,
          error: `${inFmt} → ${opts.targetFormat} conversion not yet supported in browser mode.`,
        };
      }

      onProgress(90);
      const blob = new Blob([output], { type: mimeType });
      const url = URL.createObjectURL(blob);
      onProgress(100);

      return {
        success: true,
        resultUrl: url,
        resultBlob: blob,
        resultSize: blob.size,
        processingMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        processingMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Developer conversion failed",
      };
    }
  },
};

function csvToJson(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function jsonToCsv(data: unknown[]): string {
  if (!Array.isArray(data) || !data.length) return "";
  const keys = Object.keys(data[0] as object);
  const rows = data.map((row) =>
    keys.map((k) => `"${String((row as Record<string, unknown>)[k] ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return [keys.join(","), ...rows].join("\n");
}
