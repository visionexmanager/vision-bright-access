/**
 * A deterministic, offline first line of defense for kids chat — runs
 * entirely client-side before a message is ever sent, so it works even if
 * the AI moderation edge function (which fails OPEN on a provider outage —
 * see supabase/functions/moderate-content) is unavailable. This is NOT a
 * substitute for real content-safety infrastructure at scale (the word
 * list here is a small, illustrative starter set, not a maintained
 * production list) — it's the deterministic layer that a real one would
 * sit behind, kept intentionally simple and easy to extend.
 */

// Deliberately small and mild — a real deployment would swap this for a
// maintained, regularly-updated list (and likely a managed service).
const BLOCKED_WORDS = [
  "damn", "hell", "stupid", "idiot", "dumb", "shut up", "hate you",
  "kill", "die", "sex", "sexy", "naked", "drugs", "gun", "weapon",
];

// PII patterns that get fully redacted, not just flagged — kids should
// never be able to accidentally paste this into a chat.
const PII_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: "phone number" },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "email address" },
  { pattern: /\b\d{1,5}\s+([A-Za-z]+\s){1,4}(street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard)\b/gi, label: "address" },
];

// Phrases that indicate a real safety risk (grooming red flags) — these
// block the message outright rather than just redacting a word.
const BLOCKED_PHRASES = [
  /\bmeet\s+(me|up)\s+in\s+person\b/i,
  /\bwhat'?s?\s+your\s+(address|phone\s*number|school\s*name)\b/i,
  /\bdon'?t\s+tell\s+your\s+(parents?|mom|dad)\b/i,
  /\bsend\s+(me\s+)?a\s+(photo|picture|pic)\s+of\s+yourself\b/i,
];

export interface ModerationResult {
  cleanText: string;
  wasFiltered: boolean;
  blocked: boolean;
  blockedReason?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function moderateKidsText(rawText: string): ModerationResult {
  let text = rawText;
  let wasFiltered = false;

  for (const phrase of BLOCKED_PHRASES) {
    if (phrase.test(text)) {
      return { cleanText: "", wasFiltered: true, blocked: true, blockedReason: "unsafe_request" };
    }
  }

  for (const { pattern } of PII_PATTERNS) {
    if (pattern.test(text)) {
      wasFiltered = true;
      text = text.replace(pattern, "[hidden]");
    }
  }

  for (const word of BLOCKED_WORDS) {
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    if (re.test(text)) {
      wasFiltered = true;
      text = text.replace(re, (match) => "*".repeat(match.length));
    }
  }

  return { cleanText: text, wasFiltered, blocked: false };
}
