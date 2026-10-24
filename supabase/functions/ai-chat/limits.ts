// Bounds on what one ai-chat request may cost.
//
// The client sends the whole conversation every turn, so the history is
// trimmed from the oldest end rather than refused: a long, legitimate chat
// keeps working with the recent context it actually needs.

export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_CHARS = 8_000;
export const MAX_TOTAL_CHARS = 32_000;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type BoundResult =
  | { ok: true; messages: ChatTurn[]; earlier: string }
  | { ok: false; error: string };

/** Characters of digest kept for turns that no longer fit the window. */
export const MAX_EARLIER_CHARS = 1_500;

/**
 * What was dropped from the old end, as one line per question the user asked.
 *
 * Trimming used to forget silently, so a long chat lost the thing the user
 * was working on. The user's own words are the cheapest faithful record of
 * it; the assistant's long answers are not kept. Returned as plain text for
 * the caller to place inside an untrusted-context block.
 */
export function digestEarlier(dropped: ChatTurn[]): string {
  const lines: string[] = [];
  let used = 0;
  for (const turn of dropped) {
    if (turn.role !== "user") continue;
    const line = `- ${turn.content.replace(/\s+/g, " ").trim().slice(0, 140)}`;
    if (line.length <= 2) continue;
    if (used + line.length > MAX_EARLIER_CHARS) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

/**
 * Validates and trims a conversation. Only "user" and "assistant" roles
 * survive: anything else a caller sends — "system" included — is treated as
 * the user speaking, never as an instruction.
 */
export function boundMessages(input: unknown): BoundResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "Messages array is required" };
  }
  const turns: ChatTurn[] = [];
  for (const item of input) {
    const content = (item as { content?: unknown } | null)?.content;
    if (typeof content !== "string") {
      return { ok: false, error: "Each message must have text content" };
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: `A message can be at most ${MAX_MESSAGE_CHARS} characters` };
    }
    const role = (item as { role?: unknown }).role === "assistant" ? "assistant" : "user";
    turns.push({ role, content });
  }

  let kept = turns.slice(-MAX_MESSAGES);
  let total = kept.reduce((sum, turn) => sum + turn.content.length, 0);
  while (kept.length > 1 && total > MAX_TOTAL_CHARS) {
    total -= kept[0].content.length;
    kept = kept.slice(1);
  }
  // A model call must start with the user; drop a leading assistant turn.
  while (kept.length > 1 && kept[0].role === "assistant") kept = kept.slice(1);
  return { ok: true, messages: kept, earlier: digestEarlier(turns.slice(0, turns.length - kept.length)) };
}

// One implementation for every function that meters callers.
export { callerAddress, callerHash } from "../_shared/securityGuard.ts";
