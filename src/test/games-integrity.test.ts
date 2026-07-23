import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function quotedValues(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

describe("games integration", () => {
  it("registers every game card destination as an application route", () => {
    const gamesPage = read("src/pages/Games.tsx");
    const app = read("src/App.tsx");
    const destinations = quotedValues(gamesPage, /\bto:\s*"([^"]+)"/g);
    const routes = new Set(
      quotedValues(app, /<Route\s+path="([^"]+)"/g).filter((path) =>
        path.startsWith("/games"),
      ),
    );

    expect(destinations).toHaveLength(21);
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations.filter((path) => !routes.has(path))).toEqual([]);
  });

  it("defines every static game translation key in every supported language", () => {
    const gameSources = [
      "src/pages/Games.tsx",
      "src/pages/MemoryGame.tsx",
      "src/pages/WordPuzzle.tsx",
      "src/pages/QuizChallenge.tsx",
      "src/components/game/GameEconomyGate.tsx",
      "src/pages/games/MusicEarMaster.tsx",
    ].map(read).join("\n");
    const keys = new Set(quotedValues(gameSources, /\bt\(\s*"([^"]+)"\s*\)/g));
    const languages = ["en", "ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"];

    for (const language of languages) {
      const dictionary = read(`src/i18n/${language}.ts`);
      const missing = [...keys].filter(
        (key) => !dictionary.includes(`"${key}"`),
      );
      expect(missing, `${language} is missing game translations`).toEqual([]);
    }
  });
});
