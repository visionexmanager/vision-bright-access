// Visionex Arcade, over WhatsApp.
//
// A hundred and sixteen games on the site, a hundred and thirteen of them built
// to be played without sight, and no way to reach any of them from this number.
// What this feature does is not play them — a chat window cannot — it is the
// part that is genuinely hard on a phone with a screen reader: finding the
// right one among a hundred and sixteen and landing on it in one tap.
//
// So the assertion that matters most is the plainest one: every row a sender
// can press ends in a link that starts that game.

import { describe, expect, it } from "vitest";

const games = await import("../../supabase/functions/_shared/whatsappGames.ts");
const interactive = await import("../../supabase/functions/_shared/whatsappInteractive.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");

const LANGS = languages.SUPPORTED_LANGUAGES;
const LIMITS = catalog.LIST_LIMITS;

/** The list inside a message, narrowed — every one of these is a list. */
function listOf(message: { interactive: { type: string } }) {
  expect(message.interactive.type).toBe("list");
  return (message.interactive as unknown as {
    action: {
      button: string;
      sections: Array<{ rows: Array<{ id: string; title: string; description?: string }> }>;
    };
  }).action;
}

/** Every list this feature can produce, in one language. */
const everyList = (language: (typeof LANGS)[number]) => {
  const pages = Math.ceil(games.CATEGORIES.length / games.GAME_PAGE_SIZE);
  return [
    ...Array.from({ length: pages }, (_, page) =>
      [`cats#${page}`, interactive.gameCategoriesMessage({ page, language })] as const),
    ...games.CATEGORIES.flatMap((category) => {
      const inside = Math.ceil(games.gamesInCategory(category.id).length / games.GAME_PAGE_SIZE);
      return Array.from({ length: inside }, (_, page) =>
        [
          `${category.id}#${page}`,
          interactive.gameCategoryMessage({ category, page, language }),
        ] as const);
    }),
    [
      "matches",
      interactive.gameMatchesMessage({ games: games.GAMES.slice(0, 5), language }),
    ] as const,
  ];
};

// ── One catalogue ────────────────────────────────────────────────────────────

describe("the Arcade, read from where it already lives", () => {
  it("carries every game and every non-empty category", () => {
    expect(games.GAMES.length).toBeGreaterThan(100);
    expect(games.CATEGORIES.length).toBeGreaterThan(20);
    for (const category of games.CATEGORIES) {
      expect(games.gamesInCategory(category.id).length, category.id).toBe(category.count);
    }
  });

  it("puts every game in a category somebody can reach", () => {
    const offered = new Set(games.CATEGORIES.map((category) => category.id));
    for (const game of games.GAMES) {
      expect(
        game.categories.some((id) => offered.has(id)),
        `${game.slug} is in none of the offered categories`,
      ).toBe(true);
    }
  });

  it("reaches every game by paging through the categories", () => {
    const seen = new Set<string>();
    for (const category of games.CATEGORIES) {
      let page = 0;
      for (;;) {
        const current = games.gamePage(category.id, page);
        for (const game of current.items) seen.add(game.slug);
        if (!current.hasMore) break;
        page += 1;
        expect(page, `${category.id} paging`).toBeLessThan(50);
      }
    }
    expect(seen.size).toBe(games.GAMES.length);
  });

  it("clamps a page from a list an older deployment sent", () => {
    const id = games.CATEGORIES[0].id;
    const last = Math.ceil(games.gamesInCategory(id).length / games.GAME_PAGE_SIZE) - 1;
    expect(games.gamePage(id, 9999).page).toBe(last);
    expect(games.gamePage(id, -4).page).toBe(0);
    expect(games.gamePage(id, Number.NaN).page).toBe(0);
    expect(games.categoryPage(9999).items.length).toBeGreaterThan(0);
  });

  it("says nothing about a category it does not have", () => {
    expect(games.categoryById("Racing")).toBeNull();
    expect(games.gamesInCategory("no-such-category")).toEqual([]);
    expect(games.gameBySlug("no-such-game")).toBeNull();
  });
});

// ── Row ids ──────────────────────────────────────────────────────────────────

describe("a tapped row says exactly what was tapped", () => {
  it("round-trips every category and page, including the ones with spaces", () => {
    for (const category of games.CATEGORIES) {
      for (const page of [0, 1, 9]) {
        expect(games.parseCategorySelection(games.categoryRowId(category.id, page)))
          .toEqual({ category: category.id, page });
      }
    }
    // "Tower Defense" and "Business Simulation" carry a space, which is why the
    // page is split off the last dot rather than the first.
    expect(games.parseCategorySelection(games.categoryRowId("Tower Defense", 2)))
      .toEqual({ category: "Tower Defense", page: 2 });
  });

  it("round-trips every game", () => {
    for (const game of games.GAMES) {
      expect(games.parseGameSelection(games.gameRowId(game.slug))).toBe(game.slug);
    }
  });

  it("round-trips the category list's own pages", () => {
    for (const page of [0, 3]) {
      expect(games.parseCategoryListSelection(games.categoryListRowId(page))).toBe(page);
    }
  });

  it("refuses a row id that is not one of these", () => {
    for (const id of ["", "news.abc", "main_menu", "svc.item.x", "game.item.", "explore.games"]) {
      expect(games.parseGameSelection(id), id).toBeNull();
    }
    for (const id of ["", "svc.hub.a.0", "game.cat.", "game.cat.Puzzle"]) {
      expect(games.parseCategorySelection(id), id).toBeNull();
    }
    expect(games.parseCategorySelection("game.cat.Puzzle.-1")).toBeNull();
    expect(games.parseCategoryListSelection("game.cats.x")).toBeNull();
    expect(games.parseGameSelection(null)).toBeNull();
  });
});

// ── Finding a game ───────────────────────────────────────────────────────────

describe("naming a game, or a kind of one", () => {
  const finds = (query: string, slug: string) => {
    const found = games.searchGames(query, 20).map((game) => game.slug);
    expect(found, `${query} -> ${found.slice(0, 6).join(", ")}`).toContain(slug);
  };

  it("finds a game by its name, in both catalogue languages", () => {
    finds("chess", "chess");
    finds("sudoku", "sudoku");
    finds("شطرنج", "chess");
  });

  it("finds games by the kind of thing they are", () => {
    expect(games.searchGames("puzzle", 20).length).toBeGreaterThan(3);
    expect(games.searchGames("memory", 20).length).toBeGreaterThan(0);
  });

  it("answers nothing rather than everything when there is nothing to go on", () => {
    for (const query of ["", "   ", "بدي", "I want", "the", "a", "لعبة"]) {
      expect(games.searchGames(query), query).toEqual([]);
    }
  });

  it("matches a whole word, not a fragment inside another one", () => {
    // Under a `\b` regex — defined on ASCII — «لعب» matches inside «ملعب».
    for (const game of games.searchGames("لعب", 50)) {
      expect(normalised(game.text), game.slug).toMatch(/(^|[^\p{L}\p{N}])لعب([^\p{L}\p{N}]|$)/u);
    }
  });

  it("returns the same list for the same question, every time", () => {
    const once = games.searchGames("word puzzle").map((game) => game.slug);
    expect(games.searchGames("word puzzle").map((game) => game.slug)).toEqual(once);
  });

  it("never returns more than a list has room for", () => {
    expect(games.searchGames("puzzle").length).toBeLessThanOrEqual(games.GAME_MATCH_LIMIT);
  });

  it("opens on its own name, typed in any of the twenty", () => {
    const node = catalog.nodeById("explore.games")!;
    for (const language of LANGS) {
      const words = catalog.aliasesOf(node, language);
      expect(words.length, language).toBeGreaterThan(0);
      for (const word of words) {
        expect(games.parseGamesRequest(word), `${language}: ${word}`).toBe(true);
      }
    }
  });

  it("does not open on a sentence that merely contains the word", () => {
    for (
      const sentence of [
        "the delivery game you people are playing with my order is not funny",
        "شو هاللعبة يلي عم تلعبوها بطلبي، صار له أسبوع",
      ]
    ) {
      expect(games.parseGamesRequest(sentence), sentence).toBe(false);
    }
  });
});

const normalised = (text: string) => text.toLowerCase();

// ── The message a game becomes ───────────────────────────────────────────────

describe("the link that starts the game", () => {
  it("is the game's own route, on every single game", () => {
    // The requirement in one assertion: pick a game, get a link to that game.
    for (const game of games.GAMES) {
      const message = games.formatGame({ game, language: "en" });
      expect(message, game.slug).toContain(`https://visionex.app${game.path}`);
      expect(games.gameUrl(game), game.slug).toMatch(/^https:\/\/visionex\.app\/games\/.+/);
    }
  });

  it("never hands back the Arcade index instead", () => {
    for (const game of games.GAMES) {
      expect(games.gameUrl(game), game.slug).not.toBe(games.ARCADE_URL);
    }
  });

  it("names the game and says what it is", () => {
    const chess = games.gameBySlug("chess")!;
    const message = games.formatGame({ game: chess, language: "en" });
    expect(message).toContain(chess.title_en);
    expect(message).toContain(strings.say("gamePlay", "en").replace("{url}", games.gameUrl(chess)));
  });

  it("answers in Arabic when that is the language", () => {
    const chess = games.gameBySlug("chess")!;
    expect(games.formatGame({ game: chess, language: "ar" })).toContain(chess.title_ar);
    expect(games.gameText(chess, "tr").title).toBe(chess.title_en);
  });

  it("warns before a game that needs sight, and only before those", () => {
    const warning = strings.say("gameNotAccessible", "en");
    const unsighted = games.GAMES.filter((game) => !game.accessible);
    expect(unsighted.length).toBeGreaterThan(0);
    for (const game of unsighted) {
      expect(games.formatGame({ game, language: "en" }), game.slug).toContain(warning);
    }
    for (const game of games.GAMES.filter((game) => game.accessible)) {
      expect(games.formatGame({ game, language: "en" }), game.slug).not.toContain(warning);
    }
  });

  it("leaves no placeholder standing, in any language", () => {
    for (const game of [games.GAMES[0], games.GAMES.find((item) => !item.accessible)!]) {
      for (const language of LANGS) {
        expect(games.formatGame({ game, language }), language).not.toMatch(/\{[a-z]+\}/i);
      }
    }
  });

  it("is written in all twenty, not in two", () => {
    for (
      const key of ["gamesHeading", "gamesHint", "gamesNone", "gamesMatches", "gamePlay", "gameNotAccessible"] as const
    ) {
      for (const language of LANGS) {
        expect(strings.say(key, language).trim().length, `${key}/${language}`).toBeGreaterThan(0);
      }
    }
  });
});

// ── What Meta will accept ────────────────────────────────────────────────────

describe("no message this builds is one Meta will refuse", () => {
  it("keeps every list inside ten rows, in every language", () => {
    for (const language of LANGS) {
      for (const [name, message] of everyList(language)) {
        const rows = listOf(message).sections.flatMap((section) => section.rows);
        expect(rows.length, `${name}/${language}`).toBeLessThanOrEqual(LIMITS.rows);
        expect(rows.length, `${name}/${language}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every label inside its own limit, in every language", () => {
    for (const language of LANGS) {
      for (const [name, message] of everyList(language)) {
        const action = listOf(message);
        expect([...action.button].length, `button/${name}/${language}`)
          .toBeLessThanOrEqual(LIMITS.button);
        for (const section of action.sections) {
          for (const row of section.rows) {
            expect([...row.title].length, `${row.id}/${name}/${language}`)
              .toBeLessThanOrEqual(LIMITS.rowTitle);
            expect(row.title.trim().length, `${row.id}/${name}/${language}`).toBeGreaterThan(0);
            if (row.description) {
              expect([...row.description].length, `${row.id} desc/${name}/${language}`)
                .toBeLessThanOrEqual(LIMITS.rowDescription);
            }
          }
        }
      }
    }
  });

  it("gives every list a way back out", () => {
    for (const language of LANGS) {
      for (const [name, message] of everyList(language)) {
        const ids = listOf(message).sections.flatMap((section) => section.rows.map((row) => row.id));
        expect(ids, `${name}/${language}`).toContain(interactive.MAIN_MENU_ID);
      }
    }
  });

  it("carries a text twin for the sender outside the interactive window", () => {
    for (const language of LANGS) {
      for (const [name, message] of everyList(language)) {
        expect(message.text.trim().length, `${name}/${language}`).toBeGreaterThan(0);
        expect(message.text, `${name}/${language}`).not.toMatch(/\{[a-z]+\}/i);
      }
    }
  });
});

describe("the row on the menu", () => {
  it("is offered, under Learn & explore", () => {
    const node = catalog.nodeById("explore.games");
    expect(node).toBeTruthy();
    expect(node!.enabled).toBe(true);
    expect(catalog.offeredChildrenOf("explore").map((child) => child.id)).toContain("explore.games");
  });

  it("names itself in every language, inside a row's limits", () => {
    const node = catalog.nodeById("explore.games")!;
    for (const language of LANGS) {
      const title = catalog.localized(node.title, language);
      const description = catalog.localized(node.description, language);
      expect([...title].length, language).toBeLessThanOrEqual(LIMITS.rowTitle);
      expect([...description].length, language).toBeLessThanOrEqual(LIMITS.rowDescription);
      expect(title.trim().length, language).toBeGreaterThan(0);
    }
  });
});
