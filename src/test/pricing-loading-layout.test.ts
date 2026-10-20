import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// /pricing showed one line of text while the plans loaded, so the footer sat inside
// the first screen and jumped down when the cards arrived: layout shift 0.24 on
// production (mobile Lighthouse, 2026-10-19), 0.27 / 0.11 (mobile / desktop) in a
// local run with a delayed synthetic plan list. Reserving most of a screen for the
// loading state took those to 0 / 0.02. The measurement needs a browser; this keeps
// the reservation from being removed unnoticed.
const source = readFileSync("src/pages/Pricing.tsx", "utf8");

describe("Pricing loading state", () => {
  it("reserves space while the plans load, and keeps the status message inside it", () => {
    const loading = source.slice(source.indexOf("isLoading ? ("), source.indexOf(") : ("));
    expect(loading).toMatch(/min-h-\[\d+vh\]/);
    expect(loading).toContain('role="status"');
  });
});
