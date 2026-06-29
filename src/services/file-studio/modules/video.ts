// ─── Video Converter Module (server-side stub) ────────────────────────────────
// Video transcoding requires FFmpeg server-side. This module defines the
// interface and queues jobs for the Edge Function in Phase 12.

import type {
  ConverterModule,
  ConversionResult,
  VideoOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { VIDEO_FORMATS } from "@/lib/types/fileStudio";

export const VideoModule: ConverterModule = {
  moduleType: "video",
  supportedInputFormats: [...VIDEO_FORMATS],
  supportedOutputFormats: [...VIDEO_FORMATS],
  canHandleInBrowser: false,

  async convert(
    file: File,
    options: ConversionOptions,
    onProgress: (pct: number) => void
  ): Promise<ConversionResult> {
    const opts = options as VideoOptions;
    const start = Date.now();

    // Simulate queue acceptance
    onProgress(5);
    await new Promise((r) => setTimeout(r, 400));
    onProgress(10);

    // In Phase 12: POST to /functions/v1/video-convert
    // const formData = new FormData();
    // formData.append("file", file);
    // formData.append("options", JSON.stringify(opts));
    // const res = await fetch(...);

    return {
      success: false,
      processingMs: Date.now() - start,
      error: `Video conversion to ${opts.targetFormat.toUpperCase()} requires server processing. Queued for Phase 12 API integration.`,
    };
  },
};
