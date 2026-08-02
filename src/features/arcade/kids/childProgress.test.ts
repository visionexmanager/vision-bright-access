import { beforeEach, describe, expect, it } from "vitest";
import { getChildProgressSnapshot } from "./childProgress";
import { playerGameData } from "../core/playerGameData";

describe("Visionex Kids child progress", () => {
  beforeEach(() => localStorage.clear());

  it("aggregates learning progress without personal child identifiers", () => {
    playerGameData.save({ ...playerGameData.get("memory"), playCount:2, completionCount:2, totalPlaySeconds:180, achievements:["first-play"] });
    const progress = getChildProgressSnapshot();
    expect(progress.totalSeconds).toBe(180);
    expect(progress.completedGames).toBe(1);
    expect(progress.stars).toBe(2);
    expect(progress.earnedSkills).toContain("Visual memory");
    expect(JSON.stringify(progress)).not.toMatch(/name|email|birth/i);
  });
});
