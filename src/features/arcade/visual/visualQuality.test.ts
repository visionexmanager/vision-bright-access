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

  it("ships dedicated Full-HD raster covers for production board pack 1", () => {
    for (const slug of ["chess", "backgammon", "ludo"]) {
      const game = ARCADE_GAMES.find((item) => item.slug === slug);
      expect(game?.image).toMatch(new RegExp(`game-${slug}-premium-v2\\.webp$`));
      const cover = visualsForGame(game!)[0];
      expect(cover.sources[0]).toMatchObject({ width:1920, height:1080, mimeType:"image/webp" });
    }
  });

  it("ships a dedicated Full-HD raster cover for Skybound Quest", () => {
    const game = ARCADE_GAMES.find((item) => item.slug === "skybound-quest")!;
    expect(game.image).toMatch(/game-skybound-quest-premium-v2\.webp$/);
    expect(visualsForGame(game)[0].sources[0]).toMatchObject({ width:1920, height:1080, mimeType:"image/webp" });
  });

  it("ships dedicated Full-HD raster covers for production sports pack 3", () => {
    for (const slug of ["penalty-shootout", "basketball-challenge", "air-hockey"]) {
      const game = ARCADE_GAMES.find((item) => item.slug === slug)!;
      expect(game.image).toMatch(new RegExp(`game-${slug}-premium-v2\\.webp$`));
      expect(visualsForGame(game)[0].sources[0]).toMatchObject({ width:1920, height:1080, mimeType:"image/webp" });
    }
  });
});
