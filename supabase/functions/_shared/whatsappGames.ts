// Visionex Arcade, over WhatsApp.
//
// A hundred and sixteen games live on visionex.app and none of them were
// reachable from this number. That is not a small gap for this audience: a
// hundred and thirteen of them are built to be played without sight, which is
// most of what the Arcade *is*, and a blind player had no way to find out any
// of it existed unless somebody sat them in front of a browser.
//
// ── What this feature is, and is not ────────────────────────────────────────
//
// It does not play games. A chat window cannot, and pretending otherwise would
// produce a worse version of something that already works. What it does is the
// part that is genuinely hard on a phone with a screen reader: *finding* the
// right game among a hundred and sixteen, in your own language, and then
// landing on it in one tap.
//
// So every game answers with the link that starts it — `/games/<slug>`, the
// same route the site's own card links to, not the Arcade index a player would
// then have to navigate again.
//
// ── One catalogue, again ────────────────────────────────────────────────────
//
// `src/features/arcade/catalog.ts` is the single source of truth, and this
// reads the snapshot `scripts/generate-games-index.ts` derives from it, exactly
// as the Service Center directory reads its own. A game added on the site
// appears here when the snapshot is regenerated; `src/test/games-index.test.ts`
// fails the moment the two disagree.
//
// ── The category labels are not written here ────────────────────────────────
//
// Thirty-one categories in twenty languages is six hundred and twenty strings,
// and the site had already written every one of them: `games.cat.Puzzle` and
// its siblings live in `src/i18n`, translated, because /games renders the same
// filter list. The generator reads them out of there. Inventing a second
// vocabulary for the same thirty-one words would be inventing somewhere for the
// two to disagree.
//
// Pure and provider-free: no `Deno`, no fetch, no database. The JSON is a build
// artefact imported at module load, and every rule here is exercised by Vitest.

import index from "./data/arcadeCatalog.json" with { type: "json" };
import type { Language } from "./whatsappCatalog.ts";
import { aliasesOf, nodeById } from "./whatsappCatalog.ts";
import { SUPPORTED_LANGUAGES } from "./whatsappLanguages.ts";
import { normaliseAlias } from "./whatsappRouter.ts";
import { say } from "./whatsappStrings.ts";

/** The site itself. Every game path in the snapshot is relative to it. */
export const SITE_ORIGIN = "https://visionex.app";

/** The Arcade's own page, for somebody who wants to browse it with their eyes. */
export const ARCADE_URL = `${SITE_ORIGIN}/games`;

/** One game, exactly as `IndexedGame` writes it. */
export interface GameRecord {
  slug: string;
  path: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  categories: string[];
  difficulty: string;
  age: string;
  players: string;
  accessible: boolean;
  text: string;
}

/** One category, with the site's own label in each locale it has one for. */
export interface GameCategory {
  id: string;
  count: number;
  labels: Record<string, string>;
}

interface GamesIndexShape {
  games: GameRecord[];
  categories: GameCategory[];
  difficulties: Record<string, Record<string, string>>;
}

const INDEX = index as GamesIndexShape;

/** Every game the Arcade has, in the catalogue's own order. */
export const GAMES: readonly GameRecord[] = INDEX.games;

/**
 * Every category that has a game in it, largest first.
 *
 * The ordering is the index's, not this file's — see the note there. What
 * matters here is that it is stable: a list read aloud that reshuffles between
 * two visits is a list nobody can learn.
 */
export const CATEGORIES: readonly GameCategory[] = INDEX.categories;

/** A category's name in the sender's language, or in English. */
export function categoryLabel(category: GameCategory, language: Language): string {
  return category.labels[language] ?? category.labels.en ?? category.id;
}

/** A difficulty in the sender's language, or in English, or not at all. */
export function difficultyLabel(difficulty: string, language: Language): string {
  const labels = INDEX.difficulties[difficulty];
  if (!labels) return "";
  return labels[language] ?? labels.en ?? "";
}

/** One category by its id, or null. */
export const categoryById = (id: string): GameCategory | null =>
  CATEGORIES.find((category) => category.id === id) ?? null;

/** The games carrying a category, in catalogue order. */
export const gamesInCategory = (id: string): GameRecord[] =>
  GAMES.filter((game) => game.categories.includes(id));

/** One game by its slug, or null. */
export const gameBySlug = (slug: string): GameRecord | null =>
  GAMES.find((game) => game.slug === slug) ?? null;

/**
 * Rows on one page.
 *
 * Seven, because Meta allows ten rows in a list *in total* and the message that
 * carries them already spends two on Back and Main menu and one more on "show
 * me the rest". An eleventh row is not truncated — the whole message is
 * rejected — so the ceiling is arithmetic, not taste.
 */
export const GAME_PAGE_SIZE = 7;

export interface Page<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}

/** One page of anything, clamped to what exists. */
function paged<T>(all: readonly T[], page: number): Page<T> {
  const pages = Math.max(1, Math.ceil(all.length / GAME_PAGE_SIZE));
  const index = Number.isFinite(page) ? Math.min(Math.max(Math.trunc(page), 0), pages - 1) : 0;
  const start = index * GAME_PAGE_SIZE;
  return {
    items: all.slice(start, start + GAME_PAGE_SIZE),
    page: index,
    hasMore: start + GAME_PAGE_SIZE < all.length,
  };
}

/**
 * One page of the category list.
 *
 * A page number past the end returns the last page rather than an empty list:
 * the id came from a row this channel sent, but a redeployed snapshot can have
 * fewer categories in it than the message the sender is still scrolling.
 */
export const categoryPage = (page: number): Page<GameCategory> => paged(CATEGORIES, page);

/** One page of the games inside a category. */
export const gamePage = (categoryId: string, page: number): Page<GameRecord> =>
  paged(gamesInCategory(categoryId), page);

// ── Row ids ──────────────────────────────────────────────────────────────────
//
// Prefixed so the router can tell one of these from a catalog node id without
// having to know what a game is. The same shape `news.` and `svc.` use.

export const CATEGORY_LIST_PREFIX = "game.cats.";
export const CATEGORY_ID_PREFIX = "game.cat.";
export const GAME_ID_PREFIX = "game.item.";

/** The row that opens the category list at a page. */
export const categoryListRowId = (page = 0): string => `${CATEGORY_LIST_PREFIX}${page}`;

/** The row that opens one category at a page. */
export const categoryRowId = (id: string, page = 0): string => `${CATEGORY_ID_PREFIX}${id}.${page}`;

/** The row that opens one game. */
export const gameRowId = (slug: string): string => `${GAME_ID_PREFIX}${slug}`;

/** The page inside a tapped category-list row, or null. */
export function parseCategoryListSelection(id: string | null | undefined): number | null {
  if (!id || !id.startsWith(CATEGORY_LIST_PREFIX)) return null;
  const page = Number.parseInt(id.slice(CATEGORY_LIST_PREFIX.length), 10);
  return Number.isFinite(page) && page >= 0 ? page : null;
}

/**
 * The category and page inside a tapped row, or null.
 *
 * Split on the *last* dot, because a category id may contain anything but a
 * dot — "Tower Defense" and "Business Simulation" both carry a space, and a
 * split on the first dot would cut "Business" off from "Simulation".
 */
export function parseCategorySelection(
  id: string | null | undefined,
): { category: string; page: number } | null {
  if (!id || !id.startsWith(CATEGORY_ID_PREFIX)) return null;
  const rest = id.slice(CATEGORY_ID_PREFIX.length);
  const cut = rest.lastIndexOf(".");
  if (cut <= 0) return null;
  const category = rest.slice(0, cut).trim();
  const page = Number.parseInt(rest.slice(cut + 1), 10);
  if (!category || !Number.isFinite(page) || page < 0) return null;
  return { category, page };
}

/** The game slug inside a tapped row, or null. */
export function parseGameSelection(id: string | null | undefined): string | null {
  if (!id || !id.startsWith(GAME_ID_PREFIX)) return null;
  const slug = id.slice(GAME_ID_PREFIX.length).trim();
  return slug ? slug : null;
}

// ── The words that ask for this ──────────────────────────────────────────────

/** Longest a message can be and still be read as "open the games". */
const GAMES_MAX_CHARS = 40;

/**
 * Every word that names the Arcade, in every language, folded once.
 *
 * Read from the catalog node rather than kept here, for the reason
 * `whatsappNews.ts` gives: the node already declares its aliases so a
 * switched-off feature can be refused by name, and two hand-maintained lists of
 * the same twenty languages is one list going stale.
 */
const GAMES_WORDS: ReadonlySet<string> = (() => {
  const node = nodeById("explore.games");
  const words = new Set<string>();
  if (!node) return words;
  for (const language of SUPPORTED_LANGUAGES) {
    for (const alias of aliasesOf(node, language)) words.add(normaliseAlias(alias));
  }
  words.delete("");
  return words;
})();

/**
 * Whether this message is asking for the games.
 *
 * Whole-message against a short cap, never a substring hunt: "the delivery game
 * you people are playing with my order" is a complaint, and answering it with a
 * games menu would be the assistant talking over somebody.
 */
export function parseGamesRequest(text: string | null | undefined): boolean {
  const value = normaliseAlias(text ?? "");
  if (!value || value.length > GAMES_MAX_CHARS) return false;
  return GAMES_WORDS.has(value);
}

// ── Search ───────────────────────────────────────────────────────────────────

/** Most matches worth showing at once. Five leaves room for the way back. */
export const GAME_MATCH_LIMIT = 5;

/** Words too common to carry a match on their own, in the two search languages. */
const STOP_WORD_SOURCE: readonly string[] = [
  "a",
  "an",
  "the",
  "and",
  "for",
  "with",
  "me",
  "my",
  "want",
  "need",
  "play",
  "game",
  "games",
  "some",
  "please",
  "بدي",
  "بدنا",
  "اريد",
  "أريد",
  "احتاج",
  "لو",
  "سمحت",
  "في",
  "من",
  "على",
  "لعبة",
  "العاب",
  "ألعاب",
  "الالعاب",
  "العب",
];

/**
 * The stop words, folded the same way a message is.
 *
 * `normaliseAlias` rewrites Arabic before comparing — «ة» becomes «ه», the
 * hamza forms collapse onto «ا», diacritics go — so a stop word written the way
 * a keyboard types it never matches the folded token. «خدمة» folds to «خدمه»
 * and the set was being asked about «خدمة»: the word was in the list and the
 * list did nothing. Folding both sides is the fix that cannot drift, rather
 * than hand-writing every entry pre-folded and hoping the next one is too.
 */
const STOP_WORDS: ReadonlySet<string> = new Set(STOP_WORD_SOURCE.map(normaliseAlias));

/**
 * The games that match what somebody typed, best first.
 *
 * Token overlap against the record's own retrieval string, which already holds
 * the title, the description and the categories in both languages. A token has
 * to appear as a *word* — «لعب» must not match «ملعب» — so each is tested
 * against boundaries the Arabic and Latin scripts both respect: the surrounding
 * character must not be a letter or a digit.
 *
 * Ties break on catalogue order rather than on nothing, so the same query
 * always produces the same list.
 */
export function searchGames(query: string | null | undefined, limit = GAME_MATCH_LIMIT): GameRecord[] {
  const folded = normaliseAlias(query ?? "");
  if (!folded) return [];

  const tokens = folded.split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  if (tokens.length === 0) return [];

  const scored = GAMES.map((game, order) => {
    const haystack = normaliseAlias(game.text);
    let score = 0;
    for (const token of tokens) if (containsWord(haystack, token)) score += 1;
    return { game, score, order };
  }).filter((row) => row.score > 0);

  scored.sort((a, b) => (b.score - a.score) || (a.order - b.order));
  return scored.slice(0, Math.max(limit, 0)).map((row) => row.game);
}

/**
 * Whether a folded haystack contains a token as a whole word.
 *
 * Written by hand rather than with `\b`, which is defined on ASCII word
 * characters and so treats every Arabic letter as a boundary — under `\b` the
 * token «لعب» matches inside «ملعب», which is the bug this exists to avoid.
 */
function containsWord(haystack: string, token: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(token, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : haystack[at - 1];
    const after = haystack[at + token.length] ?? "";
    if (!isLetter(before) && !isLetter(after)) return true;
    from = at + 1;
  }
}

const isLetter = (character: string): boolean => character !== "" && /\p{L}|\p{N}/u.test(character);

// ── Wording ──────────────────────────────────────────────────────────────────

/**
 * A game's own words, in the sender's language or in English.
 *
 * Arabic and English are what the site wrote. Everything else falls back to
 * English rather than to an empty row — the same honest gap `whatsappNews.ts`
 * documents for an article nobody has translated yet.
 */
export function gameText(game: GameRecord, language: Language): { title: string; description: string } {
  const arabic = language === "ar";
  return {
    title: (arabic ? game.title_ar : game.title_en) || game.title_en,
    description: (arabic ? game.description_ar : game.description_en) || game.description_en,
  };
}

/** The route that starts the game, absolute, so it is tappable in a chat. */
export const gameUrl = (game: GameRecord): string =>
  game.path.startsWith("http") ? game.path : `${SITE_ORIGIN}${game.path}`;

/**
 * One game, as the message a sender receives after tapping its row.
 *
 * Title, what it is, how hard it is, and then the link that opens it — the
 * game's own route, not the Arcade index, because a player who has just chosen
 * from a list should not be handed a list.
 *
 * The accessibility line only appears when a game is *not* playable without
 * sight. Three of the hundred and sixteen are not, and saying so before
 * somebody opens one is the difference between a channel that knows its
 * audience and one that has a games section. Saying it on the other hundred
 * and thirteen would be noise read aloud a hundred and thirteen times.
 */
export function formatGame(params: { game: GameRecord; language: Language }): string {
  const { game, language } = params;
  const { title, description } = gameText(game, language);

  const lines = [`🎮 *${title}*`];
  if (description) {
    lines.push("");
    lines.push(description);
  }

  const difficulty = difficultyLabel(game.difficulty, language);
  if (difficulty) lines.push(say("gameDifficulty", language).replace("{level}", difficulty));
  if (!game.accessible) lines.push(say("gameNotAccessible", language));

  lines.push("");
  lines.push(say("gamePlay", language).replace("{url}", gameUrl(game)));
  return lines.join("\n");
}
