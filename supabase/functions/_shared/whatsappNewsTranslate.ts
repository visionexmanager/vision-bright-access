// An article in the sender's own language, translated when nobody has yet.
//
// The daily collection stores the publisher's headline and extract in English
// and nothing else, so an Arabic sender used to get a list whose rows were
// English and, where an older article had only its title translated, a
// headline in Arabic over a story in English. `articleText` falls back to the
// base columns on purpose — a blank row is worse than a foreign one — which
// means the only place to fix it is before the text is formatted.
//
// One short call per article, once: the result is written back into
// `translations`, so the second reader in that language costs nothing. A
// failed call leaves the article exactly as it was.

import { askAssistant, type AskProvider } from "./whatsappAsk.ts";
import type { NewsArticle } from "./whatsappNews.ts";

/** Most articles translated for one reply; the rest are shown as they are. */
export const NEWS_TRANSLATE_LIMIT = 12;

/**
 * Articles the server's own model translates in one reply, one after another:
 * it works on one text at a time (a second is told `busy`), and each takes a
 * few seconds. The rest of the reply goes to the provider chain at once, and
 * whatever either path translates is saved, so the next reader finds it done.
 */
export const LOCAL_TRANSLATE_SLOTS = 4;

const SEPARATOR = "|||";

const needsTranslation = (article: NewsArticle, language: string): boolean => {
  if (language === "en") return false;
  const existing = article.translations?.[language];
  const titleDone = !!existing?.title?.trim();
  const descriptionDone = !article.description || !!existing?.description?.trim();
  return !(titleDone && descriptionDone);
};

/** `title|||description` back into its two parts, or null when the shape is wrong. */
export function parseTranslated(raw: string, hasDescription: boolean): { title: string; description: string } | null {
  const [title, ...rest] = raw.split(SEPARATOR);
  const cleanTitle = (title ?? "").trim();
  if (!cleanTitle) return null;
  const description = rest.join(" ").trim();
  if (hasDescription && !description) return null;
  return { title: cleanTitle, description };
}

/** The server's own translator: text and target language in, text out, or null to ask the chain. */
export type LocalTranslator = (text: string, language: string) => Promise<string | null>;

export async function translateArticle(
  article: NewsArticle,
  language: string,
  languageName: string,
  provider: AskProvider,
  local?: LocalTranslator,
): Promise<{ title: string; description: string } | null> {
  // The server's model first: free, and the result is kept. A newline is the
  // one separator it translates faithfully; anything but a clean two-part
  // answer falls through to the provider chain below.
  if (local) {
    const summary = article.description.replace(/\s+/g, " ").trim();
    const sent = summary ? `${article.title.replace(/\s+/g, " ").trim()}\n${summary}` : article.title;
    const answer = await local(sent, language).catch(() => null);
    if (answer) {
      const [first, ...rest] = answer.split("\n").map((part) => part.trim()).filter(Boolean);
      const description = rest.join(" ");
      if (first && (!summary || description)) return { title: first, description };
    }
  }
  const body = article.description ? `${article.title}\n${SEPARATOR}\n${article.description}` : article.title;
  const rendered = await askAssistant(
    {
      systemParts: [
        `Translate the news text into ${languageName}. Keep names, numbers and quotations exact and add nothing. ` +
        `The text is a headline${article.description ? ` followed by ${SEPARATOR} and a summary; keep ${SEPARATOR} between them` : ""}. ` +
        "Reply with the translation only: no quotes, no notes.",
      ],
      question: body,
      maxTokens: 500,
      timeoutMs: 12_000,
    },
    provider,
  );
  if (rendered.status !== "answered") return null;
  return parseTranslated(rendered.text.replace(/\n/g, " "), !!article.description);
}

/**
 * The articles with `language` filled in where it was missing.
 *
 * `save` persists one result; its failure is the cache missing, not the reply,
 * so it is swallowed here. Order and length are preserved.
 */
export async function withTranslations(params: {
  articles: NewsArticle[];
  language: string;
  languageName: string;
  provider: AskProvider;
  local?: LocalTranslator;
  save: (id: string, translations: NonNullable<NewsArticle["translations"]>) => Promise<void>;
}): Promise<NewsArticle[]> {
  const { articles, language, languageName, provider, local, save } = params;
  const wanted = articles.filter((a) => needsTranslation(a, language)).slice(0, NEWS_TRANSLATE_LIMIT);
  if (wanted.length === 0) return articles;

  const done = new Map<string, NewsArticle>();
  const one = async (article: NewsArticle, withLocal: boolean) => {
    try {
      const result = await translateArticle(article, language, languageName, provider, withLocal ? local : undefined);
      if (!result) return;
      const translations = { ...(article.translations ?? {}), [language]: result };
      done.set(article.id, { ...article, translations });
      await save(article.id, translations).catch(() => undefined);
    } catch {
      // The article goes out in its own language.
    }
  };

  const slots = local ? wanted.slice(0, LOCAL_TRANSLATE_SLOTS) : [];
  const overflow = local ? wanted.slice(LOCAL_TRANSLATE_SLOTS) : wanted;
  await Promise.all([
    (async () => { for (const article of slots) await one(article, true); })(),
    ...overflow.map((article) => one(article, false)),
  ]);
  return articles.map((a) => done.get(a.id) ?? a);
}
