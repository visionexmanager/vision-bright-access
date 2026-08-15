import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/i18n/en";
import { ARCADE_AI_REASON_KEYS } from "@/features/arcade/ai/ArcadeAI";

const dictionary = en as Record<string, string>;
const gamesPage = readFileSync("src/pages/Games.tsx", "utf8");

describe("the Arcade landing page renders through t()", () => {
  it("never branches its copy on a single locale", () => {
    // A `lang === "ar" ? … : …` ternary is not a translation: it leaves the
    // other eighteen locales on the English half and nothing else catches it.
    expect(gamesPage).not.toContain('lang === "ar"');
    expect(gamesPage).not.toContain("lang === 'ar'");
    expect(gamesPage).not.toMatch(/\bar\s*\?\s*"/);
  });

  it("defines every key the page asks for", () => {
    const keys = [...gamesPage.matchAll(/\bt\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);

    expect(keys.length).toBeGreaterThan(40);
    expect(keys.filter((key) => !dictionary[key]?.trim()), "add these to all 20 locales").toEqual([]);
  });

  it("translates the recommender's explanations", () => {
    // recommendGames has no locale of its own, so it returns keys. A missing
    // one renders as "games.arcade.ai.reason.new" under the game's title.
    expect(ARCADE_AI_REASON_KEYS.length).toBe(3);
    expect(ARCADE_AI_REASON_KEYS.filter((key) => !dictionary[key]?.trim())).toEqual([]);
  });

  it("anchors the hero button to the featured section by id, not by title text", () => {
    // The anchor used to be chosen by comparing the heading to "Featured Games"
    // or "الألعاب المميزة", so translating the title broke the jump link.
    expect(gamesPage).toContain('href="#featured"');
    expect(gamesPage).toContain('<GameSection id="featured"');
    expect(gamesPage).toContain("<section id={id} aria-labelledby={`${id}-title`}");
  });
});
