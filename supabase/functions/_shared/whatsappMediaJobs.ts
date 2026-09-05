// When a conversion is worth retrying, and what the sender is told meanwhile.
//
// The queue itself is SQL — `20261007000000_whatsapp_media_jobs.sql` — because
// claiming a job atomically is a database problem and `FOR UPDATE SKIP LOCKED`
// is the answer to it. What lives here is the part that is a *decision*: this
// failure will pass and that one will not, this sender is waiting and should be
// told so, and this job has been retried enough. Those are pure functions, so
// the suite can enumerate every error code the service can produce rather than
// exercising a queue to find out what happens to one of them.
//
// ── Why "retryable" is a small list and not a large one ─────────────────────
//
// A retry of a video transcode costs the box ninety seconds of four dedicated
// cores it shares with the website. Retrying something that will fail again is
// not a wasted request, it is ninety seconds of the website being slower for
// everybody, three times. So the default is *not* to retry, and a code earns
// its place on the list by being about the moment rather than about the file.

import { say } from "./whatsappStrings.ts";
import type { Language } from "./whatsappCatalog.ts";

/**
 * How long a worker owns a job.
 *
 * Comfortably past the processing service's own video ceiling of 90 s plus the
 * download and the upload around it. Too short and a job that is still running
 * is claimed by a second worker and done twice; too long and a worker that died
 * strands its job for that whole time. Three minutes is the first number that
 * cannot be reached by a healthy run.
 */
export const LEASE_SECONDS = 180;

/**
 * How many times a job may be claimed.
 *
 * Three, and it is a ceiling rather than a target: most failures here are not
 * retried at all. It exists for the case a lease expires because a worker was
 * killed mid-run — which costs an attempt without anything having gone wrong
 * with the job itself.
 */
export const MAX_ATTEMPTS = 3;

/** How long a finished row is kept, and how long a stuck one waits. */
export const JOB_TTL_HOURS = 24;

/**
 * The failures that are about the moment rather than about the file.
 *
 *   busy      the service was already running two jobs and said come back
 *   timeout   it did not finish inside its deadline
 *   network   the request never arrived, or the answer never came back
 *   upstream  Meta would not hand over the file, or would not take it back
 *
 * Everything else describes the file or the request, and describes it the same
 * way on the third attempt as on the first: an unsupported target, an option
 * that is not on the allowlist, bytes no demuxer can open, an output past the
 * ceiling, an ffmpeg that produced nothing. Retrying those spends the box's
 * cores to arrive at the sentence it already had.
 */
export const RETRYABLE_ERRORS = ["busy", "timeout", "network", "upstream"] as const;

export type JobStatus = "queued" | "running" | "done" | "failed";

export const isRetryable = (code: string | null | undefined): boolean =>
  typeof code === "string" && (RETRYABLE_ERRORS as readonly string[]).includes(code);

/**
 * Where a job goes after an attempt.
 *
 * `attempts` is the count *including* the attempt that just happened, which is
 * what the claim returns — so a job on its third attempt has no road left even
 * if the failure was the retryable kind.
 */
export function nextStatus(params: {
  errorCode: string | null | undefined;
  attempts: number;
  maxAttempts?: number;
}): JobStatus {
  const { errorCode, attempts, maxAttempts = MAX_ATTEMPTS } = params;
  if (!errorCode) return "done";
  if (!isRetryable(errorCode)) return "failed";
  return attempts >= maxAttempts ? "failed" : "queued";
}

/**
 * Whether the sender is owed a message about this outcome.
 *
 * A job going back into the queue is not news: the sender was already told the
 * work is happening, and "still working on it" three times is three
 * notifications that say nothing. They hear from this feature exactly twice —
 * once when it starts, once when it ends, either way.
 */
export const shouldTellSender = (status: JobStatus): boolean =>
  status === "done" || status === "failed";

/**
 * What a sender is told while the work happens.
 *
 * Sent from the webhook, inside the delivery, so it is the thing that answers
 * Meta promptly and stops the redelivery this whole queue exists to prevent.
 */
export const queuedNotice = (language: Language): string => say("mediaJobQueued", language);

/**
 * What a sender is told when it could not be done.
 *
 * One sentence, no code, no exit status, no mention of ffmpeg. The technical
 * detail is in the job row and the service's logs, where somebody who can act
 * on it will look; a person holding a phone can act on "the format may not be
 * supported, or the file may be damaged" and cannot act on anything else this
 * system knows.
 */
export const failedNotice = (language: Language): string => say("mediaJobFailed", language);

/**
 * The options a job carries, as the query string the service expects.
 *
 * Built here rather than in the worker so the one place that knows what a job
 * row means is the one place that turns it into a request — and so the suite
 * can check that a row cannot express anything the service would refuse.
 * Values are not validated here on purpose: the service holds the allowlist,
 * this is a caller, and a second copy of an allowlist is a second thing to keep
 * in step with the first.
 */
export function jobQuery(job: { target: string; options?: Record<string, unknown> | null }): string {
  const params = new URLSearchParams({ to: job.target });
  for (const [key, value] of Object.entries(job.options ?? {})) {
    if (value === null || value === undefined) continue;
    // Booleans travel as the `1` the service reads, and everything else as its
    // own text. Anything stranger than a string, number or boolean is a row
    // somebody hand-edited, and it is dropped rather than stringified into
    // `[object Object]` and sent.
    if (typeof value === "boolean") {
      if (value) params.set(key, "1");
    } else if (typeof value === "string" || typeof value === "number") {
      params.set(key, String(value));
    }
  }
  return params.toString();
}
