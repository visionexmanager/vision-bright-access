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
import { ArchiveModule, ARCHIVE_WORKING_TARGETS } from "./modules/archives";
import { DeveloperModule } from "./modules/developer";
import { BROWSER_OUTPUT_FORMATS as AUDIO_BROWSER_TARGETS } from "./modules/audio";
import { BROWSER_OUTPUT_FORMATS as IMAGE_BROWSER_TARGETS } from "./modules/images";
import {
  SERVER_AUDIO_OUTPUTS,
  SERVER_IMAGE_OUTPUTS,
  SERVER_VIDEO_OUTPUTS,
} from "./serverConvert";

// ── Module registry ───────────────────────────────────────────────────────────

const MODULE_REGISTRY = {
  audio:      AudioModule,
  video:      VideoModule,
  image:      ImageModule,
  document:   DocumentModule,
  archive:    ArchiveModule,
  developer:  DeveloperModule,
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
// getSupportedOutputFormats() reflects each module's nominal target list. This
// narrows it to what a visitor can actually be handed — which is no longer the
// same as "what runs in the browser", because two things run now: the browser
// modules, and `convertOnServer`, which is the same ffmpeg the WhatsApp
// assistant converts with.
//
// This list stayed at the browser's answer after that path shipped, so a
// visitor who dropped in a video was offered *no output format at all* for a
// file the site could already convert, and an audio file could only become WAV
// or WebM. That is the same fault this list was written to prevent — the menu
// disagreeing with the machine — pointing the other way, and it is why every
// entry below is now derived from a module's own constants rather than typed
// out again here.
//

const DOCUMENT_WORKING_TARGETS: Record<string, readonly string[]> = {
  txt:  ["html", "md"],
  html: ["txt"],
  csv:  ["txt"],
  // Reading a Word document or a deck, not rewriting one: a .docx is a ZIP of
  // XML, so the archive reader opens it and the text comes out. Writing one is
  // a different problem that needs a document engine this project does not run,
  // which is why PDF is absent and these two are one-way.
  docx: ["txt", "html"],
  pptx: ["txt", "html"],
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

/** Browser targets first, then the ones only the server writes. */
const union = (browser: readonly string[], server: readonly string[]): readonly string[] => [
  ...browser,
  ...server.filter((format) => !browser.includes(format)),
];

// WAV (a manual PCM encode) and WebM (MediaRecorder+opus) are all a browser can
// write; MP3, FLAC, AAC, OGG, Opus and M4A need an encoder we do not ship, so
// they go to the server — which has had them all along.
const AUDIO_WORKING_TARGETS = union(AUDIO_BROWSER_TARGETS, SERVER_AUDIO_OUTPUTS);

// A canvas encodes three formats; BMP and TIFF come back from the server.
const IMAGE_WORKING_TARGETS = union(IMAGE_BROWSER_TARGETS, SERVER_IMAGE_OUTPUTS);

// Nothing decodes a video in the browser here, so every video target is the
// server's. AVI, FLV, M4V and 3GP are readable and not writable, which is why
// they are inputs and not on this list.
const VIDEO_WORKING_TARGETS: readonly string[] = [...SERVER_VIDEO_OUTPUTS];

/**
 * Whether choosing this target sends the file to Visionex's server.
 *
 * The page needs it for two things it must say before a visitor waits: the
 * server path requires a signed-in account, and it refuses a file over 16 MB —
 * neither of which is true of a conversion that happens in the tab.
 */
export function requiresServer(moduleType: ModuleType, targetFormat: string): boolean {
  if (moduleType === "video") return VIDEO_WORKING_TARGETS.includes(targetFormat);
  if (moduleType === "audio") return !AUDIO_BROWSER_TARGETS.includes(targetFormat);
  if (moduleType === "image") return !(IMAGE_BROWSER_TARGETS as readonly string[]).includes(targetFormat);
  return false;
}

export function getWorkingOutputFormats(moduleType: ModuleType, inputFileName: string): readonly string[] {
  const inFmt = inputFileName.split(".").pop()?.toLowerCase() ?? "";

  switch (moduleType) {
    case "image":
      return IMAGE_WORKING_TARGETS;
    case "developer":
      return DEVELOPER_WORKING_TARGETS[inFmt] ?? [];
    case "audio":
      return AUDIO_WORKING_TARGETS;
    case "document":
      return DOCUMENT_WORKING_TARGETS[inFmt] ?? [];
    case "video":
      return VIDEO_WORKING_TARGETS;
    case "archive":
      // Empty for a 7z or a RAR, which nothing here reads. That is what makes
      // the page say so upfront instead of running a progress bar to a refusal.
      return ARCHIVE_WORKING_TARGETS[inFmt] ?? [];
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
