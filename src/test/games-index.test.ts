import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCADE_CATEGORIES, ARCADE_GAMES } from "@/features/arcade/catalog";
import { buildGamesIndex, GAMES_INDEX_PATH } from "@/features/arcade/gamesIndex";

// The Arcade catalogue is indexed rather than copied — the same decision the
// Service Center took. That only holds if the snapshot the WhatsApp channel
// reads cannot drift from the catalogue it was derived from.

const snapshot = JSON.parse(readFileSync(GAMES_INDEX_PATH, "utf8")) as ReturnType<typeof buildGamesIndex>;
const routes = readFileSync("src/App.tsx", "utf8");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");

describe("arcade index snapshot", () => {
  it("matches the catalogue exactly", () => {
    // Regenerate with: npx vite-node scripts/generate-games-index.ts
    expect(snapshot).toEqual(buildGamesIndex());
  });

  it("covers every game in the catalogue", () => {
    expect(snapshot.games).toHaveLength(ARCADE_GAMES.length);
    expect(new Set(snapshot.games.map((game) => game.slug)).size).toBe(ARCADE_GAMES.length);
  });

  it("carries both languages so either finds a game", () => {
    for (const game of snapshot.games) {
      const entry = ARCADE_GAMES.find((item) => item.slug === game.slug)!;
      expect(game.text, `${game.slug} missing English title`).toContain(entry.title);
      expect(game.text, `${game.slug} missing Arabic title`).toContain(entry.titleAr);
    }
  });
});

describe("the link a player is handed", () => {
  it("is a route the site actually registers, for every game", () => {
    // The requirement this feature exists for: picking a game hands over a link
    // that starts *that game*. A path the router does not know is a 404 with a
    // game's name on it, which is worse than no row.
    for (const game of snapshot.games) {
      expect(routes, `${game.slug} → ${game.path}`).toContain(`path="${game.path}"`);
    }
  });

  it("points at the game itself, never at the Arcade index", () => {
    for (const game of snapshot.games) {
      expect(game.path, game.slug).toMatch(/^\/games\/.+/);
      expect(game.path, game.slug).not.toBe("/games");
    }
  });
});

describe("the categories", () => {
  it("offers no category that has no games", () => {
    // "Racing" is declared in the catalogue and empty. A row that opens an
    // empty list is worse than no row.
    for (const category of snapshot.categories) {
      expect(category.count, category.id).toBeGreaterThan(0);
      expect(ARCADE_GAMES.filter((game) => game.categories.includes(category.id as never)))
        .toHaveLength(category.count);
    }
    const empty = ARCADE_CATEGORIES.filter((id) =>
      !ARCADE_GAMES.some((game) => game.categories.includes(id))
    );
    for (const id of empty) {
      expect(snapshot.categories.map((category) => category.id), id).not.toContain(id);
    }
  });

  it("loses no category that does have games", () => {
    const withGames = ARCADE_CATEGORIES.filter((id) =>
      ARCADE_GAMES.some((game) => game.categories.includes(id))
    );
    expect(snapshot.categories.map((category) => category.id).sort()).toEqual([...withGames].sort());
  });

  it("puts the biggest first, so a paged list reads usefully", () => {
    const counts = snapshot.categories.map((category) => category.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("uses the site's own translations rather than a second set", () => {
    // Thirty-one categories in twenty languages is six hundred and twenty
    // strings, and the site had written every one of them for the /games
    // filters. This asserts they were read from there, not reinvented.
    for (const category of snapshot.categories) {
      for (const language of languages.SUPPORTED_LANGUAGES) {
        const label = category.labels[language];
        expect(label, `${category.id}/${language}`).toBeTruthy();
        expect(label, `${category.id}/${language}`).not.toMatch(/^games\.cat\./);
      }
    }
  });

  it("names every difficulty in at least English", () => {
    for (const level of ["Easy", "Medium", "Hard"]) {
      expect(snapshot.difficulties[level]?.en, level).toBeTruthy();
    }
  });
});

describe("no duplicate arcade catalogue", () => {
  it("keeps the WhatsApp module reading the snapshot, not a list of its own", () => {
    const module = readFileSync("supabase/functions/_shared/whatsappGames.ts", "utf8");
    expect(module).toContain('from "./data/arcadeCatalog.json"');
    // No hand-maintained game or category list: those would be the second
    // catalogue this whole design exists to avoid.
    expect(module).not.toMatch(/const\s+(GAME|CATEGOR)\w*\s*(:|=)\s*\[/);
  });
});
