// Answering exactly once, even when something goes wrong halfway.
//
// ── The failure this exists to fix ──────────────────────────────────────────
//
// Deduplication has always worked by inserting the inbound message with Meta's
// id on a unique index. A redelivery collides, the collision is caught, and the
// message is skipped. That is correct, and it is what stops a Meta retry
// becoming a second transcription, a second model call and a second reply.
//
// But the claim is taken *before* the work, and until now nothing recorded
// whether the work finished. So a delivery that died in the middle — a provider
// hanging past the platform's wall clock, an isolate recycled, an uncaught
// throw — left the row inserted and the customer unanswered. Meta then
// redelivered, the insert collided, and the retry was discarded as a duplicate.
// The one mechanism that exists to make retries safe was also the mechanism
// that made the retry useless.
//
// For a blind customer this is the worst failure mode in the system: not a
// wrong answer, not an error message, but silence. There is nothing on screen
// to reread and nothing to tell them whether to wait or send it again.
//
// ── The fix, and why it is deterministic ────────────────────────────────────
//
// The claim now records a state and a time. A redelivery reads them and gets
// one of three answers, from a pure function of (row, clock):
//
//   done         The work finished. This really is a duplicate. Skip it — which
//                is exactly the old behaviour, and the common case.
//   in flight    Another delivery is working on it right now, and has been for
//                less than the recovery window. Skip it, or two isolates answer
//                the same question twice.
//   recover      Claimed, unfinished, and older than the window. Nobody is
//                coming back for it. Reprocess.
//
// No timers, no queue, no background job. The decision is made by whichever
// redelivery arrives, from two columns, and it is the same decision every time
// for the same inputs — which is what makes it testable without a database.
//
// The recovery window is longer than every deadline in the system put together,
// so "still running" is never mistaken for "abandoned".
//
// Pure: no `Deno`, no fetch, no database.

/**
 * How long a claim may be held before a redelivery may take it over.
 *
 * Must exceed the worst honest case, or a slow-but-working delivery would be
 * duplicated by its own retry — which is the bug this fixes, in reverse and
 * costing money. The slowest legitimate path is transcription, then retrieval,
 * then the model, then synthesis, in series; ninety seconds is comfortably past
 * their combined deadlines and comfortably inside the window in which somebody
 * is still waiting for an answer.
 */
export const RECOVERY_AFTER_MS = 90_000;

/** What a claim is doing. Written to `whatsapp_messages.processing_state`. */
export type ProcessingState = "processing" | "done";

/** The columns a redelivery reads to decide what to do. */
export interface ClaimRow {
  processing_state?: string | null;
  processing_started_at?: string | null;
}

export type ClaimDecision =
  /** The claim is ours. Do the work. */
  | { action: "process"; recovered: false }
  /** An abandoned claim, taken over. Do the work; say so in the log. */
  | { action: "process"; recovered: true }
  /** Finished already. A genuine duplicate. */
  | { action: "skip"; reason: "already_done" }
  /** Another delivery has it, recently. */
  | { action: "skip"; reason: "in_flight" };

/**
 * What to do about a message id that is already claimed.
 *
 * ── The three unknowns, all resolved towards answering ──────────────────────
 *
 * A row written before this column existed has no state at all. It is almost
 * certainly finished — it is in the transcript and predates this release — but
 * "almost certainly" is doing the work there, and the two failure modes are not
 * symmetrical. Treating a finished message as unfinished sends a second answer;
 * treating an unfinished one as finished sends none. A second answer is
 * embarrassing, silence is the failure this whole module is about, so an
 * unreadable state is only reprocessed once it is *also* older than the window
 * — by which point nothing is in flight and a duplicate cannot happen.
 *
 * An unparseable timestamp is treated the same way: unknown age, so not
 * recoverable, so skipped. A row that was claimed and never stamped is not a
 * row this code wrote.
 */
export function claimDecision(row: ClaimRow | null | undefined, nowMs: number): ClaimDecision {
  const state = row?.processing_state ?? null;

  // The finished case, and the one that carries all the traffic.
  if (state === "done") return { action: "skip", reason: "already_done" };

  const startedAt = row?.processing_started_at ? Date.parse(row.processing_started_at) : Number.NaN;
  if (!Number.isFinite(startedAt)) return { action: "skip", reason: "in_flight" };

  const age = nowMs - startedAt;
  // A claim stamped in the future is a clock disagreement, not an abandonment.
  if (age < RECOVERY_AFTER_MS) return { action: "skip", reason: "in_flight" };

  // Old, and either explicitly `processing` or from before this column existed.
  // Either way nobody is coming back for it.
  return { action: "process", recovered: true };
}

/** The first claim on a message id, when the insert succeeded. */
export const freshClaim = (): ClaimDecision => ({ action: "process", recovered: false });

// ── Deadlines ────────────────────────────────────────────────────────────────

/** Thrown only inside this file, and never seen outside it. */
class Deadline extends Error {
  constructor() {
    super("deadline exceeded");
    this.name = "TimeoutError";
  }
}

/**
 * Run something with a wall clock on it.
 *
 * ── Why every provider call needs one ───────────────────────────────────────
 *
 * Meta redelivers a webhook that does not answer promptly. So an unbounded wait
 * does not eventually succeed — it produces a second copy of the same message,
 * which is more work, not less. The assistant call and retrieval already had
 * deadlines; classification, the rolling summary and the handover briefing did
 * not, and each of those is a provider call that can hang.
 *
 * Returns `null` rather than throwing, because every caller's answer to "that
 * did not finish in time" is the same: carry on without it. A classification is
 * a label, a summary is an optimisation, a briefing has a fallback. None of
 * them is the reply, and none of them may cost the reply.
 *
 * The `catch` swallows failures as well as timeouts, deliberately: a caller
 * that wanted to distinguish them would have to handle the difference, and
 * there is no difference to handle here.
 */
export async function withDeadline<T>(
  work: () => Promise<T>,
  timeoutMs: number,
  onFailure?: (error: unknown, timedOut: boolean) => void,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Deadline()), timeoutMs);
    });
    return await Promise.race([work(), deadline]);
  } catch (error) {
    onFailure?.(error, error instanceof Deadline);
    return null;
  } finally {
    // The timer holds the isolate awake otherwise, which on an edge runtime is
    // billed time doing nothing.
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * How long each secondary provider call may take.
 *
 * All three are things the reply does not depend on, so they are held to much
 * tighter clocks than the answer itself. A classification that takes eight
 * seconds has cost more than the label is worth.
 */
export const CLASSIFY_TIMEOUT_MS = 8_000;
export const SUMMARY_TIMEOUT_MS = 12_000;
export const BRIEFING_TIMEOUT_MS = 12_000;

// ── Never sending nothing, and never sending it twice ────────────────────────

/**
 * Whether there is actually something to send.
 *
 * WhatsApp rejects an empty message outright, so an empty body is not a quiet
 * no-op — it is a failed send, a logged error, and a customer who got no reply
 * to a question the assistant thought it had answered. Whitespace-only counts
 * as empty: a message containing one newline is a blank bubble.
 */
export const isSendable = (body: string | null | undefined): boolean =>
  typeof body === "string" && body.trim().length > 0;

/**
 * Whether this reply is the same one that just went out.
 *
 * Belt and braces on top of deduplication. Deduplication stops the same
 * *inbound* message being answered twice; this stops one delivery sending the
 * same words twice — a split answer whose parts collapsed to one, a notice sent
 * by two branches that both thought they owned the message. Compared on the
 * trimmed text, because two bodies differing only in trailing whitespace are
 * the same message to whoever receives them.
 */
export const isRepeatOf = (body: string, previous: string | null): boolean =>
  previous !== null && body.trim() === previous.trim();
