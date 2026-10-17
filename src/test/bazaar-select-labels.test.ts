import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// axe-core (select-name, critical) flagged the unlabelled shop filters on
// production /bazaar. Every <select> in the page must carry an accessible name.
describe("VXBazaar selects", () => {
  const src = readFileSync("src/pages/VXBazaar.tsx", "utf8");

  it("gives every <select> an aria-label, aria-labelledby or id", () => {
    const opens = [...src.matchAll(/<select\b/g)].map((m) => src.slice(m.index, m.index + 400).split("</select>")[0]);
    expect(opens.length).toBeGreaterThan(5);
    const unnamed = opens.filter((s) => !/aria-label|aria-labelledby|\bid=/.test(s));
    expect(unnamed).toEqual([]);
  });
});
