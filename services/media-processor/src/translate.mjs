// Translating text with the model that runs on this server (MADLAD-400 3B, in
// its own container, started by `deploy-translator.yml`).
//
// Pure on purpose, like describe.mjs: which languages, how big a request may
// be, and how to read the answer. The route in server.mjs does the I/O.
//
// The caller names a target language from a fixed list and sends text. There
// is no prompt to forward: the model is a translator with no instructions to
// follow, so an article that says "ignore the above" is only more text.

/** The site's twenty locales; the Edge Function's list must match (a test compares). */
export const TRANSLATE_LANGUAGES = [
  "en", "ar", "bn", "de", "es", "fa", "fr", "hi", "id", "it",
  "ja", "ko", "nl", "pl", "pt", "ru", "tr", "ur", "vi", "zh",
];

export const isTranslateLanguage = (value) => typeof value === "string" && TRANSLATE_LANGUAGES.includes(value);

/** One article's headline and summary, not a book. */
export const MAX_TRANSLATE_CHARS = 6_000;
export const MAX_TRANSLATE_BODY_BYTES = 64 * 1024;

/** A news summary takes seconds; a full page of text, a minute or so. */
export const TRANSLATE_TIMEOUT_MS = 100_000;

/** The request, or the reason it is refused. */
export function checkTranslateRequest(body) {
  const text = body?.text;
  if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "empty" };
  if (text.length > MAX_TRANSLATE_CHARS) return { ok: false, reason: "too_long" };
  if (!isTranslateLanguage(body?.target)) return { ok: false, reason: "unsupported_language" };
  return { ok: true, text, target: body.target };
}

/** The model container's answer, or null when there is nothing worth sending. */
export function readTranslateAnswer(payload) {
  if (!payload || payload.ok !== true || typeof payload.text !== "string") return null;
  const text = payload.text.trim();
  return text.replace(/[^\p{L}\p{N}]/gu, "").length >= 2 ? text : null;
}
