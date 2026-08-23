// What a feature is doing right now, in seven words that every feature shares.
//
//   idle       - open, waiting, nothing owed to anybody
//   input      - waiting for the sender to send the thing
//   processing - work is running that the sender cannot see
//   success    - it worked, and they have the answer
//   empty      - it worked and found nothing, which is not a failure
//   error      - it did not work, and they have been told so kindly
//   cancelled  - they stopped it
//
// The AI assistant already has its own six states, named for what they mean to
// *it* — AI_TEXT_INPUT is more useful to that feature than "input". They are
// not replaced here. What this adds is a shared vocabulary underneath them, so
// the webhook, the logs and the next five features can ask "is anything running
// for this person?" without knowing which feature is running it.
//
// The rule the whole file exists for: **processing is never a resting place.**
// Every path out of it lands on success, empty, error or cancelled, and a
// processing step older than its budget is treated as stuck and cleared. A
// sender who can enter a state and not leave it has been abandoned by the
// software, and they cannot see enough to know it.
//
// Pure: no `Deno`, no fetch, no database, no feature logic.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

export type Lifecycle =
  | "idle"
  | "input"
  | "processing"
  | "success"
  | "empty"
  | "error"
  | "cancelled";

export const LIFECYCLE_PHASES: readonly Lifecycle[] = [
  "idle",
  "input",
  "processing",
  "success",
  "empty",
  "error",
  "cancelled",
];

/** A phase from which nothing more is owed to the sender. */
export const TERMINAL_PHASES: readonly Lifecycle[] = ["success", "empty", "error", "cancelled"];

export const isTerminal = (phase: Lifecycle): boolean => TERMINAL_PHASES.includes(phase);

/**
 * The phase a feature's own step name means.
 *
 * Features name their steps for themselves; this reads those names into the
 * shared vocabulary. Anything a feature invents that is not recognised counts
 * as `input`, which is the safe reading: it means "waiting for them", so
 * nothing is cleaned up underneath a feature that is legitimately waiting.
 */
export function lifecycleOf(step: string | null | undefined): Lifecycle {
  if (!step) return "idle";
  const name = step.toLowerCase();
  if (name.endsWith("processing")) return "processing";
  if (name.endsWith("cancelled") || name.endsWith("canceled")) return "cancelled";
  if (name.endsWith("error") || name.endsWith("failed")) return "error";
  if (name.endsWith("empty")) return "empty";
  if (name.endsWith("success") || name.endsWith("done") || name.endsWith("conversation")) return "success";
  if (name.endsWith("menu") || name.endsWith("idle")) return "idle";
  return "input";
}

/**
 * How long work may run before it is treated as abandoned.
 *
 * Not a timeout on the work itself — each feature owns that, and the provider
 * seam already races its own clock. This is the *state* budget: if a row still
 * says "processing" long after any real request could have finished, the
 * process that set it is gone, and the sender must not be left standing in it.
 */
export const DEFAULT_PROCESSING_BUDGET_MS = 5 * 60_000;

export function isStuck(
  phase: Lifecycle,
  startedAt: string | null | undefined,
  nowMs: number,
  budgetMs = DEFAULT_PROCESSING_BUDGET_MS,
): boolean {
  if (phase !== "processing") return false;
  if (!startedAt) return true;
  const began = Date.parse(startedAt);
  if (!Number.isFinite(began)) return true;
  return nowMs - began > budgetMs;
}

/**
 * Where a feature leaves the sender once the work is over.
 *
 * Interactive features keep the floor: somebody who has just been answered by
 * the assistant is mid-conversation, and dropping them at the main menu would
 * make every question cost three messages. One-shot features hand back to the
 * menu they were opened from, because there is nothing more to say to them.
 *
 * A cancellation is the one case where both agree — the sender asked to stop,
 * so they go back to where they can choose something else.
 */
export function restingPlace(
  phase: Lifecycle,
  options: { interactive: boolean },
): "stay" | "parent_menu" {
  if (!isTerminal(phase)) return "stay";
  if (phase === "cancelled") return "parent_menu";
  return options.interactive ? "stay" : "parent_menu";
}

/**
 * What the sender is told at each phase, or null when the feature's own answer
 * is the message.
 *
 * `success` is null on purpose: the answer *is* the reply, and a "done!" on top
 * of it is a second notification for no new information.
 */
export function lifecycleNotice(phase: Lifecycle, language: Language): string | null {
  switch (phase) {
    case "processing":
      return say("processing", language);
    case "empty":
      return say("emptyResult", language);
    case "error":
      return say("failed", language);
    case "cancelled":
      return say("stoppedWorking", language);
    default:
      return null;
  }
}

/**
 * Whether the work is worth announcing before it starts.
 *
 * A notice on something that answers in two seconds is noise, and on this
 * channel noise costs a notification sound. Features pass whatever signal they
 * have — the length of a question, the size of a file — and a threshold of zero
 * turns announcements off entirely.
 */
export const shouldAnnounce = (weight: number, threshold: number): boolean =>
  threshold > 0 && weight >= threshold;
