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

/**
 * The widest a single character can plausibly be, in UTF-16 units.
 *
 * A family emoji with four people, joiners and skin tones is around twenty-five;
 * this is far past anything real. It is the width of the window every function
 * below segments, which is what keeps their cost proportional to the *cut*
 * rather than to the length of what is being cut.
 */
const WIDEST_CHARACTER = 64;

/**
 * One string as the characters a reader would count.
 *
 * Segments the whole input, so it is only for strings already known to be
 * small — a row title, a window near a cut. Everything that takes an unbounded
 * string goes through the bounded helpers below instead: this used to be called
 * on a 500,000-character provider response, and segmenting that took CI four
 * hundred seconds, which in production is a webhook that never answers and a
 * message Meta redelivers.
 */
export function graphemes(text: string): string[] {
  const value = text ?? "";
  if (!SEGMENTER) return [...value];
  const out: string[] = [];
  for (const piece of SEGMENTER.segment(value)) out.push(piece.segment);
  return out;
}

/**
 * How many characters a reader would count.
 *
 * Bounded: past `max` it stops counting and returns `max + 1`, which is all any
 * caller needs to know — every one of them is asking "does this fit". Counting
 * the rest of a very long string to answer "no, by a lot" is work nobody reads.
 */
export function graphemeLength(text: string, max = Number.MAX_SAFE_INTEGER): number {
  const value = text ?? "";
  // A grapheme is never fewer than one code unit, so this is a sound early out
  // and covers every ordinary string without touching the segmenter at all.
  if (value.length <= max) return graphemes(value).length;
  return measure(value, max + 1).count;
}

/**
 * Walk at most `limit` characters into a string, and report where that lands.
 *
 * ── Why a growing window rather than simply stopping ────────────────────────
 *
 * The obvious implementation iterates the segmenter and breaks at `limit`.
 * That is correct, and it is fast on an engine whose segmenter iterates lazily
 * — Node 24 does, measured at two milliseconds over half a million characters.
 * Node 20 does not, and CI spent forty seconds in exactly that loop.
 *
 * Performance that depends on the engine is not a bound. So the string is cut
 * to a window first, which every engine handles in constant time, and the
 * window grows only if it turned out to be too small. Doubling means the total
 * work is proportional to the final window, and the final window is at most
 * twice the smallest one that could have contained the answer.
 *
 * One cluster more than asked for is consumed, so the last one returned is
 * known to be whole rather than truncated by the window's own edge.
 */
function measure(value: string, limit: number): { units: number; count: number } {
  if (limit <= 0) return { units: 0, count: 0 };

  let width = Math.min(value.length, Math.max(limit * 2, MIN_WINDOW));
  for (;;) {
    const whole = width >= value.length;
    const window = whole ? value : value.slice(0, width);

    let units = 0;
    let count = 0;
    let sawMore = false;
    for (const cluster of clustersOf(window)) {
      if (count >= limit) { sawMore = true; break; }
      units += cluster.length;
      count += 1;
    }

    // Enough characters, and proof that the last one was not cut off by the
    // window; or the window is the whole string and there is no more to find.
    if (whole || sawMore) return { units, count };
    width = Math.min(value.length, width * 2);
  }
}

/** The smallest window worth segmenting. Below this the overhead dominates. */
const MIN_WINDOW = 64;

/** Clusters of an already-bounded string, segmenter or code points. */
function* clustersOf(value: string): Generator<string> {
  if (!SEGMENTER) {
    for (const point of value) yield point;
    return;
  }
  for (const piece of SEGMENTER.segment(value)) yield piece.segment;
}



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
  const value = text ?? "";
  // A grapheme is at least one code unit, so anything this short already fits.
  if (value.length <= limit) return value;
  return value.slice(0, measure(value, limit).units);
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
  const value = text ?? "";
  if (index <= 0) return 0;
  if (index >= value.length) return value.length;

  // Only the neighbourhood of the cut is segmented, never the whole string.
  // A character cannot be wider than `WIDEST_CHARACTER`, so a boundary at or
  // before `index` is certainly inside this window — and the first cluster of
  // the window is discarded because starting mid-character could mis-segment
  // it, which is harmless that far from the cut.
  let start = Math.max(0, index - WIDEST_CHARACTER * 2);
  // Never begin on the tail of a surrogate pair.
  if (start > 0 && isLowSurrogate(value.charCodeAt(start))) start -= 1;

  // ── The one character whose width is not local ──────────────────────────────
  //
  // A flag is two regional indicators, and they pair up from the *start* of the
  // run: 🇯🇴🇺🇸 is two flags, and a window opening one indicator later reads the
  // same bytes as two lone letters and offers a boundary between them. That cut
  // splits a flag in half — no lone surrogate, so the surrogate check never
  // catches it, and a property test against the exact definition is what did.
  //
  // Parity cannot be recovered locally, so the window is opened before the
  // whole run instead. Bounded, because a message of nothing but flags is not a
  // message; past the bound the worst case is a split flag, which is where this
  // started and is still never a broken surrogate.
  let scanned = 0;
  while (start > 0 && scanned < REGIONAL_SCAN_LIMIT && isRegionalIndicatorAt(value, start)) {
    start -= 2;
    scanned += 2;
  }
  if (start < 0) start = 0;

  const window = value.slice(start, Math.min(value.length, index + WIDEST_CHARACTER));
  let at = start;
  let best = start === 0 ? 0 : -1;
  for (const cluster of graphemes(window)) {
    if (at > index) break;
    if (at <= index && (best === -1 ? at > start : true)) best = at;
    at += cluster.length;
  }
  if (at === index && index <= value.length) best = index;
  return best <= 0 ? 0 : best;
}

const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

/** How far back the scan for the start of a flag run will go, in code units. */
const REGIONAL_SCAN_LIMIT = 4_096;

/** Whether a regional indicator (U+1F1E6–U+1F1FF) begins at this offset. */
function isRegionalIndicatorAt(text: string, at: number): boolean {
  if (at < 0 || at + 1 >= text.length) return false;
  const point = text.codePointAt(at);
  return point !== undefined && point >= 0x1f1e6 && point <= 0x1f1ff;
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
 * Strip what nobody typed and nothing needs — and nothing else.
 *
 * Control characters carry no meaning a person intended and are the standard
 * way to hide text from whoever reviews it while leaving it perfectly legible
 * to a tokeniser. The bidirectional *overrides* do the same to a human reader:
 * U+202A–U+202E and the isolates U+2066–U+2069 can make a string display as
 * something other than what it says. Those go, with the zero-width space and
 * the byte-order mark. Newline, tab and carriage return stay: a deliberately
 * formatted message is still a message.
 *
 * ── What is deliberately kept ───────────────────────────────────────────────
 *
 * This class was briefly wider, and the wider version was wrong in a way that
 * mattered to exactly this audience:
 *
 *   U+200C  zero-width non-joiner, required in Persian and Urdu — both of the
 *           twenty languages here. «می‌روم» without it becomes «میروم», which is
 *           a different and incorrect word form.
 *   U+200D  zero-width joiner, which is what holds an emoji together and joins
 *           letters in Indic scripts. Without it 👨‍👩‍👧‍👦 is four separate people.
 *   U+200E  left-to-right mark
 *   U+200F  right-to-left mark, both ordinary in the mixed Arabic-and-Latin
 *           text this audience writes constantly, and neither able to override
 *           anything — they nudge ordering, they do not disguise it.
 *
 * Sanitising a message must not corrupt the message. A guard that quietly
 * rewrites somebody's language is worse than the thing it was guarding against.
 */
const INVISIBLE = new RegExp("[" + "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B\\u202A-\\u202E\\u2066-\\u2069\\uFEFF" + "]", "g");

export function stripInvisible(text: string): string {
  const value = text ?? "";
  // One native pass, and an early out for the overwhelmingly common case of a
  // message containing none of these at all. This was a character-by-character
  // loop building a new string, which on a long provider response is quadratic
  // and was the single slowest thing in this file.
  INVISIBLE.lastIndex = 0;
  return INVISIBLE.test(value) ? value.replace(INVISIBLE, "") : value;
}


/**
 * One field, stripped and cut to its ceiling. The cut is grapheme-safe.
 *
 * ── Code units, deliberately ────────────────────────────────────────────────
 *
 * The ceilings this serves are *size* limits: how much may reach a provider,
 * how much may come back, how much history may be replayed. They stand in for
 * tokens and bytes, not for what a reader counts, so a code-unit count is both
 * the more meaningful measure and a constant-time one.
 *
 * The grapheme rule is a separate promise and is kept by `clampUnits`: never
 * cut *through* a character. That costs an O(1) slice plus a small window at the
 * cut, so nothing here walks the input.
 *
 * `sliceGraphemes` is for the other case — where a limit really is a count of
 * characters somebody reads, like a row title or a passage quoted to a model.
 */
export const boundText = (text: string | null | undefined, limit: number): string =>
  clampUnits(stripInvisible((text ?? "").trim()), limit);

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
    // Code units, matching the ceiling above, and O(1).
    if (text.length <= remaining) {
      kept.push(text);
      used += text.length + separator;
      continue;
    }
    // Only worth keeping a fragment if it is long enough to still say
    // something; a forty-character stub of a directive is noise in a prompt.
    if (remaining > 400) kept.push(clampUnits(text, remaining));
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
