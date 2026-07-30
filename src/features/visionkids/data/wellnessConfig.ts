import type { KidsColor, Mood, RoutineSlot, WellnessRank } from "@/features/visionkids/types/wellness.types";

export const WELLNESS_COLOR_CLASSES: Record<KidsColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

/** Health Hub top-level entries — route + emoji + i18n label. Data-driven so
 *  the hub grid and section sub-nav stay in sync from one list. */
export interface WellnessNavEntry {
  id: string;
  to: string;
  emoji: string;
  labelKey: string;
}

export const WELLNESS_NAV: WellnessNavEntry[] = [
  { id: "routine", to: "/kids/health/routine", emoji: "🗓️", labelKey: "kids.wellness.nav.routine" },
  { id: "habits", to: "/kids/health/habits", emoji: "✅", labelKey: "kids.wellness.nav.habits" },
  { id: "nutrition", to: "/kids/health/nutrition", emoji: "🥗", labelKey: "kids.wellness.nav.nutrition" },
  { id: "exercise", to: "/kids/health/exercise", emoji: "🤸", labelKey: "kids.wellness.nav.exercise" },
  { id: "sleep", to: "/kids/health/sleep", emoji: "😴", labelKey: "kids.wellness.nav.sleep" },
  { id: "mood", to: "/kids/health/mood", emoji: "🙂", labelKey: "kids.wellness.nav.mood" },
  { id: "mindfulness", to: "/kids/health/mindfulness", emoji: "🧘", labelKey: "kids.wellness.nav.mindfulness" },
  { id: "safety", to: "/kids/health/safety", emoji: "🛡️", labelKey: "kids.wellness.nav.safety" },
  { id: "first-aid", to: "/kids/health/first-aid", emoji: "🩹", labelKey: "kids.wellness.nav.firstAid" },
  { id: "companion", to: "/kids/health/companion", emoji: "🤖", labelKey: "kids.wellness.nav.companion" },
  { id: "emergency", to: "/kids/health/emergency", emoji: "🆘", labelKey: "kids.wellness.nav.emergency" },
  { id: "challenges", to: "/kids/health/challenges", emoji: "🏅", labelKey: "kids.wellness.nav.challenges" },
  { id: "rewards", to: "/kids/health/rewards", emoji: "🏆", labelKey: "kids.wellness.nav.rewards" },
  { id: "accessibility", to: "/kids/health/accessibility", emoji: "♿", labelKey: "kids.wellness.nav.accessibility" },
];

/** Mood palette — emoji + a color token per feeling. Labels come from i18n
 *  (kids.wellness.mood.<slug>). */
export const MOOD_OPTIONS: { slug: Mood; emoji: string; color: KidsColor }[] = [
  { slug: "great", emoji: "😄", color: "green" },
  { slug: "good", emoji: "🙂", color: "primary" },
  { slug: "okay", emoji: "😐", color: "accent" },
  { slug: "tired", emoji: "😴", color: "purple" },
  { slug: "sad", emoji: "😢", color: "secondary" },
  { slug: "worried", emoji: "😟", color: "pink" },
  { slug: "angry", emoji: "😠", color: "pink" },
];

export const ROUTINE_SLOTS: { slug: Exclude<RoutineSlot, "anytime">; emoji: string }[] = [
  { slug: "morning", emoji: "🌅" },
  { slug: "school", emoji: "🏫" },
  { slug: "evening", emoji: "🌆" },
  { slug: "weekend", emoji: "🎉" },
];

export const WELLNESS_RANKS: { slug: WellnessRank; emoji: string }[] = [
  { slug: "sprout", emoji: "🌱" },
  { slug: "budding", emoji: "🌿" },
  { slug: "growing", emoji: "🌻" },
  { slug: "strong", emoji: "🌳" },
  { slug: "champion", emoji: "🏆" },
];

export const WELLNESS_RANK_EMOJI: Record<string, string> = Object.fromEntries(
  WELLNESS_RANKS.map((r) => [r.slug, r.emoji]),
);
