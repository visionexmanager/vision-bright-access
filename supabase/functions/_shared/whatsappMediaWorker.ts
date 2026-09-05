// Doing one queued conversion, from the media id to the message that carries
// the result.
//
// ── Why the I/O is handed in ────────────────────────────────────────────────
//
// Four network calls in a row — download from Meta, convert on the VPS, upload
// to Meta, send — and the interesting part is none of them. It is the order,
// what happens when the third one fails after the second succeeded, and which
// failures are worth the box's cores a second time. Every one of those is a
// decision, and a decision that can only be exercised by standing up four
// services is a decision nobody exercises. So the ports are parameters and the
// suite drives them directly.
//
// ── Why there is no scheduler behind this ───────────────────────────────────
//
// `EdgeRuntime.waitUntil` runs this after the webhook has already answered
// Meta, which is the whole point: the delivery returns 200 in milliseconds and
// the ninety seconds happen afterwards, where no redelivery is waiting on them.
// The queue row is what makes that safe rather than reckless — if the runtime is
// torn down mid-job the row keeps its lease, the lease expires, and the next
// delivery to arrive picks it up. This repository deliberately does not use
// pg_net (see `20260929000000_voice_cloning_consent.sql`), and this needs no
// cron at all: the webhook is called often enough to be its own drain.

import { nextStatus, shouldTellSender, jobQuery, type JobStatus } from "./whatsappMediaJobs.ts";
import { translateDocument } from "./whatsappTranslateDoc.ts";

/** A job as the claim hands it back. Only the fields the work needs. */
export interface MediaJob {
  id: string;
  target: string;
  options?: Record<string, unknown> | null;
  source_media_id: string;
  source_mime?: string | null;
  attempts: number;
}

/**
 * What the conversion service answered.
 *
 * One shape with optional halves rather than the discriminated union this
 * obviously wants to be, and that is a deliberate concession to the compiler
 * this repository actually configures: `tsconfig` sets `strict: false` and
 * `strictNullChecks: false`, and without the latter TypeScript widens `ok: true`
 * and `ok: false` to `boolean` and cannot discriminate on them at all. The union
 * version compiles nowhere in this project and fails with an error — "Property
 * 'code' does not exist on type 'ConvertResult'" — that reads like a mistake in
 * the union rather than like a missing compiler flag.
 *
 * So the fields are checked rather than narrowed, which is more typing at the
 * one call site and cannot silently stop working.
 */
export interface ConvertResult {
  ok: boolean;
  /** Set when `ok`. */
  bytes?: Uint8Array;
  mime?: string;
  /** Set when not `ok`. One of the service's refusal codes. */
  code?: string;
}

export interface WorkerPorts {
  /** Meta's media download. `null` means it could not be fetched. */
  download(mediaId: string): Promise<Uint8Array | null>;
  /** The VPS conversion service. */
  convert(bytes: Uint8Array, query: string): Promise<ConvertResult>;
  /** Meta's media upload. Returns the new media id, or null. */
  upload(bytes: Uint8Array, mime: string, filename: string): Promise<string | null>;
  /** Send the converted file to the sender. */
  send(mediaId: string, mime: string, filename: string): Promise<boolean>;
  /** Record how it ended. */
  finish(status: JobStatus, errorCode: string | null): Promise<void>;
  /** One sentence to the sender, when they are owed one. */
  notify(kind: "failed"): Promise<void>;
}

/**
 * What to call the file the sender receives.
 *
 * WhatsApp shows this name, and it is read out by a screen reader before
 * anything else about the attachment — so it has to say what the file is rather
 * than what this system called the job. A uuid would be technically fine and
 * useless to hear.
 *
 * The name carries no part of the sender's own filename. Meta does not give us
 * one for an inbound audio note anyway, and echoing back a name somebody sent is
 * a way to put their text into a field neither end validates.
 */
export function outputFilename(target: string): string {
  return `visionex.${target}`;
}

/**
 * Which kind of WhatsApp message carries this.
 *
 * Audio as `audio` and video as `video` so they play in place, which for
 * somebody using a screen reader is one gesture rather than a download and an
 * app switch. Anything else — a GIF is the case today — travels as a document,
 * because that is the only type Meta will accept for it.
 */
export function messageKindFor(mime: string): "audio" | "video" | "document" {
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/**
 * Run one claimed job to its end.
 *
 * Returns the status it recorded, which is what the caller logs. Never throws:
 * a job that throws is a job whose row stays `running` until its lease expires,
 * and the sender hears nothing at all in the meantime.
 */
export async function runMediaJob(job: MediaJob, ports: WorkerPorts): Promise<JobStatus> {
  let code: string | null = null;

  try {
    const source = await ports.download(job.source_media_id);
    // Meta keeps inbound media for thirty days and this queue's rows for one,
    // so a download that fails is far more likely to be a bad minute than an
    // expired id — which is why `upstream` is on the retryable list.
    if (!source || source.length === 0) code = "upstream";

    if (!code) {
      const converted = await ports.convert(source as Uint8Array, jobQuery(job));
      // Both halves checked, not just the flag. A service that answered `ok`
      // with no bytes is a bug on the other side of a network call, and the
      // honest reading of it here is "nothing came back" rather than an upload
      // of `undefined`.
      if (converted.ok && converted.bytes?.length && converted.mime) {
        const filename = outputFilename(job.target);
        const mediaId = await ports.upload(converted.bytes, converted.mime, filename);
        if (!mediaId) {
          code = "upstream";
        } else if (!await ports.send(mediaId, converted.mime, filename)) {
          // The upload succeeded and the send did not. Retrying re-uploads,
          // which costs a Graph call rather than a transcode — the expensive
          // half is already done and will be done again, and that is accepted:
          // holding a media id across attempts would mean storing it, and the
          // whole design of this queue is that nothing about the file is kept.
          code = "upstream";
        }
      } else {
        code = converted.code ?? "conversion_failed";
      }
    }
  } catch {
    // A code, never the exception. Whatever threw quotes a URL, and that URL
    // carries a media id belonging to somebody's file.
    code = "network";
  }

  const status = nextStatus({ errorCode: code, attempts: job.attempts });
  await ports.finish(status, code);

  // Only at the end, and only once. A job going back into the queue is not
  // news: the sender was already told the work is happening, and "still working
  // on it" three times is three notifications that say nothing.
  if (status === "failed" && shouldTellSender(status)) await ports.notify("failed");

  return status;
}

// ── Translating a document ───────────────────────────────────────────────────
//
// The second thing that cannot happen inside a webhook, and for a sharper
// reason than a transcode: a conversion is one call to ffmpeg, and a
// translation is one provider call per chunk. A PDF is many chunks, so it is
// slower than the thing the queue was built for, not faster.
//
// It shares the queue, the claim, the lease and the sweep. What is different is
// only what happens between the download and the send, so that is all this is.

/** A translation job as the claim hands it back. */
export interface TranslateJob {
  id: string;
  /** The language to translate into, as this channel's own code. */
  target: string;
  source_media_id: string;
  source_mime?: string | null;
  source_filename?: string | null;
  attempts: number;
}

export interface TranslatePorts {
  download(mediaId: string): Promise<Uint8Array | null>;
  /** The words out of the file, or a reason there are none. */
  extract(bytes: Uint8Array, mimeType: string, filename?: string): Promise<
    { ok: boolean; text?: string; reason?: string }
  >;
  /** One chunk. Null means this one did not work. */
  translate(text: string, target: string): Promise<string | null>;
  /** The result as a message, when it is prose. */
  sendText(text: string): Promise<boolean>;
  /** The result as a file, when it is subtitles and must stay one. */
  sendFile(content: string, filename: string, mime: string): Promise<boolean>;
  finish(status: JobStatus, errorCode: string | null): Promise<void>;
  /** One sentence, naming what went wrong in terms the sender can act on. */
  notify(reason: string): Promise<void>;
}

/**
 * What a failed extraction should tell the sender.
 *
 * Each of these needs a different thing from them, which is why they are not
 * one message: a scan needs a photograph of the page — which this assistant
 * reads well — an empty file needs a different file, a protected one needs an
 * unprotected copy, and a format nothing can open needs a different format.
 * Collapsing them into "that didn't work" would leave somebody retrying the
 * one thing that cannot succeed.
 */
export const EXTRACT_FAILURE_REASONS = [
  "scanned_pdf",
  "encrypted_pdf",
  "unsupported_format",
  "empty",
] as const;

/**
 * A translated subtitle file keeps its extension; prose has no file at all.
 *
 * The target is an endonym — "العربية", "中文" — because that is what a model is
 * told to translate into. A filename is not the place for it: WhatsApp shows
 * the name and some clients mangle non-ASCII in one, so anything outside a
 * narrow set is dropped and the name falls back to a word rather than to an
 * empty stem.
 */
export const translatedFilename = (target: string, format: string): string => {
  const stem = (target ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `visionex-${stem || "translated"}.${format}`;
};

/**
 * Run one claimed translation to its end.
 *
 * Never throws, for the reason `runMediaJob` does not: a job that throws is a
 * row stuck at `running` until its lease expires, with the sender hearing
 * nothing at all in the meantime.
 */
export async function runTranslateJob(
  job: TranslateJob,
  ports: TranslatePorts,
): Promise<JobStatus> {
  let code: string | null = null;
  let told = false;

  try {
    const source = await ports.download(job.source_media_id);
    if (!source || source.length === 0) {
      code = "upstream";
    } else {
      const extracted = await ports.extract(
        source,
        job.source_mime ?? "",
        job.source_filename ?? undefined,
      );

      if (!extracted.ok || !extracted.text) {
        // Not retryable and not a mystery: the file is what it is. The sender
        // is told which of the four it was, because each needs a different
        // thing from them.
        const reason = extracted.reason ?? "extract_failed";
        await ports.notify(reason);
        told = true;
        code = reason === "extract_failed" ? "extract_failed" : reason;
      } else {
        const outcome = await translateDocument({
          source: extracted.text,
          translate: (text) => ports.translate(text, job.target),
        });

        if (!outcome.ok || !outcome.output) {
          code = outcome.reason === "too_long" ? "too_long" : "translation_failed";
        } else if (outcome.format) {
          // Subtitles go back as a file, because that is what they are for. A
          // wall of dialogue in a message is not a subtitle track.
          const sent = await ports.sendFile(
            outcome.output,
            translatedFilename(job.target, outcome.format),
            outcome.format === "vtt" ? "text/vtt" : "application/x-subrip",
          );
          if (!sent) code = "upstream";
        } else if (!await ports.sendText(outcome.output)) {
          code = "upstream";
        }
      }
    }
  } catch {
    code = "network";
  }

  const status = nextStatus({ errorCode: code, attempts: job.attempts });
  await ports.finish(status, code);

  // Told once, and only if they have not been told something more useful
  // already. "I couldn't translate this" after "there is no text layer in that
  // PDF" is a second notification that removes information.
  if (status === "failed" && !told && shouldTellSender(status)) {
    await ports.notify(code ?? "translation_failed");
  }

  return status;
}
