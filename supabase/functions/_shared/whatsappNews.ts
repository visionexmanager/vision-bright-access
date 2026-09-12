// Visionex News, over WhatsApp.
//
// No new backend and no second copy of the feed. `news_articles` is the table
// the website's own `/news` page reads, with the same filter it uses —
// `published = true`, newest first — and the row already carries a public read
// policy, so nothing here widens access to anything.
//
// ── Two decisions taken from the website rather than invented ───────────────
//
// **Breaking news is not in the list.** `News.tsx` splits `category = breaking`
// into its own section and keeps it out of the regular grid; the comment there
// says it is never emailed either. A chat list has no second section, so
// following that rule means leaving breaking out rather than quietly mixing it
// into a surface where the distinction cannot be shown. That is a product
// decision the site already made, and this defers to it.
//
// **There is no per-article URL to link to.** The site registers `/news` and
// nothing under it, so the deep link is the section, not the item. Inventing
// `/news/<id>` would produce a link that 404s.
//
// ── The article's own language ──────────────────────────────────────────────
//
// `translations` is a jsonb map of language code to `{title, description}`,
// written by the news pipeline. It is *content*, not interface text: an article
// exists in the languages it was translated into and in no others, and the base
// columns are what is left when the sender's language is not among them. That
// is a gap in the data, visible and honest, not a missing translation in this
// repository — every sentence *this* file contributes exists in all twenty.
//
// Pure: no `Deno`, no fetch, no database. The query lives in the webhook, where
// the Supabase client already is; the payload building lives in
// `whatsappInteractive.ts`, where every other interactive message is built.

import { aliasesOf, type Language, nodeById } from "./whatsappCatalog.ts";
import { SUPPORTED_LANGUAGES } from "./whatsappLanguages.ts";
import { say } from "./whatsappStrings.ts";
import { normaliseAlias } from "./whatsappRouter.ts";

/** The canonical public page. The site registers no per-article route. */
export const NEWS_URL = "https://visionex.app/news";

/** Rows of news in one list. Five leaves room for the way back. */
export const NEWS_LIST_SIZE = 5;

/** Kept out of the list, exactly as `News.tsx` keeps it out of the grid. */
export const NEWS_EXCLUDED_CATEGORY = "breaking";

/** Prefix for a news row's selection id, as `language.` is for the language list. */
export const NEWS_ID_PREFIX = "news.";

export const newsRowId = (id: string): string => `${NEWS_ID_PREFIX}${id}`;

/** The article id inside a tapped row, or null for any other selection. */
export function parseNewsSelection(id: string | null | undefined): string | null {
  if (!id || !id.startsWith(NEWS_ID_PREFIX)) return null;
  const articleId = id.slice(NEWS_ID_PREFIX.length).trim();
  return articleId ? articleId : null;
}

/** One article, as this channel needs it. Nothing unpublished ever reaches it. */
export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string | null;
  translations: Record<string, { title?: string; description?: string }> | null;
}

/**
 * Rows from the table, as this module's shape.
 *
 * Tolerant on purpose: a row missing a column, or a payload that is not an
 * array, resolves to nothing printable rather than throwing inside a reply
 * builder. Somebody asked for the news; a `TypeError` is not news.
 */
export function readArticles(rows: unknown): NewsArticle[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    const id = typeof value.id === "string" ? value.id : "";
    const title = typeof value.title === "string" ? value.title.trim() : "";
    if (!id || !title) return [];
    const translations = value.translations && typeof value.translations === "object" &&
        !Array.isArray(value.translations)
      ? value.translations as NewsArticle["translations"]
      : null;
    return [{
      id,
      title,
      description: typeof value.description === "string" ? value.description.trim() : "",
      category: typeof value.category === "string" ? value.category : "",
      publishedAt: typeof value.published_at === "string" ? value.published_at : null,
      translations,
    }];
  });
}

/**
 * The article in the sender's language, or in the language it was written in.
 *
 * Never returns an empty title: an untranslated article is still an article,
 * and a blank row in a list is worse than one in the wrong language.
 */
export function articleText(
  article: NewsArticle,
  language: Language,
): { title: string; description: string } {
  const translated = article.translations?.[language];
  return {
    title: translated?.title?.trim() || article.title,
    description: translated?.description?.trim() || article.description,
  };
}

/**
 * Longest a message can be and still be read as a request for the news.
 *
 * Wider than it was. It bounded a rule that matched the whole message against
 * one word, so forty characters was generous; it now bounds a rule that reads a
 * short *sentence* — "send me a voice bulletin of the top technology news" is
 * fifty-one — and the safety no longer rests on the cap alone. See
 * `parseNewsAsk`: every word of the message has to be accounted for.
 */
const NEWS_MAX_CHARS = 90;

/**
 * Every word that asks for the news, in every language, folded once.
 *
 * Read from the catalog rather than kept here: the node already has to declare
 * its words so a switched-off feature can be refused by name instead of being
 * quietly answered by the assistant, and two hand-maintained lists of the same
 * twenty languages is one list going stale.
 *
 * Matched regardless of which language the sender was detected as, which is the
 * point rather than an oversight. "noticias" is one word with no Spanish
 * function word and no ñ in it, so detection reads it as English; scoping the
 * match to the detected language would leave exactly the senders this list is
 * for — the ones who type the name of the feature and nothing else — unable to
 * reach it. Whole-message matching against a short cap is what keeps that safe.
 */
const NEWS_WORDS: ReadonlySet<string> = (() => {
  const node = nodeById("news");
  const words = new Set<string>();
  if (!node) return words;
  for (const language of SUPPORTED_LANGUAGES) {
    for (const alias of aliasesOf(node, language)) words.add(normaliseAlias(alias));
  }
  words.delete("");
  return words;
})();

// ── Which news, and in whose words ──────────────────────────────────────────
//
// «الأخبار» on its own reached the list. Nothing else did — not «أهم الأخبار
// التقنية», not "send me the latest tech news", not a sender who said please.
// Somebody who asked for technology news and received the same five mixed
// headlines was not answered *badly*; the half of the message that said which
// news was simply never read.
//
// What stops that from becoming a substring hunt — which would answer "أخبار
// طلبي وين وصلت", a question about somebody's order, with a news bulletin — is
// that **every word has to be accounted for**. A message is a request for the
// news when it contains one of the words the catalog declares, and everything
// else in it is either a word for asking (please, send me, the latest, a voice
// bulletin) or the name of a section. One unrecognised word and it is not a
// request for the news at all; it is a sentence that mentions news, and it goes
// to the assistant like any other sentence.

/**
 * The sections, by the words somebody types for them.
 *
 * The keys are `news_articles.category` values, written by `news-generate`.
 * Folded through `normaliseAlias` at load, so these can be written the way they
 * are spelled rather than the way the normaliser leaves them.
 *
 * Not every category is here, and that is deliberate: a category nobody has a
 * natural word for adds a way to mistake an ordinary word for a filter, and
 * costs nothing when it is absent — the unfiltered list already contains it.
 */
const TOPIC_WORDS: ReadonlyArray<readonly [category: string, words: readonly string[]]> = [
  ["technology", ["تقنية", "التقنية", "تقنيه", "تكنولوجيا", "التكنولوجيا", "technology", "tech"]],
  ["ai", ["الذكاء الاصطناعي", "ذكاء اصطناعي", "الذكاء الصناعي", "ai", "artificial intelligence"]],
  ["health", ["صحة", "الصحة", "طبية", "الطب", "health", "medical"]],
  ["nutrition", ["تغذية", "التغذية", "nutrition"]],
  ["psychology", ["نفسية", "الصحة النفسية", "علم النفس", "psychology", "mental health"]],
  ["sports", ["رياضة", "الرياضة", "sports", "sport"]],
  ["business", ["اعمال", "الاعمال", "business"]],
  ["world_economy", ["اقتصاد", "الاقتصاد", "الاقتصاد العالمي", "economy", "world economy"]],
  ["world_politics", ["سياسة", "السياسة", "السياسة العالمية", "politics", "world politics"]],
  ["games", ["العاب", "الالعاب", "games", "gaming"]],
  ["academy", ["تعليم", "التعليم", "education", "learning"]],
  ["accessibility", ["امكانية الوصول", "اتاحة", "الاتاحة", "accessibility"]],
  ["marketplace", ["التجارة الالكترونية", "تجارة", "التجارة", "ecommerce", "e commerce", "marketplace"]],
  ["travel", ["سفر", "السفر", "سياحة", "السياحة", "travel", "tourism"]],
  ["music", ["موسيقى", "الموسيقى", "فنون", "الفنون", "music", "arts"]],
  ["beauty", ["جمال", "الجمال", "beauty", "lifestyle"]],
  ["community", ["مجتمع", "المجتمع", "community"]],
  ["legal", ["قانون", "القانون", "حقوق", "الحقوق", "legal", "law"]],
  ["platform", ["المنصة", "تحديثات المنصة", "platform"]],
];

const TOPIC_BY_WORD: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [category, words] of TOPIC_WORDS) {
    for (const word of words) {
      const folded = normaliseAlias(word);
      if (folded) map.set(folded, category);
    }
  }
  return map;
})();

/**
 * The words that carry no request of their own.
 *
 * Asking words, politeness, and the words for the *shape* somebody wants the
 * answer in — a bulletin, a summary, out loud. The medium those last ones ask
 * for is decided by `wantsSpokenReply`, not here; this list only has to know
 * that their presence does not make the message something other than a request
 * for the news.
 */
const FILLER_WORDS: ReadonlySet<string> = new Set(
  [
    // Arabic: asking, politeness, "the most important", "the latest".
    "اهم", "الاهم", "اخر", "احدث", "جديد", "الجديد", "اليوم", "اليومية", "هذا",
    "نشرة", "النشرة", "موجز", "ملخص", "قائمة", "عناوين", "قسم",
    "ارسل", "ابعث", "ابعتلي", "ارسللي", "اعطني", "عطني", "هات", "جبلي", "اريد",
    "بدي", "ودي", "لو", "سمحت", "رجاء", "الرجاء", "من", "فضلك", "شو", "ايش",
    "ما", "هي", "هو", "لي", "عن", "في", "على", "ال", "و", "مع", "اقرا", "اقرالي",
    "صوتية", "صوتي", "صوت", "بالصوت", "مسموعة", "مسموع",
    // English.
    "please", "give", "send", "show", "tell", "read", "me", "my", "i", "want",
    "need", "the", "a", "an", "of", "on", "about", "for", "with", "in", "to",
    "today", "todays", "latest", "recent", "newest", "top", "main", "important",
    "biggest", "list", "bulletin", "summary", "roundup", "digest", "briefing",
    "section", "voice", "audio", "note", "message", "spoken", "aloud", "loud",
    "out", "some", "any", "whats", "what", "is", "are", "new",
  ].map(normaliseAlias),
);

/**
 * The one-letter words Arabic writes attached to the next one.
 *
 * «لأهم الأخبار» is three words to a reader and two to a splitter, because the
 * ل of "for" is glued to the front of «أهم». Every one of those would be an
 * unrecognised word, and an unrecognised word is what makes this parser say no
 * — so a sender writing perfectly ordinary Arabic would have been refused for
 * writing it correctly.
 *
 * Tried only after the whole word has failed, and only when what is left is
 * something this file knows. So «لبنان» is not quietly read as «بنان» with an ل
 * in front of it: «بنان» is not a word here either, and the message is refused
 * exactly as it was before.
 */
const PROCLITICS: readonly string[] = ["ل", "ب", "و", "ف", "ك"];

/** Whether this file recognises a word at all, in any of its three roles. */
const isKnownWord = (word: string): boolean =>
  NEWS_WORDS.has(word) || TOPIC_BY_WORD.has(word) || FILLER_WORDS.has(word);

/** The word, or what is left of it once a prefix this file can read comes off. */
function withoutProclitic(word: string): string {
  if (isKnownWord(word)) return word;
  for (const letter of PROCLITICS) {
    if (!word.startsWith(letter) || word.length < 3) continue;
    const rest = word.slice(letter.length);
    if (isKnownWord(rest)) return rest;
  }
  return word;
}

/** A request for the news, and which section of it was asked for. */
export interface NewsAsk {
  /** A `news_articles.category`, or null for "whatever is newest". */
  category: string | null;
}

/**
 * Whether this message is asking for the news, and for which section.
 *
 * Word by word, against a short cap. A message qualifies only when it names the
 * news *and* every other word in it is one this file recognises — which is what
 * keeps "أخبار طلبي وين وصلت" and "any news on my refund?" out: «طلبي» and
 * "refund" are not words for asking and not the name of a section, so the
 * message is not a request for the news and is never answered as one.
 *
 * The longest phrase wins at each position, so «الذكاء الاصطناعي» is one topic
 * rather than two unrecognised words, and "latest news" is the feature's own
 * alias rather than a filler followed by it.
 */
export function parseNewsAsk(text: string | null | undefined): NewsAsk | null {
  const value = normaliseAlias(text ?? "");
  if (!value || value.length > NEWS_MAX_CHARS) return null;

  // The whole message is the feature's own name, in any of the twenty. Settled
  // before the walk so a name of four words or more — which the walk's
  // three-word window could not see as one phrase — resolves exactly as it did
  // when this was a single equality check.
  if (NEWS_WORDS.has(value)) return { category: null };

  const words = value.split(" ").filter(Boolean).map(withoutProclitic);
  if (words.length === 0) return null;

  let named = false;
  let category: string | null = null;

  for (let index = 0; index < words.length;) {
    let matched = 0;
    for (let span = Math.min(3, words.length - index); span >= 1; span--) {
      const phrase = words.slice(index, index + span).join(" ");
      if (NEWS_WORDS.has(phrase)) {
        named = true;
        matched = span;
        break;
      }
      const topic = TOPIC_BY_WORD.get(phrase);
      if (topic) {
        // The first section named wins. A message naming two is answered with
        // the first rather than with neither: somebody who said "technology and
        // AI news" wants headlines, not a clarifying question.
        category ??= topic;
        matched = span;
        break;
      }
      if (span === 1 && FILLER_WORDS.has(phrase)) {
        matched = 1;
        break;
      }
    }
    // A word this file does not recognise. The message is a sentence that
    // mentions the news, not a request for it.
    if (matched === 0) return null;
    index += matched;
  }

  return named ? { category } : null;
}

/**
 * Whether this message is asking for the news.
 *
 * Kept as the boolean the router and the navigation engine already ask for.
 * `parseNewsAsk` is the same decision with the section it found attached.
 */
export function parseNewsRequest(text: string | null | undefined): boolean {
  return parseNewsAsk(text) !== null;
}

/**
 * Longest an article's own summary may be inside a bulletin.
 *
 * A bulletin is read aloud end to end — there is no skimming a voice note, and
 * no tapping a row to hear more — so each item is a headline and a sentence,
 * not a paragraph. Five of those is about a minute of speech, which is a
 * bulletin; five paragraphs is a broadcast nobody asked for.
 */
export const BULLETIN_SUMMARY_CHARS = 220;

/**
 * The headlines as one message, to be read rather than tapped.
 *
 * ── Why this exists next to the list ────────────────────────────────────────
 *
 * The interactive list is the better answer to a typed request: five rows, one
 * tap, the article. It is close to useless as an answer to a *spoken* one. A
 * voice note cannot contain a list message, so somebody who asked out loud —
 * or who asked, in writing, for a spoken bulletin — was handed rows they would
 * have to see to use, which for this channel's audience is the whole failure.
 *
 * So the same five articles are also a paragraph somebody can hear: numbered,
 * headline then a sentence, and no URL — a link read aloud character by
 * character is noise, and `speakableText` strips it anyway. The way back to the
 * full article is the menu row the written list already names.
 */
export function newsBulletin(params: {
  articles: NewsArticle[];
  language: Language;
  heading: string;
}): string {
  const lines = [params.heading];
  params.articles.forEach((article, index) => {
    const { title, description } = articleText(article, params.language);
    const summary = description.replace(/\s+/g, " ").trim().slice(0, BULLETIN_SUMMARY_CHARS).trim();
    lines.push("");
    lines.push(`${index + 1}. ${title}${summary ? `. ${summary}` : ""}`);
  });
  return lines.join("\n");
}

/** The articles in one section, newest first, exactly as they arrived. */
export function articlesInCategory(articles: NewsArticle[], category: string | null): NewsArticle[] {
  if (!category) return articles;
  return articles.filter((article) => article.category === category);
}

/**
 * A published date somebody can place, without a time nobody asked for.
 *
 * `Intl`, so the month name comes from the runtime in all twenty languages
 * rather than from a table this repository would have to maintain.
 */
export function formatNewsDate(iso: string | null, language: Language): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(language, { day: "numeric", month: "long" }).format(date);
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * One article, as the message a sender receives after tapping its row.
 *
 * Title, then date, then the summary the article already carries, then the way
 * to read the rest. Deliberately short: this is a headline service in a chat
 * window, not a reader, and the page is one tap away.
 */
export function formatArticle(params: { article: NewsArticle; language: Language }): string {
  const { article, language } = params;
  const { title, description } = articleText(article, language);
  const date = formatNewsDate(article.publishedAt, language);

  const lines = [`📰 *${title}*`];
  if (date) lines.push(date);
  if (description) {
    lines.push("");
    lines.push(description);
  }
  lines.push("");
  lines.push(say("newsLink", language).replace("{url}", NEWS_URL));
  lines.push(say("newsBackHint", language));
  return lines.join("\n");
}
