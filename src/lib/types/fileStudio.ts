// ─── Universal File Studio — Type Definitions ────────────────────────────────

export type ModuleType =
  | "audio"
  | "video"
  | "image"
  | "document"
  | "archive"
  | "developer"
  | "ai-tools";

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type JobPriority = "normal" | "priority"; // priority = VX subscribers

// ── Supported format maps ──────────────────────────────────────────────────

export const AUDIO_FORMATS   = ["mp3", "wav", "flac", "aac", "ogg", "m4a", "opus", "wma"] as const;
export const VIDEO_FORMATS   = ["mp4", "avi", "mov", "mkv", "webm", "flv", "m4v", "3gp"] as const;
export const IMAGE_FORMATS   = ["jpg", "jpeg", "png", "webp", "heic", "avif", "gif", "bmp", "tiff", "svg"] as const;
export const DOCUMENT_FORMATS = ["pdf", "docx", "txt", "html", "csv", "xlsx", "pptx", "md", "rtf"] as const;
export const ARCHIVE_FORMATS  = ["zip", "tar", "gz", "7z", "rar"] as const;
export const DEVELOPER_FORMATS = ["json", "xml", "yaml", "toml", "csv", "base64", "hex"] as const;

export type AudioFormat   = (typeof AUDIO_FORMATS)[number];
export type VideoFormat   = (typeof VIDEO_FORMATS)[number];
export type ImageFormat   = (typeof IMAGE_FORMATS)[number];
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];
export type ArchiveFormat  = (typeof ARCHIVE_FORMATS)[number];
export type DeveloperFormat = (typeof DEVELOPER_FORMATS)[number];

export type AnyFormat =
  | AudioFormat | VideoFormat | ImageFormat
  | DocumentFormat | ArchiveFormat | DeveloperFormat;

// ── Conversion options (per module) ───────────────────────────────────────

export interface AudioOptions {
  targetFormat: AudioFormat;
  /** 0–100 */
  quality?: number;
  normalize?: boolean;
  trimStart?: number;
  trimEnd?: number;
  noiseReduction?: boolean;
}

export interface VideoOptions {
  targetFormat: VideoFormat;
  quality?: "low" | "medium" | "high";
  resolution?: "360p" | "480p" | "720p" | "1080p" | "original";
  fps?: 24 | 30 | 60;
  extractAudio?: boolean;
  removeAudio?: boolean;
  compress?: boolean;
}

export interface ImageOptions {
  targetFormat: ImageFormat;
  width?: number;
  height?: number;
  quality?: number;
  maintainAspect?: boolean;
  ocr?: boolean;
  backgroundRemoval?: boolean;
}

export interface DocumentOptions {
  targetFormat: DocumentFormat;
  mergePdfs?: boolean;
  splitPage?: number;
  ocr?: boolean;
}

export interface ArchiveOptions {
  targetFormat: ArchiveFormat;
  compressionLevel?: 1 | 5 | 9;
}

export interface DeveloperOptions {
  targetFormat: DeveloperFormat;
  pretty?: boolean;
  encode?: boolean;
}

export type ConversionOptions =
  | AudioOptions
  | VideoOptions
  | ImageOptions
  | DocumentOptions
  | ArchiveOptions
  | DeveloperOptions;

// ── Job ───────────────────────────────────────────────────────────────────

export interface ConversionJob {
  id: string;
  userId: string | null;
  moduleType: ModuleType;
  inputFileName: string;
  inputFileSize: number;
  inputFormat: string;
  targetFormat: AnyFormat;
  options: ConversionOptions;
  status: JobStatus;
  priority: JobPriority;
  progress: number;           // 0–100
  resultUrl?: string;
  resultSize?: number;
  errorMessage?: string;
  vxCost: number;
  processingMs?: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;          // auto-delete after 24h
  retryCount: number;
}

// ── Conversion result ──────────────────────────────────────────────────────

export interface ConversionResult {
  success: boolean;
  resultUrl?: string;
  resultBlob?: Blob;
  resultSize?: number;
  processingMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ── Module interface contract ──────────────────────────────────────────────

export interface ConverterModule {
  moduleType: ModuleType;
  supportedInputFormats: readonly string[];
  supportedOutputFormats: readonly string[];
  convert(
    file: File,
    options: ConversionOptions,
    onProgress: (pct: number) => void
  ): Promise<ConversionResult>;
  canHandleInBrowser: boolean;
}

// ── VX plan limits ────────────────────────────────────────────────────────

export interface FileStudioPlan {
  /** Max file size in MB */
  maxFileSizeMb: number;
  /** Max daily conversions */
  dailyLimit: number;
  priority: JobPriority;
  /** Queue wait multiplier (1 = normal, 0.5 = twice as fast) */
  queueMultiplier: number;
}

export const PLAN_FREE: FileStudioPlan = {
  maxFileSizeMb: 50,
  dailyLimit: 5,
  priority: "normal",
  queueMultiplier: 1,
};

export const PLAN_VX: FileStudioPlan = {
  maxFileSizeMb: 500,
  dailyLimit: 100,
  priority: "priority",
  queueMultiplier: 0.3,
};
