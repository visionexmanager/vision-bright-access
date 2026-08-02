import type { ArcadeAge, ArcadeCategory, ArcadeDifficulty } from "../catalog";

export type ExpansionGroup = "Classic" | "Puzzle" | "Strategy" | "Educational" | "Kids" | "Reaction & Skill";
export type ReleaseGate = "planned" | "development" | "review" | "approved";

export interface PlannedArcadeGame {
  id: string;
  name: string;
  group: ExpansionGroup;
  categories: ArcadeCategory[];
  age: ArcadeAge;
  difficulty: ArcadeDifficulty;
  expectedMinutes: string;
  controls: string[];
  future: ("multiplayer" | "challenges" | "tournaments" | "ai-opponent" | "vr-3d")[];
  gates: { gameplay:ReleaseGate; graphics:ReleaseGate; audio:ReleaseGate; performance:ReleaseGate; accessibility:ReleaseGate };
}
