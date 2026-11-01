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
import { serverCanConvertDocument } from "./serverDocuments";

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
/**
 * The stills that same ffmpeg writes.
 *
 * JPG, PNG and WebP come out of a canvas in the browser and should keep doing
 * so — that path costs nobody a request and works signed out. BMP and TIFF are
 * the two no canvas can encode, so they were missing from the page entirely
 * while the server had been writing them since image conversion shipped.
 */
export const SERVER_IMAGE_OUTPUTS = ["jpg", "png", "webp", "bmp", "tiff"] as const;

export const serverCanProduce = (format: string): boolean =>
  (SERVER_AUDIO_OUTPUTS as readonly string[]).includes(format) ||
  (SERVER_VIDEO_OUTPUTS as readonly string[]).includes(format) ||
  (SERVER_IMAGE_OUTPUTS as readonly string[]).includes(format);

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
    case "unrecognised":
      return "This doesn't look like a document this converter can open.";
    case "unsupported_pair":
      return "That conversion isn't available for this kind of file.";
    case "expired":
      return "That conversion is no longer available. Please start it again.";
    case "too_many_pages":
      return "That PDF has too many pages to read in one go. Split it into parts of a few hundred pages.";
    case "encrypted":
      return "This PDF is password-protected. Remove the password and try again.";
    case "nothing_readable":
      return "No text could be read from this scan. Try a clearer copy.";
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

const JOB_POLL_MS = 3_000;
/** The server abandons a job after 40 minutes; the page stops waiting a little after that. */
const JOB_GIVE_UP_MS = 45 * 60_000;

/**
 * Wait for a long document's job and return its file.
 *
 * Progress runs from 30 to 95 by pages read, so a hundred-page document shows
 * movement rather than a bar stuck at 80. Asking about a job costs nothing
 * against the daily allowance (see the function).
 */
async function followDocumentJob(params: {
  url: string;
  token: string;
  job: string;
  started: number;
  progress: (pct: number) => void;
}): Promise<ConversionResult> {
  const ask = (kind: "document-status" | "document-result") =>
    fetch(params.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kind, job: params.job }),
    });

  const fail = (code?: string): ConversionResult => ({
    success: false,
    processingMs: Date.now() - params.started,
    error: messageFor(code, 422),
  });

  while (Date.now() - params.started < JOB_GIVE_UP_MS) {
    const response = await ask("document-status");
    if (response.status === 404) return fail("expired");
    if (!response.ok && response.status !== 409) return fail();
    const state = (await response.json().catch(() => ({}))) as {
      state?: string;
      pages_done?: number;
      pages_total?: number;
      code?: string;
    };

    if (state.state === "failed") return fail(state.code);
    if (state.state === "done") {
      const result = await ask("document-result");
      if (!result.ok) return fail();
      const blob = await result.blob();
      params.progress(100);
      return {
        success: true,
        resultUrl: URL.createObjectURL(blob),
        resultSize: blob.size,
        processingMs: Date.now() - params.started,
      };
    }

    const total = state.pages_total ?? 0;
    if (total > 0) params.progress(30 + Math.round(((state.pages_done ?? 0) / total) * 65));
    await new Promise((resolve) => setTimeout(resolve, JOB_POLL_MS));
  }
  return fail("timeout");
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
  /** "document" sends the file to the document engine; omitted means audio, video or image. */
  kind?: "document";
  options?: Record<string, string | number | boolean>;
  onProgress?: (pct: number) => void;
}): Promise<ConversionResult> {
  const started = Date.now();
  const progress = params.onProgress ?? (() => {});

  const sourceFormat = params.file.name.split(".").pop()?.toLowerCase() ?? "";
  const producible = params.kind === "document"
    ? serverCanConvertDocument(sourceFormat, params.target)
    : serverCanProduce(params.target);
  if (!producible) {
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
      body: JSON.stringify({
        file: encoded,
        target: params.target,
        ...(params.kind === "document" ? { kind: "document", from: sourceFormat } : {}),
        ...(params.options ?? {}),
      }),
    });
    // A long PDF read by eye: accepted, and being read in the background. Follow
    // the job here, with real progress, rather than hold one request open.
    if (response.status === 202) {
      const accepted = (await response.json().catch(() => ({}))) as { job?: string };
      if (typeof accepted.job !== "string") {
        return { success: false, processingMs: Date.now() - started, error: messageFor(undefined, 502) };
      }
      return await followDocumentJob({
        url: `${base}/file-convert`,
        token: session.access_token,
        job: accepted.job,
        started,
        progress,
      });
    }
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
