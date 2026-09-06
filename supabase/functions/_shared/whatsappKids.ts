// ─── VisionKids, on WhatsApp ────────────────────────────────────────────────
//
// The row said "Stories and learning games" and answered a tap with "not
// available yet". The stories were there the whole time: `kids_stories` is the
// table `/kids` reads on visionex.app, six of them published, and the pages are
// three or four sentences each — which is a WhatsApp message, not a reader.
//
// So this channel shows the same list the site shows, from the same table, with
// the same `published` filter. A story appears here the day it appears there,
// and stops appearing the day it is unpublished. There is no second copy of the
// content and no second definition of what "published" means.
//
// The games are deliberately not here. They are things you look at and point
// at; a chat window can carry a story and cannot carry a jigsaw, and a menu row
// that promises one it cannot deliver is what this file exists to stop.
//
// ── What is content and what is interface ──────────────────────────────────
//
// The seven sentences around the stories are interface and exist in twenty
// languages. A title, a subtitle and the story itself are content: they are
// sent in the language they were written in, exactly as the site sends them,
// with the sender's own language ordered to the top of the list so a story they
// can read is the first thing they meet.
//
// Pure. No `Deno`, no fetch, no database — the webhook does the reading.

import { aliasesOf, type Language, nodeById } from "./whatsappCatalog.ts";
import { normaliseAlias } from "./whatsappRouter.ts";
import { say } from "./whatsappStrings.ts";
import { SUPPORTED_LANGUAGES } from "./whatsappLanguages.ts";

/** The section on the site. A story has no page of its own to link to. */
export const KIDS_URL = "https://visionex.app/kids";

/**
 * How many stories a list carries.
 *
 * Meta allows ten rows including the two controls, so eight is the ceiling and
 * not a preference. Six exist today; this is the guard for the ninth.
 */
export const KIDS_LIST_SIZE = 8;

export const KIDS_ID_PREFIX = "kids.";

export const kidsRowId = (slug: string): string => `${KIDS_ID_PREFIX}${slug}`;

/**
 * The slug behind a tapped row.
 *
 * A slug and nothing else: the id comes back from Meta as a string this
 * function is the only reader of, and a shape check here is cheaper than
 * trusting a round trip.
 */
export function parseKidsSelection(id: string | null | undefined): string | null {
  if (typeof id !== "string" || !id.startsWith(KIDS_ID_PREFIX)) return null;
  const slug = id.slice(KIDS_ID_PREFIX.length).trim();
  return /^[a-z0-9][a-z0-9-]{0,120}$/.test(slug) ? slug : null;
}

export interface KidsStory {
  slug: string;
  title: string;
  subtitle: string;
  ageGroup: string;
  language: string;
}

export interface KidsPage {
  pageNumber: number;
  text: string;
}

/**
 * Rows out of whatever the database handed back.
 *
 * Defensive in the same way `readArticles` is: this is content other people
 * edit, and a row with no title is a blank line in a list rather than an error
 * anybody can act on, so it is dropped here instead.
 */
export function readStories(rows: unknown): KidsStory[] {
  if (!Array.isArray(rows)) return [];
  const stories: KidsStory[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const slug = typeof record.slug === "string" ? record.slug.trim() : "";
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!slug || !title) continue;
    stories.push({
      slug,
      title,
      subtitle: typeof record.subtitle === "string" ? record.subtitle.trim() : "",
      ageGroup: typeof record.age_group === "string" ? record.age_group.trim() : "",
      language: typeof record.language === "string" ? record.language.trim().toLowerCase() : "",
    });
  }
  return stories;
}

/** The pages of one story, in order, with the empty ones left out. */
export function readPages(rows: unknown): KidsPage[] {
  if (!Array.isArray(rows)) return [];
  const pages: KidsPage[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const text = typeof record.text_content === "string" ? record.text_content.trim() : "";
    if (!text) continue;
    pages.push({
      pageNumber: Number(record.page_number) || 0,
      text,
    });
  }
  return pages.sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * The sender's own language first, and the rest in the order they arrived.
 *
 * Every story published today is in English, so today this changes nothing —
 * which is exactly why it is worth writing now rather than after somebody
 * publishes the first Arabic one and wonders why it is fourth.
 */
export function orderForLanguage(stories: readonly KidsStory[], language: Language): KidsStory[] {
  const mine = stories.filter((story) => story.language === language);
  const rest = stories.filter((story) => story.language !== language);
  return [...mine, ...rest];
}

/**
 * The line under a story's name in the list.
 *
 * The age range is digits and a hyphen in every language, and the subtitle is
 * the author's own sentence — so this row needs no translation and gets none.
 * Ordered age-first because that is what a parent scanning a list is choosing
 * on: a nine-year-old's adventure is the wrong answer for a four-year-old, and
 * hearing that before the description saves listening to the rest of it.
 */
export function storyRowSubtitle(story: KidsStory): string {
  return [story.ageGroup, story.subtitle].filter(Boolean).join(" · ");
}

/**
 * One story, as the message a sender receives after tapping its row.
 *
 * The pages are joined with a blank line between them rather than numbered.
 * Page numbers are a property of the book on the site — the place a finger
 * rests, the place a screen reader was up to — and in a chat window they are
 * four extra things to listen past on the way to the story.
 */
export function formatStory(params: {
  story: KidsStory;
  pages: readonly KidsPage[];
  language: Language;
}): string {
  const { story, pages, language } = params;
  const lines = [`📖 *${story.title}*`];
  if (story.subtitle) lines.push(story.subtitle);
  if (story.ageGroup) lines.push(story.ageGroup);
  lines.push("");
  lines.push(pages.map((page) => page.text).join("\n\n"));
  lines.push("");
  lines.push(say("kidsLink", language).replace("{url}", KIDS_URL));
  lines.push(say("kidsBackHint", language));
  return lines.join("\n");
}

/** Longest a message can be and still be read as a request for the stories. */
const KIDS_MAX_CHARS = 40;

/**
 * Every word that asks for the stories, in every language, folded once.
 *
 * Read out of the catalog rather than kept here, for the reason the news list
 * is: the node already declares its words so that a switched-off feature can be
 * refused by name rather than quietly answered by the assistant, and two
 * hand-maintained lists of the same twenty languages is one list going stale.
 */
const KIDS_WORDS: ReadonlySet<string> = (() => {
  const node = nodeById("kids");
  const words = new Set<string>();
  if (!node) return words;
  for (const language of SUPPORTED_LANGUAGES) {
    for (const alias of aliasesOf(node, language)) words.add(normaliseAlias(alias));
  }
  words.delete("");
  return words;
})();

/**
 * Whether this message is asking for the children's stories.
 *
 * Whole-message matching against a short cap, never a substring hunt: "my kids
 * love the radio" is a sentence about something else, and answering it with a
 * list of storybooks is the assistant talking over somebody.
 */
export function parseKidsRequest(text: string | null | undefined): boolean {
  const value = normaliseAlias(text ?? "");
  if (!value || value.length > KIDS_MAX_CHARS) return false;
  return KIDS_WORDS.has(value);
}
