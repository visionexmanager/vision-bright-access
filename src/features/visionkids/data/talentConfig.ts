import type { KidsColor, TalentRank, InnovationRank } from "@/features/visionkids/types/talent.types";

/** Same border/bg/text token set every VisionKids phase uses (see
 *  WORLD_COLOR_CLASSES in explorerWorlds.ts). Kept local to the Talent
 *  feature so the phases stay decoupled. */
export const TALENT_COLOR_CLASSES: Record<KidsColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

/** Rank ladders — order + emoji. Labels come from i18n
 *  (kids.talent.rank.<slug> / kids.talent.innovationRank.<slug>). Kept in
 *  sync with the CASE ladders in get_kids_talent_stats() (20260815020000). */
export const TALENT_RANKS: { slug: TalentRank; emoji: string }[] = [
  { slug: "novice", emoji: "🌱" },
  { slug: "rising_star", emoji: "⭐" },
  { slug: "talented", emoji: "🌟" },
  { slug: "expert", emoji: "🏅" },
  { slug: "prodigy", emoji: "👑" },
];

export const INNOVATION_RANKS: { slug: InnovationRank; emoji: string }[] = [
  { slug: "curious", emoji: "🔍" },
  { slug: "maker", emoji: "🔨" },
  { slug: "builder", emoji: "🏗️" },
  { slug: "innovator", emoji: "💡" },
  { slug: "visionary", emoji: "🚀" },
];

export const TALENT_RANK_EMOJI: Record<string, string> = Object.fromEntries(
  [...TALENT_RANKS, ...INNOVATION_RANKS].map((r) => [r.slug, r.emoji]),
);

/** The Talent Hub's top-level navigation entries (used by the hub home and
 *  the section sub-nav). Route + icon-emoji + i18n label key, data-driven so
 *  adding an entry is a one-line change. */
export interface TalentNavEntry {
  id: string;
  to: string;
  emoji: string;
  labelKey: string;
}

export const TALENT_NAV: TalentNavEntry[] = [
  { id: "assessment", to: "/kids/talent/assessment", emoji: "🧭", labelKey: "kids.talent.nav.assessment" },
  { id: "my-talents", to: "/kids/talent/my-talents", emoji: "🌟", labelKey: "kids.talent.nav.myTalents" },
  { id: "skill-tree", to: "/kids/talent/skill-tree", emoji: "🌳", labelKey: "kids.talent.nav.skillTree" },
  { id: "future-skills", to: "/kids/talent/future-skills", emoji: "🚀", labelKey: "kids.talent.nav.futureSkills" },
  { id: "portfolio", to: "/kids/talent/portfolio", emoji: "📁", labelKey: "kids.talent.nav.portfolio" },
  { id: "achievements", to: "/kids/talent/achievements", emoji: "🏆", labelKey: "kids.talent.nav.achievements" },
  { id: "careers", to: "/kids/talent/careers", emoji: "🧑‍🚀", labelKey: "kids.talent.nav.careers" },
  { id: "mentors", to: "/kids/talent/mentors", emoji: "🧑‍🏫", labelKey: "kids.talent.nav.mentors" },
];
