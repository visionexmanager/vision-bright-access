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

/** Longest a message can be and still be read as a request for the news. */
const NEWS_MAX_CHARS = 40;

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

/**
 * Whether this message is asking for the news.
 *
 * Whole-message matching against a short cap, not a substring hunt: "I saw the
 * news about my order" is a support message, and answering it with five
 * headlines would be the assistant talking over somebody.
 */
export function parseNewsRequest(text: string | null | undefined): boolean {
  const value = normaliseAlias(text ?? "");
  if (!value || value.length > NEWS_MAX_CHARS) return false;
  return NEWS_WORDS.has(value);
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
