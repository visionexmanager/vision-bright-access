// ─── The server side of File Studio, which until now did not exist ──────────
//
// Every heavy conversion on this page answered "requires server processing.
// Available in Phase 12 API integration." Phase 12 was never built, and the
// page is linked from the navbar, the footer and the service catalog — so a
// visitor could reach it in three clicks and be told, politely, that the thing
// it advertises is not there.
//
// It is there now: `file-convert` forwards to the same ffmpeg the WhatsApp
// assistant uses, on Visionex's own server, with no API key behind it.
//
// ── Why the browser cannot call the service directly ────────────────────────
//
// The processing service is behind a bearer token, and anything this page knows
// every visitor knows. The token stays on the server; this talks to the Edge
// Function that holds it, which is also where the "must be a signed-in user"
// gate lives.

import { supabase } from "@/integrations/supabase/client";
import type { ConversionResult } from "@/lib/types/fileStudio";

/**
 * What the local service will actually produce.
 *
 * Not the same as what this page can *read*: ffmpeg will happily open an AVI or
 * a WMA and convert it to something else, so those stay valid inputs. They are
 * not valid outputs, and offering them was most of why this page looked broken
 * — a format nobody can produce is a menu entry that can only ever fail.
 *
 * Kept in step with `services/media-processor/src/convert.mjs` by
 * `file-studio-convert.test.ts`, which reads the targets out of the service.
 */
export const SERVER_AUDIO_OUTPUTS = ["mp3", "wav", "flac", "aac", "ogg", "opus", "m4a"] as const;
export const SERVER_VIDEO_OUTPUTS = ["mp4", "mkv", "webm", "mov", "gif"] as const;

export const serverCanProduce = (format: string): boolean =>
  (SERVER_AUDIO_OUTPUTS as readonly string[]).includes(format) ||
  (SERVER_VIDEO_OUTPUTS as readonly string[]).includes(format);

/** The largest file the service accepts, matching its own ceiling and nginx's. */
export const MAX_SERVER_FILE_BYTES = 16 * 1024 * 1024;

/**
 * A sentence for each way this can fail.
 *
 * The function answers with a label out of a fixed list, never with ffmpeg's
 * own output, and this is where a label becomes something a person can act on.
 * "Exit code 1" is not a thing anybody can do anything about; "the file may be
 * damaged" is.
 */
function messageFor(code: string | undefined, status: number): string {
  if (status === 401) return "Sign in to convert files.";
  if (status === 413) return "That file is too large — the limit is 16 MB.";
  switch (code) {
    case "busy":
      return "The converter is busy right now. Try again in a moment.";
    case "timeout":
      return "That took too long to convert. A shorter file will work.";
    case "unsupported_target":
      return "That output format isn't supported.";
    case "unreadable_media":
      return "This file couldn't be read. It may be damaged, or not the format it claims.";
    case "output_too_large":
      return "The converted file came out too large to return.";
    case "not_configured":
      return "Conversion is unavailable at the moment.";
    default:
      return "This file couldn't be converted. The format may be unsupported, or the file may be damaged.";
  }
}

/** Base64 without blowing the stack on a 16 MB file. */
async function toBase64(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  // `String.fromCharCode(...bytes)` on a whole file exceeds the argument limit
  // and throws — a bug that only appears on large files, which are exactly the
  // ones this page is for.
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Convert one file on Visionex's own server.
 *
 * Returns the same `ConversionResult` the browser modules return, so a caller
 * cannot tell which path ran except by the speed — which is the point.
 */
export async function convertOnServer(params: {
  file: File;
  target: string;
  options?: Record<string, string | number | boolean>;
  onProgress?: (pct: number) => void;
}): Promise<ConversionResult> {
  const started = Date.now();
  const progress = params.onProgress ?? (() => {});

  if (!serverCanProduce(params.target)) {
    return {
      success: false,
      processingMs: Date.now() - started,
      error: `${params.target.toUpperCase()} isn't a format this converter can produce.`,
    };
  }
  if (params.file.size > MAX_SERVER_FILE_BYTES) {
    return {
      success: false,
      processingMs: Date.now() - started,
      error: "That file is too large — the limit is 16 MB.",
    };
  }

  try {
    progress(10);
    const encoded = await toBase64(params.file);
    progress(30);

    // `functions.invoke` would parse the answer as JSON; this returns bytes, so
    // the call is made directly with the session's own token.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        success: false,
        processingMs: Date.now() - started,
        error: "Sign in to convert files.",
      };
    }

    const base = (supabase as unknown as { functionsUrl?: string }).functionsUrl
      ?? `${(import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL ?? ""}/functions/v1`;

    const response = await fetch(`${base}/file-convert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: encoded, target: params.target, ...(params.options ?? {}) }),
    });
    progress(80);

    if (!response.ok) {
      let code: string | undefined;
      try {
        code = ((await response.json()) as { code?: string }).code;
      } catch {
        // A body that is not JSON tells us nothing beyond the status.
      }
      return {
        success: false,
        processingMs: Date.now() - started,
        error: messageFor(code, response.status),
      };
    }

    const blob = await response.blob();
    progress(100);
    return {
      success: true,
      resultUrl: URL.createObjectURL(blob),
      resultSize: blob.size,
      processingMs: Date.now() - started,
    };
  } catch {
    // Never the exception: it quotes a URL, and on this page that URL is
    // followed by a token.
    return {
      success: false,
      processingMs: Date.now() - started,
      error: "The converter couldn't be reached. Check your connection and try again.",
    };
  }
}
