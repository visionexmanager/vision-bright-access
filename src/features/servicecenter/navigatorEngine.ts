import { SERVICE_CATALOG, DIFFICULTY_ORDER } from "./catalog";
import type { Difficulty, Intent, ServiceEntry } from "./types";

/**
 * The matching engine behind the AI Service Navigator.
 *
 * It is deliberately deterministic and local: the visitor's first question is
 * answered instantly and offline, and a language model is only worth involving
 * once they want a conversation. That keeps the entry point fast, testable and
 * free.
 */

export interface NavigatorQuery {
  /** The intent chip the visitor picked, if any. */
  intent?: Intent;
  /** Free text they typed, in either language. */
  text?: string;
  /** Optional experience filter — "I've never done this before". */
  level?: Difficulty;
  /** Slugs the visitor has already completed; these get de-prioritised. */
  completedSlugs?: string[];
}

export interface NavigatorMatch {
  entry: ServiceEntry;
  score: number;
  /** Why this was suggested — shown under the result so the pick is explainable. */
  reasons: MatchReason[];
}

export type MatchReason =
  | "intent"
  | "keyword"
  | "title"
  | "skill"
  | "level"
  | "featured"
  | "revisit";

const SCORE = {
  intent: 50,
  title: 40,
  keyword: 22,
  skill: 14,
  outcome: 8,
  levelExact: 12,
  levelNear: 5,
  featured: 6,
  /** Completed entries stay reachable but drop below fresh suggestions. */
  revisitPenalty: -35,
} as const;

/**
 * Arabic and English both get folded to a comparable form: lowercase, no
 * diacritics, normalised alef/ya/ta-marbuta, and punctuation stripped. Without
 * this, "طاقه" would never match "طاقة".
 */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "") // Arabic diacritics
    .replace(/ـ/g, "") // tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Function words carry no matching signal, and in Arabic they are short enough
 * to appear *inside* unrelated words — "لا" sits in "الألواح" (solar panels).
 * Left in, a query like "اللابتوب لا يعمل" scores half the catalog as a direct
 * match. Both languages are filtered because the search box is bilingual.
 */
const STOPWORDS = new Set([
  // Arabic (already normalised: ة→ه, أإآ→ا, ى→ي)
  "لا", "ما", "من", "في", "علي", "الي", "عن", "مع", "هل", "او", "ثم", "قد",
  "هذا", "هذه", "ذلك", "التي", "الذي", "كان", "يكون", "هو", "هي", "انا", "انت",
  "كل", "بعد", "قبل", "عند", "حتي", "لكن", "ايضا", "غير", "بين", "الان",
  // English
  "the", "and", "for", "not", "but", "with", "you", "your", "our", "are", "was",
  "has", "have", "had", "can", "will", "would", "should", "does", "did", "how",
  "what", "when", "where", "why", "who", "this", "that", "these", "those",
  "from", "into", "out", "off", "any", "all", "some", "its", "it", "is", "in",
  "on", "at", "to", "of", "or", "an", "as", "be", "by", "do", "if", "my", "me",
]);

/**
 * Tokens shorter than this only match whole words. Two-character fragments are
 * substrings of far too much text to be trusted.
 */
const MIN_SUBSTRING_LENGTH = 3;

/** Splits a query into meaningful tokens, dropping noise and function words. */
export function tokenise(value: string): string[] {
  return normalise(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/**
 * Arabic glues conjunctions and the article onto the front of a word, so a
 * visitor typing "والشبكة" must still reach the entry keyed on "شبكة".
 * Longest prefixes first, and we never strip down to a stub shorter than three
 * characters — that is where over-matching starts.
 */
const ARABIC_PREFIXES = ["وبال", "فبال", "وال", "بال", "كال", "فال", "لل", "ال", "و", "ف", "ب", "ك", "ل"];
const MIN_STEM = 3;

function tokenForms(token: string): string[] {
  const forms = [token];
  for (const prefix of ARABIC_PREFIXES) {
    if (token.startsWith(prefix) && token.length - prefix.length >= MIN_STEM) {
      forms.push(token.slice(prefix.length));
      break; // one prefix layer is enough; stripping further invents words
    }
  }
  return forms;
}

/** Whole-word match, used for tokens too short to search as substrings. */
function containsWord(haystack: string, word: string): boolean {
  return ` ${haystack} `.includes(` ${word} `);
}

function containsToken(haystack: string, token: string): boolean {
  // Long tokens match as substrings because Arabic attaches affixes to both
  // ends. Short ones must match a whole word or they match everything.
  return tokenForms(token).some((form) =>
    form.length >= MIN_SUBSTRING_LENGTH
      ? haystack.includes(form)
      : containsWord(haystack, form)
  );
}

function levelScore(entry: ServiceEntry, level: Difficulty | undefined): number {
  if (!level) return 0;
  const distance = Math.abs(DIFFICULTY_ORDER[entry.difficulty] - DIFFICULTY_ORDER[level]);
  if (distance === 0) return SCORE.levelExact;
  if (distance === 1) return SCORE.levelNear;
  return 0;
}

function scoreEntry(entry: ServiceEntry, query: NavigatorQuery): NavigatorMatch | null {
  const reasons: MatchReason[] = [];
  let score = 0;

  if (query.intent && entry.intents.includes(query.intent)) {
    score += SCORE.intent;
    reasons.push("intent");
  }

  const tokens = query.text ? tokenise(query.text) : [];
  if (tokens.length > 0) {
    const title = normalise(`${entry.title.en} ${entry.title.ar}`);
    const tagline = normalise(`${entry.tagline.en} ${entry.tagline.ar}`);
    const keywords = normalise([...entry.keywords.en, ...entry.keywords.ar].join(" "));
    const skills = normalise([...entry.skills.en, ...entry.skills.ar].join(" "));
    const outcomes = normalise([...entry.outcomes.en, ...entry.outcomes.ar].join(" "));

    let titleHit = false;
    let keywordHit = false;
    let skillHit = false;

    for (const token of tokens) {
      if (containsToken(title, token) || containsToken(tagline, token)) {
        score += SCORE.title;
        titleHit = true;
      }
      if (containsToken(keywords, token)) {
        score += SCORE.keyword;
        keywordHit = true;
      }
      if (containsToken(skills, token)) {
        score += SCORE.skill;
        skillHit = true;
      }
      if (containsToken(outcomes, token)) {
        score += SCORE.outcome;
      }
    }

    if (titleHit) reasons.push("title");
    if (keywordHit) reasons.push("keyword");
    if (skillHit) reasons.push("skill");
  }

  // Nothing asked for, nothing matched — don't invent a recommendation.
  if (score === 0 && !query.level) return null;

  const level = levelScore(entry, query.level);
  if (level > 0) {
    score += level;
    reasons.push("level");
  }

  if (entry.featured) {
    score += SCORE.featured;
    reasons.push("featured");
  }

  if (query.completedSlugs?.includes(entry.slug)) {
    score += SCORE.revisitPenalty;
    reasons.push("revisit");
  }

  if (score <= 0) return null;
  return { entry, score, reasons };
}

/**
 * Ranks the catalog against a query. Ties break on difficulty (gentler first)
 * then slug, so the same query always produces the same order.
 */
export function findServices(query: NavigatorQuery, limit = 6): NavigatorMatch[] {
  const matches: NavigatorMatch[] = [];

  for (const entry of SERVICE_CATALOG) {
    const match = scoreEntry(entry, query);
    if (match) matches.push(match);
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const byDifficulty =
      DIFFICULTY_ORDER[a.entry.difficulty] - DIFFICULTY_ORDER[b.entry.difficulty];
    if (byDifficulty !== 0) return byDifficulty;
    return a.entry.slug.localeCompare(b.entry.slug);
  });

  return matches.slice(0, limit);
}

/** Copy for the "why this?" line under each recommendation. */
export const REASON_LABEL: Record<MatchReason, { en: string; ar: string }> = {
  intent: { en: "Matches what you want to do", ar: "يطابق ما تريد فعله" },
  title: { en: "Direct match", ar: "تطابق مباشر" },
  keyword: { en: "Matches your search", ar: "يطابق بحثك" },
  skill: { en: "Builds the skill you named", ar: "يبني المهارة التي ذكرتها" },
  level: { en: "Suits your experience level", ar: "يناسب مستوى خبرتك" },
  featured: { en: "Popular starting point", ar: "نقطة بداية شائعة" },
  revisit: { en: "You have completed this", ar: "أكملت هذه من قبل" },
};
