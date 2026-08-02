import { describe, expect, it } from "vitest";
import { ARCADE_GAMES } from "../catalog";
import { auditGameVisuals } from "./visualQuality";
import { visualsForGame } from "./visualRegistry";

describe("Arcade premium visual registry", () => {
  it("registers cover, thumbnail, and background for every game", () => {
    for (const game of ARCADE_GAMES) expect(visualsForGame(game).map((asset) => asset.kind)).toEqual(["cover", "thumbnail", "background"]);
  });

  it("approves every licensed Full-HD raster or scalable vector pack", () => {
    const reports = ARCADE_GAMES.map(auditGameVisuals);
    expect(reports.filter((report) => report.status === "approved").length).toBe(ARCADE_GAMES.length);
    expect(reports.flatMap((report) => report.issues)).toEqual([]);
  });
});
