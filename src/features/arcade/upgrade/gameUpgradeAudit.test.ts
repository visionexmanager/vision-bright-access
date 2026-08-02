import { describe, expect, it } from "vitest";
import { ARCADE_GAMES } from "../catalog";
import { GAME_UPGRADE_AUDIT, MINIMUM_ARCADE_QUALITY_SCORE } from "./gameUpgradeAudit";

describe("existing games premium upgrade audit", () => {
  it("covers every registered game exactly once", () => {
    expect(GAME_UPGRADE_AUDIT).toHaveLength(ARCADE_GAMES.length);
    expect(new Set(GAME_UPGRADE_AUDIT.map((item) => item.id)).size).toBe(ARCADE_GAMES.length);
  });

  it("does not approve games below any production release gate", () => {
    for (const game of GAME_UPGRADE_AUDIT) {
      if (game.quality.total < MINIMUM_ARCADE_QUALITY_SCORE || game.quality.audio < 80 || game.quality.graphics < 80 || game.quality.accessibility < 75) expect(game.approved).toBe(false);
    }
  });

  it("assigns a source component and a valid priority to every game", () => {
    for (const game of GAME_UPGRADE_AUDIT) {
      expect(game.files[0]).toMatch(/\.tsx$/);
      expect([1,2,3]).toContain(game.priority);
    }
  });
});
