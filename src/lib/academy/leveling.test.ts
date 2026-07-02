import { describe, it, expect } from "vitest";
import { xpRequiredForLevel, getRankForLevel, getAcademyLevelInfo, ACADEMY_RANK_TIERS } from "./leveling";

describe("xpRequiredForLevel", () => {
  it("requires 0 XP for level 1", () => {
    expect(xpRequiredForLevel(1)).toBe(0);
  });

  it("is monotonically increasing", () => {
    for (let level = 1; level < 50; level++) {
      expect(xpRequiredForLevel(level + 1)).toBeGreaterThan(xpRequiredForLevel(level));
    }
  });

  it("treats levels below 1 the same as level 1", () => {
    expect(xpRequiredForLevel(0)).toBe(0);
    expect(xpRequiredForLevel(-5)).toBe(0);
  });
});

describe("getRankForLevel", () => {
  it("returns the lowest rank for level 1", () => {
    expect(getRankForLevel(1).rank).toBe(ACADEMY_RANK_TIERS[0].rank);
  });

  it("returns the highest (open-ended) rank for very high levels", () => {
    const topTier = ACADEMY_RANK_TIERS[ACADEMY_RANK_TIERS.length - 1];
    expect(topTier.maxLevel).toBeNull();
    expect(getRankForLevel(500).rank).toBe(topTier.rank);
  });

  it("never skips a level — every tier boundary resolves to exactly one rank", () => {
    for (const tier of ACADEMY_RANK_TIERS) {
      expect(getRankForLevel(tier.minLevel).rank).toBe(tier.rank);
    }
  });
});

describe("getAcademyLevelInfo", () => {
  it("starts at level 1 with 0 XP", () => {
    const info = getAcademyLevelInfo(0);
    expect(info.level).toBe(1);
    expect(info.xpIntoLevel).toBe(0);
    expect(info.percentToNextLevel).toBeGreaterThanOrEqual(0);
  });

  it("never reports a level whose threshold exceeds the given XP", () => {
    for (const xp of [0, 25, 100, 1000, 5000, 50000]) {
      const info = getAcademyLevelInfo(xp);
      expect(xpRequiredForLevel(info.level)).toBeLessThanOrEqual(xp);
      expect(xpRequiredForLevel(info.level + 1)).toBeGreaterThan(xp);
    }
  });

  it("caps percentToNextLevel at 100", () => {
    const info = getAcademyLevelInfo(1_000_000);
    expect(info.percentToNextLevel).toBeLessThanOrEqual(100);
  });

  it("is monotonic — more XP never produces a lower level", () => {
    let previousLevel = 1;
    for (let xp = 0; xp <= 20000; xp += 500) {
      const level = getAcademyLevelInfo(xp).level;
      expect(level).toBeGreaterThanOrEqual(previousLevel);
      previousLevel = level;
    }
  });
});
