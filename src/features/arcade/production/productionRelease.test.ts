import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCADE_GAMES } from "../catalog";
import { AUDIO_LIBRARY } from "../audio/audioLibrary";
import { recommendGames } from "../ai/ArcadeAI";

describe("Arcade enterprise release contracts",()=>{
  it("publishes Arcade PWA metadata and SEO discovery",()=>{
    const manifest=JSON.parse(readFileSync("public/manifest.webmanifest","utf8"));
    const sitemap=readFileSync("public/sitemap.xml","utf8");
    expect(manifest.name).toBe("Visionex Arcade");
    expect(manifest.start_url).toContain("/games");
    expect(sitemap).toContain("/games/accessible");
    expect(sitemap).toContain("/games/tournaments");
  });
  it("keeps recommendations bounded and explainable",()=>{
    const recommendations=recommendGames(ARCADE_GAMES,new Map(),3);
    expect(recommendations).toHaveLength(3);
    recommendations.forEach(item=>{expect(item.reason.length).toBeGreaterThan(5);expect(item.confidence).toBeGreaterThanOrEqual(40);expect(item.confidence).toBeLessThanOrEqual(95);});
  });
  it("does not misrepresent pending audio as production-ready",()=>{
    expect(AUDIO_LIBRARY.length).toBeGreaterThan(0);
    expect(AUDIO_LIBRARY.filter(item=>item.quality==="production" && item.licenseStatus==="approved")).toHaveLength(13);
    expect(AUDIO_LIBRARY.filter(item=>item.quality==="replacement-required" && item.licenseStatus==="pending")).toHaveLength(11);
    expect(readFileSync("docs/ARCADE_RELEASE_AUDIT.md","utf8")).toContain("BLOCKED");
  });
});
