import { describe, expect, it } from "vitest";
import { calculateLocalXp, levelFromXp, XP_RULES } from "./xpSystem";

describe("Arcade XP system", () => {
  it("calculates deterministic XP from verified activity categories", () => {
    expect(calculateLocalXp({ plays:3, completions:2, wins:1, achievements:1 })).toBe(3*XP_RULES.play + 2*XP_RULES.completion + XP_RULES.win + XP_RULES.achievement);
  });
  it("uses increasing level thresholds", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(400).level).toBe(3);
    expect(levelFromXp(399).progress).toBeGreaterThanOrEqual(0);
  });
});
