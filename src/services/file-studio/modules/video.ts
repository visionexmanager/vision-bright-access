// ─── Video Converter Module ──────────────────────────────────────────────────
//
// This was a stub. It waited four hundred milliseconds, called `onProgress(10)`
// to look like something was happening, and returned "Video conversion to MP4
// requires server processing. Queued for Phase 12 API integration." Phase 12
// was never built, and this page is linked from the navbar, the footer and the
// service catalog — so a visitor could reach it in three clicks and be told,
// politely, that the thing it advertises is not there.
//
// The server processing exists now. It is the same ffmpeg the WhatsApp
// assistant converts with, on Visionex's own machine, behind an Edge Function
// that holds the token a browser cannot.

import type {
  ConverterModule,
  ConversionResult,
  VideoOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { VIDEO_FORMATS } from "@/lib/types/fileStudio";
import { convertOnServer, SERVER_VIDEO_OUTPUTS } from "../serverConvert";

export const VideoModule: ConverterModule = {
  moduleType: "video",
  // Every video container ffmpeg can demux is a valid input — AVI, FLV, 3GP and
  // the rest are read perfectly well. They are not valid *outputs*, and listing
  // them as such is what made this module fail on options it should never have
  // offered.
  supportedInputFormats: [...VIDEO_FORMATS],
  supportedOutputFormats: [...SERVER_VIDEO_OUTPUTS],
  canHandleInBrowser: false,

  async convert(
    file: File,
    options: ConversionOptions,
    onProgress: (pct: number) => void
  ): Promise<ConversionResult> {
    const opts = options as VideoOptions;

    return await convertOnServer({
      file,
      target: opts.targetFormat,
      options: {
        // Only what the service has an allowlist entry for, and translated into
        // its vocabulary rather than sent in this page's. Anything it cannot
        // express is dropped here rather than sent and refused, so a failure a
        // caller sees is about their file and not about a control they used.
        ...(RESOLUTION_HEIGHT[opts.resolution ?? "original"]
          ? { height: RESOLUTION_HEIGHT[opts.resolution ?? "original"] as string }
          : {}),
        // 24 and 30 are on the service's list; 60 is not, and forcing a video
        // down to 30 because this page offered a number the converter does not
        // take would be changing somebody's video to hide a mismatch. Left at
        // the source's own rate instead.
        ...(opts.fps === 24 || opts.fps === 30 ? { fps: String(opts.fps) } : {}),
        ...(QUALITY_NAME[opts.quality ?? "medium"]
          ? { quality: QUALITY_NAME[opts.quality ?? "medium"] as string }
          : {}),
      },
      onProgress,
    });
  },
};

/** This page's resolutions, as the heights the service will accept. */
const RESOLUTION_HEIGHT: Record<string, string | undefined> = {
  "360p": "360",
  "480p": "480",
  "720p": "720",
  "1080p": "1080",
  // Whatever the file already is. Sending no height keeps it.
  original: undefined,
};

/** This page's three words, as the service's three. */
const QUALITY_NAME: Record<string, string | undefined> = {
  low: "small",
  medium: "balanced",
  high: "high",
};
