import { describe, expect, it } from "vitest";
import { PREMIUM_EXPANSION_PLAN } from "./expansionPlan";
import { evaluateNewGameRelease } from "./releaseGate";

describe("premium games expansion release plan", () => {
  it("contains all 34 requested games with unique ids", () => {
    expect(PREMIUM_EXPANSION_PLAN).toHaveLength(34);
    expect(new Set(PREMIUM_EXPANSION_PLAN.map((game) => game.id)).size).toBe(34);
  });

  it("classifies every game and documents duration and controls", () => {
    for (const game of PREMIUM_EXPANSION_PLAN) {
      expect(game.categories.length).toBeGreaterThan(0);
      expect(game.expectedMinutes).toMatch(/\d/);
      expect(game.controls).toContain("Keyboard");
      expect(game.controls).toContain("Touch");
    }
  });

  it("blocks every game until all production gates pass", () => {
    expect(PREMIUM_EXPANSION_PLAN.every((game) => !evaluateNewGameRelease(game).approved)).toBe(true);
  });
});
