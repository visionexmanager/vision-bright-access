import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The place index keeps names written in the site's twenty languages. If a
// locale is added or retired and this list is not, a language silently loses
// (or gains) place names, so the list is compared to the locale files.

describe("the languages the place index loads", () => {
  const loader = readFileSync("scripts/datahub/load-geonames-alternates.mjs", "utf8");
  const listed = [...(loader.match(/new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "").matchAll(/"([a-z]{2})"/g)].map((m) => m[1]).sort();
  const locales = readdirSync("src/i18n")
    .filter((f) => /^[a-z]{2}\.ts$/.test(f))
    .map((f) => f.slice(0, 2))
    .sort();

  it("are exactly the locale files under src/i18n", () => {
    expect(locales.length).toBe(20);
    expect(listed).toEqual(locales);
  });

  it("only prints counts and uses the shared key function", () => {
    expect(loader).toContain('from "../../supabase/functions/_shared/placeKey.ts"');
    expect([...loader.matchAll(/console\.log\(([^;]*)\);/g)].every((m) => /considered|\.length|\.size/.test(m[1]))).toBe(true);
  });

  it("runs after the base load, streaming the big file rather than keeping it on disk", () => {
    const workflow = readFileSync(".github/workflows/geonames-load.yml", "utf8");
    const base = workflow.indexOf("load-geonames.mjs");
    const alt = workflow.indexOf("load-geonames-alternates.mjs");
    expect(base).toBeGreaterThan(-1);
    expect(alt).toBeGreaterThan(base);
    expect(workflow).toContain("unzip -p alternateNamesV2.zip alternateNamesV2.txt |");
  });
});
