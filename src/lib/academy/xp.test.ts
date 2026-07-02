import { describe, it, expect } from "vitest";
import { getXPLevel, XP_LEVELS } from "./xp";

describe("getXPLevel", () => {
  it("returns the first tier for 0 XP", () => {
    expect(getXPLevel(0).label).toBe(XP_LEVELS[0].label);
  });

  it("returns the top tier once XP exceeds its minimum", () => {
    const topTier = XP_LEVELS[XP_LEVELS.length - 1];
    expect(getXPLevel(topTier.min).label).toBe(topTier.label);
    expect(getXPLevel(topTier.min + 10_000).label).toBe(topTier.label);
  });

  it("never returns a negative percent or one over 100", () => {
    for (const xp of [0, 50, 100, 499, 500, 2499, 2500, 999_999]) {
      const { percent } = getXPLevel(xp);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
    }
  });

  it("resolves to exactly the intended tier at each documented boundary", () => {
    for (const tier of XP_LEVELS) {
      expect(getXPLevel(tier.min).label).toBe(tier.label);
    }
  });
});
