// Fresh facts for the server's own chat model.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The local model (Qwen3-4B) is a fixed file. It cannot browse and its knowledge
// stops at its training date, so on its own it answers a question about this
// week from stale memory, confidently. This module looks the question up first,
// in Wikipedia (open, keyless, edited continuously, in the reader's language),
// and hands the model a few short passages with their last-edit dates. The model
// is also told today's date and to say so when the passages do not settle it.
//
// It never makes the model "learn": nothing is stored, nothing is trained, and
// the next question starts from the same file.
//
// ── What leaves the building ────────────────────────────────────────────────
//
// A search query leaves for wikipedia.org, so it is built, not copied. Messages
// that contain an address, a link, a long number (a phone, a card, an id) or no
// searchable words are never searched. What is sent is at most eight keywords.
// The query is never logged; the log carries only whether a passage was found.
//
// ── Only what matched ───────────────────────────────────────────────────────
//
// Wikipedia's search returns something for nearly any words. A passage is kept
// only when one of the question's keywords appears in its title or text, and the
// result is cut to a few hundred characters: the model reads its prompt at about
// 33 tokens a second, so every extra sentence is seconds of waiting.
//
// Pure apart from the injected `fetch`; the Vitest suite runs under Node.

import { wikipediaLanguage } from "./openResearchSources.ts";
import type { EnvReader } from "./whatsappProcessor.ts";

export const REFERENCE_TIMEOUT_MS = 2_500;
export const MAX_QUERY_WORDS = 8;
export const MAX_PASSAGES = 2;
export const PASSAGE_CHARS = 220;
export const MAX_REFERENCE_CHARS = 460;
const USER_AGENT = "Visionex-Assistant/1.0 (+https://visionex.app)";

const denoEnv: EnvReader = (name) => {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
};

/** The switch for looking things up. Anything but the exact word `on` leaves it off. */
export const localReferenceEnabled = (read: EnvReader = denoEnv): boolean =>
  (read("LOCAL_CHAT_WEB") ?? "").trim().toLowerCase() === "on";

/**
 * Words that carry no topic. Short on purpose: a stop word that slips through
 * only costs a worse query; a topic word wrongly dropped loses the answer. The
 * Arabic list stays above the three-letter floor for the same reason it exists
 * elsewhere in this project: short Arabic function words match everything.
 */
const STOP_WORDS = new Set([
  // English
  "the", "and", "what", "who", "whom", "whose", "when", "where", "why", "how", "which", "are", "was", "were",
  "does", "did", "can", "could", "would", "should", "will", "you", "your", "tell", "about", "please", "give",
  "know", "any", "this", "that", "these", "those", "with", "from", "into", "for", "has", "have", "had", "latest",
  // Arabic
  "ماذا", "متى", "أين", "اين", "كيف", "لماذا", "هل", "على", "عن", "إلى", "الى", "هذا", "هذه", "ذلك", "تلك",
  "كان", "كانت", "يكون", "أخبرني", "اخبرني", "قل", "لي", "حول", "بشأن", "آخر", "اخر",
  // French / Spanish / Turkish
  "les", "des", "une", "est", "sont", "quel", "quelle", "quels", "qui", "que", "quand", "où", "comment", "pourquoi", "dans", "pour",
  "los", "las", "una", "qué", "quién", "cuándo", "dónde", "cómo", "por", "con", "del", "nedir", "kimdir", "nerede", "nasıl", "hangi",
]);

const LETTER_OR_DIGIT = /[\p{L}\p{N}]+/gu;

/**
 * The search words for a question, or null when it must not be searched.
 *
 * Refused outright: an e-mail address, a link, a run of seven or more digits
 * (phones, cards, ids), and anything with fewer than one usable word.
 */
export function buildSearchQuery(question: string): string | null {
  const text = (question ?? "").normalize("NFKC");
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/u.test(text)) return null;
  if (/https?:\/\/|www\./iu.test(text)) return null;
  if (/\d[\d\s().-]{5,}\d/u.test(text) && (text.match(/\d/gu) ?? []).length >= 7) return null;

  const words: string[] = [];
  for (const match of text.toLowerCase().match(LETTER_OR_DIGIT) ?? []) {
    if (match.length < 3 && !/^\p{N}+$/u.test(match)) continue;
    if (STOP_WORDS.has(match)) continue;
    if (!words.includes(match)) words.push(match);
    if (words.length >= MAX_QUERY_WORDS) break;
  }
  return words.length > 0 ? words.join(" ") : null;
}

export interface ReferenceSource {
  title: string;
  url: string;
  /** ISO date of the page's last edit, when Wikipedia says. */
  updated: string | null;
}

export interface ReferenceResult {
  /** Passages ready to place in the model's prompt. */
  text: string;
  sources: ReferenceSource[];
}

const strip = (value: unknown, max: number): string =>
  typeof value === "string"
    ? value.replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ").trim().slice(0, max)
    : "";

/**
 * Up to two matching intro passages, or null (nothing found, nothing relevant,
 * not searchable, slow, or failing). Never throws: a missing reference is a
 * quieter answer, never a missing one.
 */
export async function fetchReference(params: {
  question: string;
  language?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ReferenceResult | null> {
  const query = buildSearchQuery(params.question);
  if (!query) return null;

  const lang = wikipediaLanguage(params.question, params.language);
  const search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: query,
    gsrlimit: String(MAX_PASSAGES + 1),
    gsrnamespace: "0",
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    exlimit: "max",
    exchars: String(PASSAGE_CHARS),
    inprop: "url",
    redirects: "1",
  });

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? REFERENCE_TIMEOUT_MS);
  try {
    const response = await (params.fetchImpl ?? fetch)(`https://${lang}.wikipedia.org/w/api.php?${search}`, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json() as { query?: { pages?: Record<string, Record<string, unknown>> } };
    const pages = Object.values(data?.query?.pages ?? {})
      .sort((a, b) => Number(a.index ?? 99) - Number(b.index ?? 99));

    const words = query.split(" ");
    const kept: Array<{ line: string; source: ReferenceSource }> = [];
    for (const page of pages) {
      const title = strip(page.title, 120);
      const extract = strip(page.extract, PASSAGE_CHARS);
      if (!title || extract.length < 40) continue;
      const haystack = `${title} ${extract}`.toLowerCase();
      if (!words.some((word) => haystack.includes(word))) continue;

      const touched = typeof page.touched === "string" && /^\d{4}-\d{2}-\d{2}/u.test(page.touched) ? page.touched.slice(0, 10) : null;
      const url = typeof page.fullurl === "string" && page.fullurl.startsWith(`https://${lang}.wikipedia.org/`) ? page.fullurl : "";
      kept.push({
        line: `${title}${touched ? ` (page updated ${touched})` : ""}: ${extract}`,
        source: { title, url, updated: touched },
      });
      if (kept.length >= MAX_PASSAGES) break;
    }
    if (kept.length === 0) return null;
    return {
      text: kept.map((k) => k.line).join("\n").slice(0, MAX_REFERENCE_CHARS),
      sources: kept.map((k) => k.source),
    };
  } catch {
    // A code and nothing else: the error can quote the URL, and the URL has the query.
    return null;
  } finally {
    clearTimeout(deadline);
  }
}
