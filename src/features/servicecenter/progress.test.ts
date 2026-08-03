import { describe, expect, it } from "vitest";
import {
  buildServiceProfile,
  levelTitle,
  pointsForCompletion,
  type CompletionRecord,
} from "./progress";

const done = (slug: string, score = 80, day = 1): CompletionRecord => ({
  slug,
  score,
  completedAt: `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`,
});

describe("pointsForCompletion", () => {
  it("weights harder experiences higher", () => {
    // egg-incubator is starter, network-noc is expert.
    expect(pointsForCompletion("network-noc", 100)).toBeGreaterThan(
      pointsForCompletion("egg-incubator", 100)
    );
  });

  it("scales by score", () => {
    expect(pointsForCompletion("egg-incubator", 50)).toBe(
      pointsForCompletion("egg-incubator", 100) / 2
    );
  });

  it("clamps out-of-range scores", () => {
    expect(pointsForCompletion("egg-incubator", 150)).toBe(
      pointsForCompletion("egg-incubator", 100)
    );
    expect(pointsForCompletion("egg-incubator", -20)).toBe(0);
  });

  it("ignores unknown slugs", () => {
    expect(pointsForCompletion("not-a-service", 100)).toBe(0);
  });
});

describe("buildServiceProfile", () => {
  it("returns an empty but valid profile with no history", () => {
    const profile = buildServiceProfile([]);
    expect(profile.level).toBe(1);
    expect(profile.totalPoints).toBe(0);
    expect(profile.completedCount).toBe(0);
    expect(profile.skills).toEqual([]);
    expect(profile.hubs.length).toBeGreaterThan(0);
    expect(profile.achievements.every((a) => !a.earned)).toBe(true);
  });

  it("counts only the best attempt per experience so replays cannot farm points", () => {
    const profile = buildServiceProfile([
      done("egg-incubator", 40),
      done("egg-incubator", 90),
      done("egg-incubator", 60),
    ]);
    expect(profile.completedCount).toBe(1);
    expect(profile.totalPoints).toBe(pointsForCompletion("egg-incubator", 90));
  });

  it("ignores records for experiences that no longer exist", () => {
    const profile = buildServiceProfile([done("removed-experience", 100), done("egg-incubator", 80)]);
    expect(profile.completedCount).toBe(1);
  });

  it("does not certify a skill practised only once", () => {
    const profile = buildServiceProfile([done("egg-incubator", 100)]);
    const skill = profile.skills.find((s) => s.name === "Process control");
    expect(skill?.practiceCount).toBe(1);
    expect(skill?.certified).toBe(false);
    expect(profile.certifiedSkills).toEqual([]);
  });

  it("certifies a skill after two clears with a strong best score", () => {
    // Both perfume-lab and detergent-lab teach "Formulation".
    const profile = buildServiceProfile([done("perfume-lab", 80), done("detergent-lab", 90)]);
    const skill = profile.skills.find((s) => s.name === "Formulation");
    expect(skill?.practiceCount).toBe(2);
    expect(skill?.bestScore).toBe(90);
    expect(skill?.certified).toBe(true);
  });

  it("withholds certification when the best score is too low", () => {
    const profile = buildServiceProfile([done("perfume-lab", 50), done("detergent-lab", 60)]);
    expect(profile.skills.find((s) => s.name === "Formulation")?.certified).toBe(false);
  });

  it("tracks the hardest difficulty reached for a skill", () => {
    // laptop-repair is intermediate, board-surgeon is expert; both teach a
    // diagnosis-family skill, so check the shared one explicitly.
    const profile = buildServiceProfile([done("mobile-repair", 90), done("board-surgeon", 90)]);
    const skill = profile.skills.find((s) => s.name === "Fault diagnosis");
    expect(skill?.peakDifficulty).toBe("intermediate");
  });

  it("raises the level as points accumulate", () => {
    const many = [
      done("network-noc", 100),
      done("marine-vessel", 100),
      done("board-surgeon", 100),
    ];
    const profile = buildServiceProfile(many);
    expect(profile.totalPoints).toBe(1_500);
    expect(profile.level).toBe(2);
    expect(profile.levelPoints).toBe(500);
  });

  it("reports per-hub completion", () => {
    const profile = buildServiceProfile([done("network-noc", 90)]);
    const techHub = profile.hubs.find((h) => h.hub === "tech-repair")!;
    expect(techHub.completed).toBe(1);
    expect(techHub.total).toBeGreaterThan(1);
    expect(techHub.percent).toBeGreaterThan(0);
    expect(techHub.percent).toBeLessThan(100);

    const untouched = profile.hubs.find((h) => h.hub === "creative-studio")!;
    expect(untouched.completed).toBe(0);
    expect(untouched.percent).toBe(0);
  });

  it("earns the first-steps achievement on a single completion", () => {
    const profile = buildServiceProfile([done("egg-incubator", 70)]);
    const first = profile.achievements.find((a) => a.id === "first-steps")!;
    expect(first.earned).toBe(true);
    expect(first.progress).toBe(1);
  });

  it("earns the broad-explorer achievement across four hubs", () => {
    const profile = buildServiceProfile([
      done("egg-incubator", 80),
      done("network-noc", 80),
      done("solar-energy", 80),
      done("english-journey", 80),
    ]);
    expect(profile.achievements.find((a) => a.id === "broad-explorer")?.earned).toBe(true);
  });

  it("keeps achievement progress inside 0–1", () => {
    const profile = buildServiceProfile([
      done("network-noc", 100),
      done("board-surgeon", 100),
      done("marine-vessel", 100),
      done("egg-incubator", 100),
      done("solar-energy", 100),
      done("english-journey", 100),
    ]);
    for (const a of profile.achievements) {
      expect(a.progress, a.id).toBeGreaterThanOrEqual(0);
      expect(a.progress, a.id).toBeLessThanOrEqual(1);
    }
  });
});

describe("levelTitle", () => {
  it("returns the highest tier reached", () => {
    expect(levelTitle(1).en).toBe("Visitor");
    expect(levelTitle(3).en).toBe("Apprentice");
    expect(levelTitle(9).en).toBe("Specialist");
    expect(levelTitle(99).en).toBe("Master");
  });

  it("is bilingual", () => {
    expect(levelTitle(5).ar).not.toBe("");
  });
});
