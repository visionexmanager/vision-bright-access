// ─── File Studio — Unified Conversion Engine ─────────────────────────────────

import type {
  ModuleType,
  ConversionOptions,
  ConversionResult,
  AnyFormat,
} from "@/lib/types/fileStudio";
import { AudioModule } from "./modules/audio";
import { VideoModule } from "./modules/video";
import { ImageModule } from "./modules/images";
import { DocumentModule } from "./modules/documents";
import { ArchiveModule } from "./modules/archives";
import { DeveloperModule } from "./modules/developer";
import { AIToolsModule } from "./modules/aiTools";

// ── Module registry ───────────────────────────────────────────────────────────

const MODULE_REGISTRY = {
  audio:      AudioModule,
  video:      VideoModule,
  image:      ImageModule,
  document:   DocumentModule,
  archive:    ArchiveModule,
  developer:  DeveloperModule,
  "ai-tools": AIToolsModule,
} as const;

// ── Detect module from file extension ────────────────────────────────────────

export function detectModuleType(fileName: string): ModuleType | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3","wav","flac","aac","ogg","m4a","opus","wma"].includes(ext)) return "audio";
  if (["mp4","avi","mov","mkv","webm","flv","m4v","3gp"].includes(ext)) return "video";
  if (["jpg","jpeg","png","webp","heic","avif","gif","bmp","tiff","svg"].includes(ext)) return "image";
  if (["pdf","docx","txt","html","xlsx","pptx","md","rtf"].includes(ext)) return "document";
  if (["zip","tar","gz","7z","rar"].includes(ext)) return "archive";
  if (["json","xml","yaml","toml","csv","base64","hex"].includes(ext)) return "developer";
  return null;
}

// ── Get supported output formats for a given input ────────────────────────────

export function getSupportedOutputFormats(moduleType: ModuleType): readonly string[] {
  return MODULE_REGISTRY[moduleType]?.supportedOutputFormats ?? [];
}

// ── Realistic (actually working) output formats ────────────────────────────────
//
// getSupportedOutputFormats() reflects each module's nominal target list, but
// several formats there are placeholders awaiting server-side processing
// (see modules/video.ts, archives.ts, aiTools.ts, and the server-only branches
// in audio.ts / documents.ts) — queuing those today always ends in failure.
// This narrows the list to pairs that genuinely convert in-browser, so the UI
// can be honest about it upfront instead of showing a fake progress bar.

const DOCUMENT_WORKING_TARGETS: Record<string, readonly string[]> = {
  txt:  ["html", "md"],
  html: ["txt"],
  csv:  ["txt"],
};

const DEVELOPER_WORKING_TARGETS: Record<string, readonly string[]> = {
  json: ["json", "csv", "base64", "hex"],
  csv: ["json", "base64", "hex"],
  xml: ["base64", "hex"],
  yaml: ["base64", "hex"],
  toml: ["base64", "hex"],
  base64: ["txt"],
  hex: ["txt"],
};

// Only wav (manual PCM encode) and webm (MediaRecorder+opus) actually work
// in-browser — mp3/ogg need a dedicated encoder we don't ship yet, see
// modules/audio.ts's header comment for why they used to fail mid-conversion.
const AUDIO_WORKING_TARGETS = ["wav", "webm"] as const;

export function getWorkingOutputFormats(moduleType: ModuleType, inputFileName: string): readonly string[] {
  const inFmt = inputFileName.split(".").pop()?.toLowerCase() ?? "";

  switch (moduleType) {
    case "image":
      return ["jpg", "jpeg", "png", "webp"];
    case "developer":
      return DEVELOPER_WORKING_TARGETS[inFmt] ?? [];
    case "audio":
      return AUDIO_WORKING_TARGETS;
    case "document":
      return DOCUMENT_WORKING_TARGETS[inFmt] ?? [];
    case "video":
    case "archive":
    case "ai-tools":
      // No in-browser implementation yet — server processing required.
      return [];
    default:
      return [];
  }
}

// ── Main conversion entry point ───────────────────────────────────────────────

export interface EngineInput {
  file: File;
  moduleType: ModuleType;
  targetFormat: AnyFormat;
  options: ConversionOptions;
  onProgress?: (pct: number) => void;
}

export async function runConversion(input: EngineInput): Promise<ConversionResult> {
  const { file, moduleType, options, onProgress = () => {} } = input;
  const module = MODULE_REGISTRY[moduleType];

  if (!module) {
    return {
      success: false,
      processingMs: 0,
      error: `No module found for type: ${moduleType}`,
    };
  }

  return module.convert(file, options, onProgress);
}

// ── File size validation ──────────────────────────────────────────────────────

export function validateFileSize(file: File, maxMb: number): string | null {
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > maxMb) {
    return `File size (${sizeMb.toFixed(1)} MB) exceeds your plan limit of ${maxMb} MB.`;
  }
  return null;
}

export function fileSizeMb(file: File): number {
  return file.size / (1024 * 1024);
}
