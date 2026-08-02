import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCADE_GAMES } from "../catalog";
import { GAME_UPGRADE_AUDIT } from "../upgrade/gameUpgradeAudit";
import { gameReleaseInfo } from "../gameReleaseNotes";

describe("Arcade ultimate polish gate",()=>{
  it("gives every game instructions, version and change log",()=>{
    for(const game of ARCADE_GAMES){const info=gameReleaseInfo(game.slug);expect(info.howToPlay.length,game.slug).toBeGreaterThanOrEqual(3);expect(info.changes.length,game.slug).toBeGreaterThanOrEqual(3);expect(info.version).toMatch(/^\d+\.\d+\.\d+/);}
  });
  it("ships no remote preview audio in the audited Arcade game surface",()=>{
    const files=["src/pages/QuizChallenge.tsx","src/features/arcade/audio/audioLibrary.ts"];
    for(const file of files){const source=readFileSync(file,"utf8");expect(source).not.toContain("-preview.mp3");expect(source).not.toContain("assets.mixkit.co");}
  });
  it("keeps nonconforming games blocked rather than claiming completion",()=>{
    expect(GAME_UPGRADE_AUDIT).toHaveLength(ARCADE_GAMES.length);
    expect(GAME_UPGRADE_AUDIT.filter(game=>game.approved)).toHaveLength(0);
  });
});
