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
