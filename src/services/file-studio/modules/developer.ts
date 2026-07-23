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

      if (opts.targetFormat === "base64" && inFmt !== "base64") {
        const bytes = new TextEncoder().encode(text);
        output = bytesToBase64(bytes);
        mimeType = "text/plain";
      } else if (inFmt === "base64" && opts.targetFormat === "txt") {
        output = new TextDecoder("utf-8", { fatal: true }).decode(base64ToBytes(text));
        mimeType = "text/plain";
      } else if (inFmt === "hex" && opts.targetFormat === "txt") {
        output = new TextDecoder("utf-8", { fatal: true }).decode(hexToBytes(text));
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

export function csvToJson(csv: string): Record<string, string>[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error("CSV contains an empty header.");
  return rows.slice(1)
    .filter((row) => row.some((value) => value.length > 0))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

export function jsonToCsv(data: unknown): string {
  if (!Array.isArray(data)) throw new Error("JSON must be an array of objects to convert to CSV.");
  if (!data.length) return "";
  if (data.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Every JSON array item must be an object.");
  }
  const keys = [...new Set(data.flatMap((row) => Object.keys(row as Record<string, unknown>)))];
  const rows = data.map((row) =>
    keys.map((key) => escapeCsvCell((row as Record<string, unknown>)[key])).join(",")
  );
  return [keys.map(escapeCsvCell).join(","), ...rows].join("\r\n");
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        value += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cell.length > 0) || rows.length === 0) rows.push(row);
  return rows;
}

function escapeCsvCell(value: unknown): string {
  let text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error("Invalid Base64 input.");
  }
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function hexToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(normalized)) {
    throw new Error("Invalid hexadecimal input.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g)!, (pair) => Number.parseInt(pair, 16));
}
