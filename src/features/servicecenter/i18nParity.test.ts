import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the rule this repo has been bitten by before: a new key added to
 * `en.ts` only, leaving the other ten locales silently falling back to English.
 *
 * Reads the locale files as text rather than importing them, so the check runs
 * without pulling 12k-key modules into the test bundle.
 */

const LOCALES = ["en", "ar", "es", "de", "pt", "fr", "tr", "ru", "zh", "hi", "ur"];
const I18N_DIR = path.resolve(__dirname, "../../i18n");
const SRC_DIR = path.resolve(__dirname, "../..");

function localeSource(locale: string): string {
  const sources = [fs.readFileSync(path.join(I18N_DIR, `${locale}.ts`), "utf8")];
  const chunk = path.join(I18N_DIR, "chunks", `${locale}.ts`);
  if (fs.existsSync(chunk)) sources.push(fs.readFileSync(chunk, "utf8"));
  return sources.join("\n");
}

function keysIn(locale: string): Set<string> {
  const source = localeSource(locale);
  const keys = new Set<string>();
  for (const match of source.matchAll(/^\s{2}"([^"]+)":/gm)) keys.add(match[1]);
  return keys;
}

/**
 * Every `sc.*` key literal the Service Center references. Matches any string
 * literal rather than only `t("…")`, so keys chosen inside a ternary or a
 * lookup table are covered too.
 */
function referencedKeys(): Set<string> {
  const files = [
    ...collect(path.join(SRC_DIR, "features/servicecenter")),
    path.join(SRC_DIR, "pages/ServiceCenter.tsx"),
    path.join(SRC_DIR, "pages/services/ServiceProfile.tsx"),
    path.join(SRC_DIR, "pages/services/MyServiceRequests.tsx"),
  ];

  const keys = new Set<string>();
  for (const file of files) {
    if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/"(sc\.[a-zA-Z][a-zA-Z0-9.]*)"/g)) keys.add(match[1]);
  }
  return keys;
}

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...collect(full));
    else if (!item.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("Service Center i18n parity", () => {
  const english = keysIn("en");
  const scKeys = [...english].filter((key) => key.startsWith("sc."));

  it("added Service Center keys to English", () => {
    expect(scKeys.length).toBeGreaterThan(80);
  });

  it.each(LOCALES.filter((l) => l !== "en"))("has every sc.* key in %s", (locale) => {
    const localeKeys = keysIn(locale);
    const missing = scKeys.filter((key) => !localeKeys.has(key));
    expect(missing, `${locale} is missing: ${missing.join(", ")}`).toEqual([]);
  });

  it.each(LOCALES)("has no duplicate sc.* keys in %s", (locale) => {
    const source = localeSource(locale);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const match of source.matchAll(/^\s{2}"(sc\.[^"]+)":/gm)) {
      if (seen.has(match[1])) duplicates.push(match[1]);
      seen.add(match[1]);
    }
    expect(duplicates, `${locale} duplicates: ${duplicates.join(", ")}`).toEqual([]);
  });

  it("defines every key the Service Center code actually calls", () => {
    const referenced = referencedKeys();
    expect(referenced.size).toBeGreaterThan(0);
    const missing = [...referenced].filter((key) => !english.has(key));
    expect(missing, `used in code but undefined: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps all locales at the same total key count", () => {
    const counts = LOCALES.map((locale) => [locale, keysIn(locale).size] as const);
    const [, expected] = counts[0];
    for (const [locale, count] of counts) {
      expect(count, `${locale} has ${count}, expected ${expected}`).toBe(expected);
    }
  });
});
