/**
 * Academy — Numbered Level / Title / Rank System (Phase 7 Gamification)
 *
 * Extends (does not replace) lib/academy/xp.ts — that file's 5-tier
 * XP_LEVELS/getXPLevel() still powers the existing Phase 2 UI
 * (AchievementsSection's badge track) and stays untouched. This module reads
 * the SAME `academy_profiles.xp_total` number and derives a finer-grained,
 * unlimited-expansion numbered level (1, 2, 3, ... 100, ...) with a title,
 * rank tier, and per-level unlocks — purely a richer *display* over the
 * existing XP number. No new XP counter, no new VX wallet.
 */

export interface AcademyRankTier {
  rank: string;
  minLevel: number;
  maxLevel: number | null; // null = open-ended (e.g. 100+)
  colorClass: string;
}

export const ACADEMY_RANK_TIERS: AcademyRankTier[] = [
  { rank: "متعلّم مبتدئ", minLevel: 1, maxLevel: 4, colorClass: "text-muted-foreground" },
  { rank: "متعلّم صاعد", minLevel: 5, maxLevel: 9, colorClass: "text-blue-500" },
  { rank: "متعلّم متمكّن", minLevel: 10, maxLevel: 24, colorClass: "text-emerald-500" },
  { rank: "خبير متعلّم", minLevel: 25, maxLevel: 49, colorClass: "text-purple-500" },
  { rank: "أستاذ التعلّم الذاتي", minLevel: 50, maxLevel: 99, colorClass: "text-orange-500" },
  { rank: "أسطورة الأكاديمية", minLevel: 100, maxLevel: null, colorClass: "text-yellow-500" },
];

/** Milestone levels that unlock something extra, per the Phase 7 brief's examples. */
const LEVEL_UNLOCKS: Record<number, string[]> = {
  1: ["شارة البداية"],
  5: ["لقب \"متعلّم صاعد\"", "إطار ملف تعريف برونزي (تحضير)"],
  10: ["لقب \"متعلّم متمكّن\"", "إطار ملف تعريف فضي (تحضير)"],
  25: ["لقب \"خبير متعلّم\"", "إطار ملف تعريف ذهبي (تحضير)"],
  50: ["لقب \"أستاذ التعلّم الذاتي\"", "إطار ملف تعريف بلاتيني (تحضير)"],
  100: ["لقب \"أسطورة الأكاديمية\"", "إطار ملف تعريف أسطوري (تحضير)"],
};

/** Cumulative XP required to REACH a given level (triangular growth curve — unlimited expansion). */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 25 * n * (n + 1);
}

export function getRankForLevel(level: number): AcademyRankTier {
  return ACADEMY_RANK_TIERS.find((t) => level >= t.minLevel && (t.maxLevel === null || level <= t.maxLevel)) ?? ACADEMY_RANK_TIERS[0];
}

export interface AcademyLevelInfo {
  level: number;
  rank: AcademyRankTier;
  xpIntoLevel: number;
  xpForNextLevel: number;
  percentToNextLevel: number;
  unlocksAtThisLevel: string[];
  nextMilestoneLevel: number | null;
}

export function getAcademyLevelInfo(xpTotal: number): AcademyLevelInfo {
  let level = 1;
  while (xpRequiredForLevel(level + 1) <= xpTotal) level++;

  const currentThreshold = xpRequiredForLevel(level);
  const nextThreshold = xpRequiredForLevel(level + 1);
  const xpIntoLevel = xpTotal - currentThreshold;
  const xpForNextLevel = nextThreshold - currentThreshold;
  const percent = xpForNextLevel > 0 ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;

  const milestones = Object.keys(LEVEL_UNLOCKS).map(Number).sort((a, b) => a - b);
  const nextMilestone = milestones.find((m) => m > level) ?? null;

  return {
    level,
    rank: getRankForLevel(level),
    xpIntoLevel,
    xpForNextLevel,
    percentToNextLevel: percent,
    unlocksAtThisLevel: LEVEL_UNLOCKS[level] ?? [],
    nextMilestoneLevel: nextMilestone,
  };
}
