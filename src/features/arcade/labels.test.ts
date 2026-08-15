import { describe, expect, it } from "vitest";
import en from "@/i18n/en";
import { ARCADE_CATEGORIES, type ArcadeAge, type ArcadeDifficulty } from "@/features/arcade/catalog";
import { ageLabelKey, categoryLabelKey, difficultyLabelKey } from "@/features/arcade/labels";

// t() falls back to the key when a translation is missing, so a catalog value
// without a key renders literally as "games.cat.Foo" on the card. Nothing else
// in the build catches that: it type-checks, lints, and renders.

const dictionary = en as Record<string, string>;
const DIFFICULTIES: ArcadeDifficulty[] = ["Easy", "Medium", "Hard"];
const AGES: ArcadeAge[] = ["Everyone", "Kids", "Teens"];

describe("every arcade catalog value has a translation key", () => {
  it("covers all categories", () => {
    const missing = ARCADE_CATEGORIES.filter((category) => !dictionary[categoryLabelKey(category)]);
    expect(missing, "add these to all 20 locales").toEqual([]);
  });

  it("covers all difficulties and ages", () => {
    expect(DIFFICULTIES.filter((value) => !dictionary[difficultyLabelKey(value)])).toEqual([]);
    expect(AGES.filter((value) => !dictionary[ageLabelKey(value)])).toEqual([]);
  });

  it("never emits a key containing a space", () => {
    // "Tower Defense" has to collapse, or the key breaks the parity scanner.
    const keys = ARCADE_CATEGORIES.map(categoryLabelKey);
    expect(keys.filter((key) => /\s/.test(key))).toEqual([]);
    expect(categoryLabelKey("Tower Defense")).toBe("games.cat.TowerDefense");
  });

  it("resolves to real words, not the key itself", () => {
    for (const category of ARCADE_CATEGORIES) {
      const key = categoryLabelKey(category);
      expect(dictionary[key], `${key} must not echo its own key`).not.toBe(key);
      expect(dictionary[key]?.trim()).toBeTruthy();
    }
  });
});

describe("catalog values stay English identifiers", () => {
  it("keeps the values the filters compare against untranslated", () => {
    // /games filters by strict equality on these strings, so translating them
    // in place would silently return zero results in every non-English locale.
    expect(ARCADE_CATEGORIES).toContain("Puzzle");
    expect(ARCADE_CATEGORIES).toContain("Tower Defense");
    expect(difficultyLabelKey("Medium")).toBe("games.difficulty.medium");
    expect(ageLabelKey("Teens")).toBe("games.age.Teens");
  });
});
