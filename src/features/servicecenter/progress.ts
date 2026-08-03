import { SERVICE_CATALOG, DIFFICULTY_ORDER, getServiceEntry } from "./catalog";
import { HUBS } from "./hubs";
import type { Difficulty, HubId, LocalizedText } from "./types";

/**
 * Professional progress for the Service Center.
 *
 * Deliberately separate from the arcade's XP: a service record is about skills
 * a person can claim, not points they can farm. Completing a starter salon
 * experience does not make someone an engineer, so the model weights by
 * difficulty and only certifies a skill once it has been practised more than
 * once.
 */

export interface CompletionRecord {
  slug: string;
  /** 0–100 result reported by the experience. */
  score: number;
  /** ISO timestamp. */
  completedAt: string;
}

export interface SkillRecord {
  /** Canonical English skill name; also the map key. */
  name: string;
  /** Times the visitor has completed an experience teaching this skill. */
  practiceCount: number;
  /** Best score achieved on any experience teaching it. */
  bestScore: number;
  /** Hardest difficulty they have cleared while practising it. */
  peakDifficulty: Difficulty;
  /** True once the skill meets the certification bar. */
  certified: boolean;
}

export interface HubProgress {
  hub: HubId;
  completed: number;
  total: number;
  percent: number;
}

export interface ServiceProfile {
  level: number;
  /** Points into the current level, and what the next level costs. */
  levelPoints: number;
  nextLevelAt: number;
  totalPoints: number;
  completedCount: number;
  skills: SkillRecord[];
  certifiedSkills: SkillRecord[];
  hubs: HubProgress[];
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  icon: string;
  earned: boolean;
  /** 0–1 progress toward earning it. */
  progress: number;
}

/**
 * Points per completion, weighted by difficulty then scaled by score. An
 * expert experience passed at 60% is worth less than a starter passed at 100%,
 * which is the honest ordering.
 */
const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  starter: 100,
  intermediate: 200,
  advanced: 350,
  expert: 500,
};

const POINTS_PER_LEVEL = 1_000;

/** A skill is certified after two clears with a solid best score. */
export const CERTIFICATION_RULE = { minPractice: 2, minBestScore: 75 } as const;

export function pointsForCompletion(slug: string, score: number): number {
  const entry = getServiceEntry(slug);
  if (!entry) return 0;
  const clamped = Math.max(0, Math.min(100, score));
  return Math.round(DIFFICULTY_POINTS[entry.difficulty] * (clamped / 100));
}

function buildSkills(records: CompletionRecord[]): SkillRecord[] {
  const skills = new Map<string, SkillRecord>();

  for (const record of records) {
    const entry = getServiceEntry(record.slug);
    if (!entry) continue;

    for (const name of entry.skills.en) {
      const existing = skills.get(name);
      if (!existing) {
        skills.set(name, {
          name,
          practiceCount: 1,
          bestScore: record.score,
          peakDifficulty: entry.difficulty,
          certified: false,
        });
        continue;
      }
      existing.practiceCount += 1;
      existing.bestScore = Math.max(existing.bestScore, record.score);
      if (DIFFICULTY_ORDER[entry.difficulty] > DIFFICULTY_ORDER[existing.peakDifficulty]) {
        existing.peakDifficulty = entry.difficulty;
      }
    }
  }

  for (const skill of skills.values()) {
    skill.certified =
      skill.practiceCount >= CERTIFICATION_RULE.minPractice &&
      skill.bestScore >= CERTIFICATION_RULE.minBestScore;
  }

  return [...skills.values()].sort(
    (a, b) =>
      Number(b.certified) - Number(a.certified) ||
      b.practiceCount - a.practiceCount ||
      a.name.localeCompare(b.name)
  );
}

function buildHubProgress(completedSlugs: Set<string>): HubProgress[] {
  return HUBS.map((hub) => {
    const entries = SERVICE_CATALOG.filter((e) => e.hub === hub.id);
    const completed = entries.filter((e) => completedSlugs.has(e.slug)).length;
    return {
      hub: hub.id,
      completed,
      total: entries.length,
      percent: entries.length === 0 ? 0 : Math.round((completed / entries.length) * 100),
    };
  });
}

function buildAchievements(
  records: CompletionRecord[],
  skills: SkillRecord[],
  hubs: HubProgress[]
): Achievement[] {
  const completedSlugs = new Set(records.map((r) => r.slug));
  const certified = skills.filter((s) => s.certified).length;
  const expertClears = records.filter(
    (r) => getServiceEntry(r.slug)?.difficulty === "expert"
  ).length;
  const hubsTouched = hubs.filter((h) => h.completed > 0).length;
  const perfectRuns = records.filter((r) => r.score >= 95).length;

  const ratio = (value: number, target: number) => Math.min(1, value / target);

  return [
    {
      id: "first-steps",
      icon: "Footprints",
      title: { en: "First Steps", ar: "الخطوات الأولى" },
      description: {
        en: "Complete your first professional experience.",
        ar: "أكمل أول تجربة احترافية لك.",
      },
      earned: completedSlugs.size >= 1,
      progress: ratio(completedSlugs.size, 1),
    },
    {
      id: "broad-explorer",
      icon: "Compass",
      title: { en: "Broad Explorer", ar: "مستكشف واسع" },
      description: {
        en: "Complete something in four different hubs.",
        ar: "أكمل تجربة في أربعة أقسام مختلفة.",
      },
      earned: hubsTouched >= 4,
      progress: ratio(hubsTouched, 4),
    },
    {
      id: "certified-three",
      icon: "BadgeCheck",
      title: { en: "Certified Practitioner", ar: "ممارس معتمد" },
      description: {
        en: "Certify three professional skills.",
        ar: "احصل على اعتماد ثلاث مهارات احترافية.",
      },
      earned: certified >= 3,
      progress: ratio(certified, 3),
    },
    {
      id: "expert-clear",
      icon: "Mountain",
      title: { en: "Deep End", ar: "المياه العميقة" },
      description: {
        en: "Complete an expert-level experience.",
        ar: "أكمل تجربة بمستوى خبير.",
      },
      earned: expertClears >= 1,
      progress: ratio(expertClears, 1),
    },
    {
      id: "precision",
      icon: "Target",
      title: { en: "Precision", ar: "الدقة" },
      description: {
        en: "Score 95 or above on five experiences.",
        ar: "احصل على 95 أو أكثر في خمس تجارب.",
      },
      earned: perfectRuns >= 5,
      progress: ratio(perfectRuns, 5),
    },
    {
      id: "business-lab-complete",
      icon: "Rocket",
      title: { en: "Lab Graduate", ar: "خريج المختبر" },
      description: {
        en: "Complete every experience in the Business Lab.",
        ar: "أكمل كل تجربة في مختبر الأعمال.",
      },
      earned: hubs.find((h) => h.hub === "business-lab")?.percent === 100,
      progress: (hubs.find((h) => h.hub === "business-lab")?.percent ?? 0) / 100,
    },
  ];
}

/** Builds the whole professional profile from a completion history. */
export function buildServiceProfile(records: CompletionRecord[]): ServiceProfile {
  // De-duplicate to the best attempt per experience so replays cannot farm points.
  const best = new Map<string, CompletionRecord>();
  for (const record of records) {
    if (!getServiceEntry(record.slug)) continue;
    const existing = best.get(record.slug);
    if (!existing || record.score > existing.score) best.set(record.slug, record);
  }
  const unique = [...best.values()];

  const totalPoints = unique.reduce((sum, r) => sum + pointsForCompletion(r.slug, r.score), 0);
  const level = Math.floor(totalPoints / POINTS_PER_LEVEL) + 1;
  const levelPoints = totalPoints % POINTS_PER_LEVEL;

  // Skills use the full history: practising twice is what certifies a skill.
  const skills = buildSkills(records.filter((r) => getServiceEntry(r.slug)));
  const hubs = buildHubProgress(new Set(unique.map((r) => r.slug)));

  return {
    level,
    levelPoints,
    nextLevelAt: POINTS_PER_LEVEL,
    totalPoints,
    completedCount: unique.length,
    skills,
    certifiedSkills: skills.filter((s) => s.certified),
    hubs,
    achievements: buildAchievements(unique, skills, hubs),
  };
}

export const LEVEL_TITLES: { minLevel: number; title: LocalizedText }[] = [
  { minLevel: 1, title: { en: "Visitor", ar: "زائر" } },
  { minLevel: 2, title: { en: "Apprentice", ar: "متدرب" } },
  { minLevel: 4, title: { en: "Practitioner", ar: "ممارس" } },
  { minLevel: 7, title: { en: "Specialist", ar: "أخصائي" } },
  { minLevel: 11, title: { en: "Senior Specialist", ar: "أخصائي أول" } },
  { minLevel: 16, title: { en: "Master", ar: "خبير" } },
];

export function levelTitle(level: number): LocalizedText {
  let title = LEVEL_TITLES[0].title;
  for (const tier of LEVEL_TITLES) {
    if (level >= tier.minLevel) title = tier.title;
  }
  return title;
}
