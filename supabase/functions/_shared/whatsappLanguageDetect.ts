// What language is this, without asking anybody.
//
// ── Why not a model ─────────────────────────────────────────────────────────
//
// fastText's `lid.176` is a megabyte and would answer this well. It also cannot
// run in an Edge Function — no disk, no process — so it would mean a round trip
// to the VPS for a question that, for this alphabet set, most of the time has a
// decisive answer in the first character.
//
// This channel speaks twenty languages and they are written in nine scripts.
// Thirteen of the twenty are the only language in this set that uses their
// script, or are separated from their neighbours by letters that exist in one
// and not the other. For those, detection is not a guess at all — it is a
// lookup, and a model would be a slower way to get the same answer.
//
// The seven that share the Latin alphabet are the real problem, and they get
// stopword scoring with an honest confidence. Where that is weak this returns
// `null` rather than a guess: telling somebody their Portuguese is Spanish and
// translating it accordingly is worse than asking which language it is.
//
// ── The trap this is written around ─────────────────────────────────────────
//
// Function words are short, and short words match inside longer ones. `de` is
// Spanish, Portuguese, Dutch and German all at once, and it is also inside
// "decide", "modern" and "grande". Every match here is therefore whole-word,
// anchored on Unicode letters rather than `\b` — which is defined against ASCII
// and sits *inside* a word the moment a letter beside it is accented. That is
// the same failure `whatsappLocation.ts` documents, and it silently returns
// nothing rather than returning something wrong.

import type { Language } from "./whatsappCatalog.ts";

export interface DetectedLanguage {
  language: Language;
  /**
   * Roughly, how much to trust it.
   *
   * `1` where the script settles it outright. Below that it is the share of
   * scored words that voted for the winner, which is a real number and not a
   * probability — it is reported so a caller can decide whether to act or ask.
   */
  confidence: number;
}

/** Below this, a Latin-script answer is not worth acting on. */
export const MIN_CONFIDENCE = 0.34;

/** Shorter than this and there is nothing to go on. */
export const MIN_CHARS = 8;

// ── Scripts that answer the question by themselves ──────────────────────────

const HAS = {
  arabic: /[؀-ۿݐ-ݿ]/,
  devanagari: /[ऀ-ॿ]/,
  bengali: /[ঀ-৿]/,
  cyrillic: /[Ѐ-ӿ]/,
  hangul: /[가-힯ᄀ-ᇿ]/,
  kana: /[぀-ゟ゠-ヿ]/,
  han: /[一-鿿]/,
};

/**
 * Persian and Urdu letters that Arabic does not have.
 *
 * This is what makes three languages in one script separable without a model.
 * Urdu is checked first: it uses the Persian four *and* its own retroflex set,
 * so a text with ٹ or ڈ in it is Urdu even though it also has گ.
 */
const URDU_LETTERS = /[ٹڈھںےڑ]/; // ٹ ڈ ھ ں ے ڑ
const PERSIAN_LETTERS = /[پچژگیک]/; // پ چ ژ گ ی ک

// ── The Latin seven, by the words they cannot do without ────────────────────
//
// Function words only, and only ones that are common enough to appear in a
// sentence or two. A content word would make this a topic detector.

const STOPWORDS: Partial<Record<Language, readonly string[]>> = {
  en: ["the", "and", "is", "of", "to", "in", "that", "it", "for", "with", "you", "this", "are", "was"],
  es: ["el", "la", "los", "las", "que", "de", "y", "en", "un", "una", "es", "por", "con", "para", "no"],
  pt: ["o", "a", "os", "as", "que", "de", "e", "em", "um", "uma", "é", "por", "com", "para", "não", "do", "da"],
  fr: ["le", "la", "les", "et", "de", "des", "un", "une", "est", "que", "pour", "dans", "avec", "pas", "sur"],
  de: ["der", "die", "das", "und", "ist", "nicht", "ein", "eine", "zu", "mit", "für", "auf", "den", "von"],
  it: ["il", "lo", "la", "che", "di", "e", "un", "una", "è", "per", "con", "non", "del", "della", "sono"],
  nl: ["de", "het", "een", "en", "is", "van", "dat", "niet", "op", "te", "met", "voor", "zijn", "je"],
  pl: ["i", "w", "nie", "na", "że", "to", "jest", "się", "do", "z", "o", "jak", "ale", "być"],
  tr: ["ve", "bir", "bu", "için", "ile", "da", "de", "çok", "olarak", "var", "daha", "ne", "gibi"],
  id: ["yang", "dan", "di", "ini", "untuk", "dengan", "tidak", "dari", "ada", "itu", "pada", "adalah"],
  vi: ["và", "của", "là", "không", "có", "được", "trong", "cho", "với", "một", "này", "các", "để"],
};

/** Whole-word, in any alphabet. `\b` is defined against ASCII and fails here. */
const NOT_A_LETTER_BEFORE = "(?<![\\p{L}\\p{N}])";
const NOT_A_LETTER_AFTER = "(?![\\p{L}\\p{N}])";

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Built once. Twenty regular expressions per call would be the slow part. */
const PATTERNS: Array<[Language, RegExp]> = Object.entries(STOPWORDS).map(
  ([language, words]) => [
    language as Language,
    new RegExp(
      `${NOT_A_LETTER_BEFORE}(?:${(words as readonly string[]).map(escape).join("|")})${NOT_A_LETTER_AFTER}`,
      "giu",
    ),
  ],
);

/**
 * The language a piece of text is written in, or null.
 *
 * Null is a real answer and is returned often: for anything too short to judge,
 * for a Latin-script text whose vote was close, and for a script this set does
 * not contain. A caller that needs a language should ask for one rather than be
 * handed a coin toss — the whole cost of getting this wrong is a translation
 * into the wrong language, which for somebody who cannot read the original is
 * undetectable.
 */
export function detectLanguage(text: string): DetectedLanguage | null {
  const sample = (text ?? "").trim().slice(0, 4_000);
  if (sample.length < MIN_CHARS) return null;

  // ── 1. Scripts with one owner ─────────────────────────────────────────────
  if (HAS.devanagari.test(sample)) return { language: "hi", confidence: 1 };
  if (HAS.bengali.test(sample)) return { language: "bn", confidence: 1 };
  if (HAS.hangul.test(sample)) return { language: "ko", confidence: 1 };
  if (HAS.cyrillic.test(sample)) return { language: "ru", confidence: 1 };

  // Japanese before Chinese: Japanese uses Han characters too, so the presence
  // of kana is what separates them and the absence of kana is what leaves Han
  // meaning Chinese. Checking Han first would call every Japanese text Chinese.
  if (HAS.kana.test(sample)) return { language: "ja", confidence: 1 };
  if (HAS.han.test(sample)) return { language: "zh", confidence: 1 };

  // ── 2. One script, three languages ────────────────────────────────────────
  if (HAS.arabic.test(sample)) {
    if (URDU_LETTERS.test(sample)) return { language: "ur", confidence: 0.9 };
    if (PERSIAN_LETTERS.test(sample)) return { language: "fa", confidence: 0.9 };
    return { language: "ar", confidence: 0.8 };
  }

  // ── 3. The Latin seven, and the four that share their alphabet ────────────
  const words = sample.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  if (words.length < 3) return null;

  const scores = new Map<Language, number>();
  let total = 0;
  for (const [language, pattern] of PATTERNS) {
    pattern.lastIndex = 0;
    const hits = (sample.toLowerCase().match(pattern) ?? []).length;
    if (hits > 0) {
      scores.set(language, hits);
      total += hits;
    }
  }
  if (total === 0) return null;

  let best: Language | null = null;
  let bestScore = 0;
  for (const [language, score] of scores) {
    if (score > bestScore) {
      best = language;
      bestScore = score;
    }
  }
  if (!best) return null;

  const confidence = bestScore / total;
  // A close vote between two Latin languages is exactly the case where
  // guessing is worst: "de" and "het" both being Dutch and "de" also being
  // Spanish is how a Dutch sentence becomes a Spanish one.
  if (confidence < MIN_CONFIDENCE) return null;

  return { language: best, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Whether a detection is worth acting on without asking.
 *
 * Deliberately separate from the detection itself: the number is a fact and
 * this is a policy, and a caller that would rather ask can use a stricter one.
 */
export const isConfident = (detected: DetectedLanguage | null): boolean =>
  detected !== null && detected.confidence >= 0.5;

// ── What language the message itself is in ──────────────────────────────────

/**
 * The script each language is written in.
 *
 * Latin is the default rather than eleven entries: it is what every language
 * not named here uses, and a list of them would be a second list to keep in
 * step with `STOPWORDS`. Japanese is kana *or* han, because a Japanese
 * sentence is mostly han and counting only its kana would call it a minority
 * of itself.
 */
const SCRIPT_OF: Partial<Record<Language, RegExp>> = {
  ar: HAS.arabic,
  fa: HAS.arabic,
  ur: HAS.arabic,
  hi: HAS.devanagari,
  bn: HAS.bengali,
  ru: HAS.cyrillic,
  ko: HAS.hangul,
  ja: /[぀-ゟ゠-ヿ一-鿿]/,
  zh: HAS.han,
};

/** Latin letters, accented ones included — the script of the other eleven. */
const LATIN = /[A-Za-z\u00C0-\u024F]/;

/**
 * Is this the script the message is mostly written in?
 *
 * Half the letters or more. The point is to separate a message written in a
 * language from a message that merely quotes one: "Where is my order for
 * كتاب الأمير" is an English sentence with an Arabic title in it, and reading
 * it as Arabic would answer an English speaker in a script they may not read.
 */
function carriesTheMessage(text: string, script: RegExp): boolean {
  const letters = text.match(/\p{L}/gu);
  if (!letters || letters.length === 0) return false;
  let own = 0;
  for (const letter of letters) if (script.test(letter)) own += 1;
  return own * 2 >= letters.length;
}

/**
 * The language a message is *written in*, or null when it does not say.
 *
 * Null is the common answer and the useful one: a bare number, an emoji, a
 * photo with no caption, a greeting too short to judge, and a Latin-script
 * sentence whose vote was close all return it. A caller holding null still has
 * whatever it knew before — a stored preference, or the language this
 * conversation has been speaking — and that is the right thing to fall back to,
 * because those messages carry no opinion to override it with.
 *
 * Acts on any detection `detectLanguage` was willing to return, and adds one
 * test of its own: the script has to carry the message. Those are different
 * questions and each needs its own guard. `MIN_CONFIDENCE` already refuses the
 * close Latin vote — the case where calling Portuguese Spanish is a real risk —
 * and nothing above it is improved by a second, stricter bar here. A plain
 * French sentence scores 0.38, because "de" is French and Spanish and
 * Portuguese and Dutch all at once and the vote splits four ways; refusing to
 * answer it in French would be refusing the ordinary case, not the risky one.
 *
 * What `detectLanguage` does not ask is how much of the message its answer
 * covers, and that is the whole of the mixed-script problem: one Arabic title
 * inside an English sentence is Arabic script, confidently, and is not an
 * Arabic message. `carriesTheMessage` is that guard and it belongs here rather
 * than in the detector, which is answering honestly about the text it was given.
 */
export function languageOfMessage(text: string | null | undefined): Language | null {
  const sample = (text ?? "").trim();
  if (!sample) return null;

  const detected = detectLanguage(sample);
  if (!detected) return null;

  const script = SCRIPT_OF[detected.language] ?? LATIN;
  return carriesTheMessage(sample, script) ? detected.language : null;
}
