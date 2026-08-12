import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Keep this explicit list aligned with LanguageContext.supportedLangs so CI
// rejects incomplete locale activation.
const locales = ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"];

function dictionaryKeys(locale: string) {
  const sources = [`src/i18n/${locale}.ts`, `src/i18n/chunks/${locale}.ts`]
    .filter((path) => {
      try {
        readFileSync(path, "utf8");
        return true;
      } catch {
        return false;
      }
    })
    .map((path) => readFileSync(path, "utf8"));
  const source = sources.join("\n");
  return [...source.matchAll(/^\s{2}"([^"]+)":/gm)].map((match) => match[1]);
}

describe("global i18n integrity", () => {
  it("checks every dictionary that ships in src/i18n", () => {
    const shipped = readdirSync("src/i18n")
      .filter((file) => file.endsWith(".ts") && file !== "academyDomText.ts")
      .map((file) => file.replace(/\.ts$/, ""));

    expect([...shipped].sort()).toEqual([...locales].sort());
  });

  it("keeps every locale at full key parity without duplicate keys", () => {
    const englishKeys = dictionaryKeys("en");
    const expected = new Set(englishKeys);

    expect(expected.size).toBe(englishKeys.length);
    expect(expected.size).toBeGreaterThan(12_000);

    for (const locale of locales.filter((value) => value !== "en")) {
      const keys = dictionaryKeys(locale);
      const unique = new Set(keys);
      const missing = englishKeys.filter((key) => !unique.has(key));
      const extra = keys.filter((key) => !expected.has(key));

      expect(unique.size, `${locale} contains duplicate translation keys`).toBe(keys.length);
      expect(missing, `${locale} is missing translation keys`).toEqual([]);
      expect(extra, `${locale} contains keys absent from English`).toEqual([]);
    }
  });

  it("never builds translated sentences by replacing isolated DOM words", () => {
    const source = readFileSync("src/contexts/LanguageContext.tsx", "utf8");

    expect(source).toContain("type SortedEntries = null");
    expect(source).toContain("return { map, sorted: null }");
    expect(source).not.toContain("value.replace(sorted.pattern");
    expect(source).not.toContain("new RegExp(");
  });
});
