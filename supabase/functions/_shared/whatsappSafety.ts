// The guards that have to hold when something upstream is hostile or broken.
//
// Four separate jobs live here because they share one property: each is a rule
// that must be impossible to get wrong by forgetting it somewhere, so each is a
// function every caller goes through rather than a habit every caller keeps.
//
//   sanitiseError    A provider's error body can quote the prompt back, and the
//                    prompt contains the customer's message. This repository is
//                    public and its CI logs are world-readable. So an error
//                    becomes a normalised code and, if it had one, a status
//                    number — never a message, never a body, never a stack.
//
//   graphemes        A reply is cut into WhatsApp-sized pieces by counting.
//                    Counting UTF-16 units cuts an emoji in half and detaches
//                    an Arabic combining mark from its letter, and half a
//                    grapheme is not a character — it is a replacement box, or
//                    a mark that reattaches to the wrong letter in the next
//                    message. The whole audience for this channel meets that
//                    through a screen reader, which reads it as nothing at all.
//
//   boundText        Every string that reaches a model or a provider is cut to
//                    a named ceiling, so no single field can be the one that
//                    was not bounded.
//
//   selectionScope   A tapped id belongs to exactly one interaction. A language
//                    row is not a feature, a gender row is not a feature, and
//                    an id from neither is not anything. Classifying them is
//                    what lets the router refuse rather than guess.
//
// Pure: no `Deno`, no fetch, no database, no catalog. Every rule here is a
// function of its arguments, which is what lets the suite drive the real ones.

// ── Errors ───────────────────────────────────────────────────────────────────

/** What is safe to say about a failure, in a log anybody may read. */
export interface SafeError {
  /** A normalised, enumerated label. Never text that came from a provider. */
  code: SafeErrorCode;
  /** The HTTP status, when the error carried one. `0` when it did not. */
  status: number;
}

export type SafeErrorCode =
  | "timeout"
  | "aborted"
  | "rate_limited"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "bad_request"
  | "upstream_error"
  | "transport_error"
  | "database_error"
  | "unknown";

/**
 * Whether this came from the database layer.
 *
 * Two shapes, both of which are codes rather than prose: Postgres answers with
 * a five-character SQLSTATE (`23505` for a unique violation, which this webhook
 * relies on for deduplication), and PostgREST answers with its own `PGRST` code
 * (`PGRST205` for a missing table). Matching the code rather than the message
 * is the point — the message quotes the failing statement.
 */
const isDatabaseError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string") return false;
  return /^[0-9A-Z]{5}$/.test(code) || /^PGRST[0-9]{3}$/.test(code);
};

const statusOf = (error: unknown): number => {
  const candidate = (error as { status?: unknown; statusCode?: unknown } | null);
  const status = candidate?.status ?? candidate?.statusCode;
  return typeof status === "number" && Number.isFinite(status) ? status : 0;
};

const nameOf = (error: unknown): string => {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === "string" ? name : "";
};

/**
 * Everything that is safe to know about a failure.
 *
 * Deliberately lossy. The temptation is always to keep `error.message` "just
 * for debugging", and that message is exactly where a provider echoes the
 * request it rejected — which on this channel is somebody's question, their
 * name, or the contents of a document they photographed. The status number and
 * a label are enough to tell a rate limit from a bad key from a provider that
 * is down, which is the whole of what a log is for here.
 *
 * The classification is derived from the status first, because a status is a
 * number the provider chose from a fixed list, and only then from the error's
 * `name`, which is set by the runtime rather than by a response body.
 */
export function sanitiseError(error: unknown): SafeError {
  const status = statusOf(error);
  const name = nameOf(error);

  if (name === "AbortError") return { code: "aborted", status };
  if (name === "TimeoutError" || name.toLowerCase().includes("timeout")) return { code: "timeout", status };

  if (status === 429) return { code: "rate_limited", status };
  if (status === 401) return { code: "unauthorized", status };
  if (status === 403) return { code: "forbidden", status };
  if (status === 404) return { code: "not_found", status };
  if (status >= 400 && status < 500) return { code: "bad_request", status };
  if (status >= 500) return { code: "upstream_error", status };

  if (isDatabaseError(error)) return { code: "database_error", status };
  if (name === "TypeError") return { code: "transport_error", status };
  if (error instanceof Error) return { code: "unknown", status };
  return { code: "unknown", status };
}

/** The one-line form, for a `console.error` that must carry nothing else. */
export const describeError = (error: unknown): string => {
  const safe = sanitiseError(error);
  return safe.status ? `${safe.code}/${safe.status}` : safe.code;
};

// ── Graphemes ────────────────────────────────────────────────────────────────

/**
 * Whether the runtime can segment text properly.
 *
 * `Intl.Segmenter` is the only thing that knows an emoji with a skin-tone
 * modifier, a family emoji and an Arabic letter with its vowel mark are each
 * one character to the person reading them. Deno and every modern browser have
 * it; the fallback below is code points, which is still never wrong in the way
 * that matters — it cannot split a surrogate pair — and is only imprecise about
 * how many characters a combining sequence counts as.
 */
const SEGMENTER: { segment(input: string): Iterable<{ segment: string }> } | null = (() => {
  const intl = (globalThis as { Intl?: { Segmenter?: new (locale?: string, options?: unknown) => {
    segment(input: string): Iterable<{ segment: string }>;
  } } }).Intl;
  if (!intl?.Segmenter) return null;
  try {
    return new intl.Segmenter(undefined, { granularity: "grapheme" });
  } catch {
    return null;
  }
})();

/** One string as the characters a reader would count. */
export function graphemes(text: string): string[] {
  const value = text ?? "";
  if (!SEGMENTER) return [...value];
  const out: string[] = [];
  for (const piece of SEGMENTER.segment(value)) out.push(piece.segment);
  return out;
}

/** How many characters a reader would count. Never a UTF-16 unit count. */
export const graphemeLength = (text: string): number => graphemes(text).length;

/**
 * The first `limit` characters, whole ones only.
 *
 * The one function every cut in this channel goes through. A cut made by
 * `String.slice` is a cut made in UTF-16 units, and the tail of a surrogate
 * pair arriving on its own is what a reader's screen shows as a black diamond
 * and what a screen reader announces as silence.
 */
export function sliceGraphemes(text: string, limit: number): string {
  if (limit <= 0) return "";
  const units = graphemes(text);
  return units.length <= limit ? (text ?? "") : units.slice(0, limit).join("");
}

/**
 * The longest prefix that fits in `maxUnits` UTF-16 units and ends on a
 * character boundary.
 *
 * ── Why this and not `sliceGraphemes` ───────────────────────────────────────
 *
 * The two answer different questions and the splitters need this one. Meta's
 * ceilings — 4096 on a message, 24 on a row title — are counted in the units
 * `String.length` returns, so "the first 3,500 characters" as a reader counts
 * them can be fourteen thousand units of emoji and be rejected outright.
 *
 * So the ceiling stays exactly what it was, and only the *cut* changes: take
 * the ceiling in units, then move backwards to the nearest boundary. Never
 * forwards, which could push it back over.
 *
 * `sliceGraphemes` remains right where the limit really is a count of
 * characters — a row title a person reads, a passage quoted to a model.
 */
export const clampUnits = (text: string, maxUnits: number): string => {
  const value = text ?? "";
  if (value.length <= maxUnits) return value;
  return value.slice(0, safeCut(value, maxUnits));
};

/**
 * Whether cutting here would land inside a character.
 *
 * Used by the splitters to move a boundary they found by counting back onto a
 * boundary a reader would recognise.
 */
export function isGraphemeBoundary(text: string, index: number): boolean {
  if (index <= 0) return true;
  if (index >= (text ?? "").length) return true;
  let seen = 0;
  for (const unit of graphemes(text)) {
    if (seen === index) return true;
    if (seen > index) return false;
    seen += unit.length;
  }
  return seen === index;
}

/**
 * The nearest cut at or before `index` that does not land inside a character.
 *
 * Moves backwards, never forwards: a splitter has already decided this much
 * fits, and moving forward could push a message over the ceiling that made it
 * split in the first place.
 */
export function safeCut(text: string, index: number): number {
  if (index <= 0) return 0;
  const value = text ?? "";
  if (index >= value.length) return value.length;
  let seen = 0;
  let last = 0;
  for (const unit of graphemes(value)) {
    if (seen > index) break;
    last = seen;
    if (seen === index) return seen;
    seen += unit.length;
  }
  return last;
}

// ── Bounding what reaches a provider ─────────────────────────────────────────

/**
 * Characters of assembled system prompt handed to a provider.
 *
 * Every part of it is bounded on its own — the assistant's own prompt is a
 * constant, the persona is three short fields, the catalog list is the catalog,
 * the grounding has its own budget — and this is the bound on their sum, which
 * is the number that actually reaches the wire. A prompt is charged for and a
 * prompt that has quietly doubled is a bill nobody noticed.
 */
export const MAX_SYSTEM_PROMPT_CHARS = 24_000;

/** Characters of rolling summary replayed as background. */
export const MAX_SUMMARY_CHARS = 2_000;

/** Characters of any single replayed turn. */
export const MAX_TURN_CHARS = 4_000;

/** Characters accepted back from a provider before the rest is discarded. */
export const MAX_PROVIDER_RESPONSE_CHARS = 24_000;

/**
 * Strip what nobody typed and nothing needs.
 *
 * Control characters carry no meaning a person intended and are the standard
 * way to hide text from whoever reviews it while leaving it perfectly legible
 * to a tokeniser. Bidirectional overrides do the same to a human reader.
 * Newline, tab and carriage return survive: a deliberately formatted message is
 * still a message.
 *
 * Written as a loop over code points rather than a regex so the source of this
 * file contains no literal control characters of its own.
 */
export function stripInvisible(text: string): string {
  let out = "";
  for (const character of text ?? "") {
    const point = character.codePointAt(0) ?? 0;
    if (point < 0x20 && point !== 0x09 && point !== 0x0a && point !== 0x0d) continue;
    if (point === 0x7f) continue;
    if (point >= 0x200b && point <= 0x200f) continue;
    if (point >= 0x202a && point <= 0x202e) continue;
    if (point >= 0x2066 && point <= 0x2069) continue;
    if (point === 0xfeff) continue;
    out += character;
  }
  return out;
}

/** One field, stripped and cut to its ceiling. The cut is grapheme-safe. */
export const boundText = (text: string | null | undefined, limit: number): string =>
  sliceGraphemes(stripInvisible((text ?? "").trim()), limit);

/**
 * Assemble a system prompt and bound the whole of it.
 *
 * Parts are kept in order and whole — a prompt truncated in the middle of the
 * catalog list would hand the model half a catalog and no indication that it
 * was half — until one does not fit, and that one is cut. The ordering is the
 * caller's, and the caller puts the rules first and the retrieved material
 * last, so what is lost under pressure is reference material rather than a rule.
 */
export function boundSystemPrompt(
  parts: readonly (string | null | undefined)[],
  limit = MAX_SYSTEM_PROMPT_CHARS,
): string {
  const kept: string[] = [];
  let used = 0;

  for (const part of parts) {
    // Stripped as well as bounded. A directive assembled from a database row —
    // the catalog's own titles are translated strings, the grounding is
    // retrieved prose — can carry an invisible character that this is the last
    // chance to remove before it reaches a provider.
    const text = stripInvisible((part ?? "").trim());
    if (!text) continue;
    const separator = kept.length > 0 ? 2 : 0;
    const remaining = limit - used - separator;
    if (remaining <= 0) break;
    if (graphemeLength(text) <= remaining) {
      kept.push(text);
      used += text.length + separator;
      continue;
    }
    // Only worth keeping a fragment if it is long enough to still say
    // something; a forty-character stub of a directive is noise in a prompt.
    if (remaining > 400) kept.push(sliceGraphemes(text, remaining));
    break;
  }

  return kept.join("\n\n");
}

// ── Which interaction a tapped id belongs to ─────────────────────────────────

/**
 * The longest id this channel will look at.
 *
 * Meta's own ceiling for a row id is 200 characters, and everything this
 * channel issues is far shorter. A longer one did not come from a message this
 * channel sent, so there is nothing to resolve and nothing to apologise for.
 */
export const MAX_SELECTION_ID_CHARS = 200;

/**
 * What a tapped id is for.
 *
 *   control   Back and Main menu. Never a feature; resolved before the catalog.
 *   catalog   A feature or submenu row.
 *   language  A row from the language list, or its page turn.
 *   profile   A gender or country row from onboarding.
 *   malformed Oversized, empty, or carrying characters this channel never issues.
 *   unknown   Well-formed and belonging to none of the above.
 *
 * The point of naming the last three is that they must never reach the feature
 * gate. A language row arriving while somebody is standing in a menu is not a
 * feature that has moved — it is a row from a different conversation entirely,
 * and answering it with "that option has moved" is at least honest, where
 * resolving it as a feature would be a bug with a security shape.
 */
export type SelectionScope = "control" | "catalog" | "language" | "profile" | "malformed" | "unknown";

/** Ids this channel issues are ASCII words, dots, colons, hyphens and digits. */
const ID_SHAPE = /^[A-Za-z0-9._:-]+$/;

/**
 * The prefixes the non-catalog interactions use.
 *
 * Written out here rather than imported, and for the same reason the trusted
 * source list is: this module must stay free of every other WhatsApp module or
 * it cannot be the thing they all import. `whatsapp-security.test.ts` asserts
 * each of these equals the constant its own module exports, so a rename over
 * there fails the build rather than quietly reclassifying a language row as a
 * feature id.
 */
export const CONTROL_SELECTION_IDS: readonly string[] = ["back", "main_menu"];
export const LANGUAGE_SELECTION_PREFIX = "language.";
export const PROFILE_SELECTION_PREFIXES: readonly string[] = ["gender.", "country."];

export function selectionScope(id: string | null | undefined): SelectionScope {
  const value = (id ?? "").trim();
  if (!value) return "malformed";
  if (value.length > MAX_SELECTION_ID_CHARS) return "malformed";
  if (!ID_SHAPE.test(value)) return "malformed";

  if (CONTROL_SELECTION_IDS.includes(value)) return "control";
  if (value.startsWith(LANGUAGE_SELECTION_PREFIX)) return "language";
  if (PROFILE_SELECTION_PREFIXES.some((prefix) => value.startsWith(prefix))) return "profile";
  return "catalog";
}
