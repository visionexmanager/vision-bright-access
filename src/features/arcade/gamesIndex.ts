import { ARCADE_CATEGORIES, ARCADE_GAMES, type ArcadeCategory, type ArcadeDifficulty } from "./catalog";
import { categoryLabelKey, difficultyLabelKey } from "./labels";
import { SUPPORTED_LOCALES, translationsFor } from "./gamesIndexLocales";

/**
 * The Arcade, derived for consumers that cannot import from `src/`.
 *
 * The same decision the Service Center took, for the same reason: `catalog.ts`
 * stays the single source of truth and is *indexed* rather than copied into a
 * table. A Deno edge function cannot import this file — it pulls in a hundred
 * image assets through Vite's asset pipeline — so the shape below is
 * snapshotted to JSON by `scripts/generate-games-index.ts` and read from there.
 *
 * `src/test/games-index.test.ts` fails the moment the snapshot drifts, which is
 * what makes "one catalogue" true rather than intended.
 */
export interface IndexedGame {
  slug: string;
  /** The route that starts the game. Already absolute from the site root. */
  path: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  categories: string[];
  difficulty: string;
  age: string;
  players: string;
  /**
   * Whether the game is playable without sight.
   *
   * Carried per game rather than treated as a category, even though the
   * catalogue also lists "Accessible" among its categories, because 113 of 116
   * games have it: as a filter it selects almost everything, and as a *fact
   * about this game* it is the single most important line a blind player reads
   * before deciding whether to open it.
   */
  accessible: boolean;
  /** One retrieval string covering both languages, so either finds the game. */
  text: string;
}

/**
 * One category, with the label the site already shows for it.
 *
 * The labels are not written here and are not written in the WhatsApp strings
 * file either — they are read out of `src/i18n`, where the site has translated
 * every one of them into all twenty locales already. Inventing a second set
 * would be inventing a second vocabulary for the same thing, in twenty
 * languages, to say what the site is already saying.
 */
export interface IndexedCategory {
  id: string;
  /** How many games carry it. A category with none is not indexed at all. */
  count: number;
  /** Locale code to label, for every locale the site speaks. */
  labels: Record<string, string>;
}

export interface GamesIndex {
  games: IndexedGame[];
  categories: IndexedCategory[];
  /**
   * "Easy" / "Medium" / "Hard", in the site's own words.
   *
   * Read out of `src/i18n` like the category labels, and for the same reason.
   * Three of the twenty locales have not translated these yet, which is why the
   * reader falls back to English rather than to a key — a visible gap in the
   * site's dictionary, not a missing string in the WhatsApp channel.
   */
  difficulties: Record<string, Record<string, string>>;
}

/** Every game, and every category that actually has one. */
export function buildGamesIndex(): GamesIndex {
  const games: IndexedGame[] = ARCADE_GAMES.map((entry) => ({
    slug: entry.slug,
    path: entry.to,
    title_en: entry.title,
    title_ar: entry.titleAr,
    description_en: entry.description,
    description_ar: entry.descriptionAr,
    categories: [...entry.categories],
    difficulty: entry.difficulty,
    age: entry.age,
    players: entry.players,
    accessible: entry.accessible === true,
    text: [
      entry.title,
      entry.titleAr,
      entry.description,
      entry.descriptionAr,
      ...entry.categories,
      entry.difficulty,
      entry.age,
    ]
      .filter(Boolean)
      .join(". "),
  }));

  const categories: IndexedCategory[] = ARCADE_CATEGORIES
    .map((id) => ({
      id: id as string,
      count: ARCADE_GAMES.filter((entry) => entry.categories.includes(id as ArcadeCategory)).length,
      labels: labelsFor(id as ArcadeCategory),
    }))
    // A category with no games is not offered. "Racing" is declared and empty,
    // and a row that opens an empty list is worse than no row at all.
    .filter((category) => category.count > 0)
    // Largest first, then the catalogue's own declared order for ties. This is
    // a presentation decision and it belongs to this index rather than to the
    // site: the list is paged seven at a time and read aloud, so the categories
    // most people want have to be on the first page rather than the fifth.
    .sort((a, b) => b.count - a.count || declaredOrder(a.id) - declaredOrder(b.id));

  const difficulties: Record<string, Record<string, string>> = {};
  for (const level of ["Easy", "Medium", "Hard"] as ArcadeDifficulty[]) {
    difficulties[level] = labelsForKey(difficultyLabelKey(level));
  }

  return { games, categories, difficulties };
}

const declaredOrder = (id: string): number =>
  (ARCADE_CATEGORIES as readonly string[]).indexOf(id);

/** The site's own label for a category, in each locale it has one for. */
const labelsFor = (category: ArcadeCategory): Record<string, string> =>
  labelsForKey(categoryLabelKey(category));

/** One i18n key, read out of every locale that has translated it. */
function labelsForKey(key: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const value = translationsFor(locale)[key];
    // A locale the site has not translated this into is left out rather than
    // filled with the key: the reader falls back to English, which is a gap in
    // the data and reads as one, instead of "games.cat.TowerDefense".
    if (typeof value === "string" && value.trim() && value !== key) labels[locale] = value.trim();
  }
  return labels;
}

export const GAMES_INDEX_PATH = "supabase/functions/_shared/data/arcadeCatalog.json";
