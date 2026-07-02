import {
  Footprints, BookOpenCheck, Flame, GraduationCap, Layers, Crown, Rocket, Hammer,
  Award, Trophy, HeartHandshake, Sparkles, BookOpen, Library, CalendarCheck,
  CalendarClock, Gem, Star, Stars, Medal, Send, PartyPopper, Sparkle,
  Code, Smartphone, BarChart3, ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/** Explicit map (not `import * as Icons`) so unused lucide icons stay tree-shaken —
 * every entry here matches an `icon:` string in ACHIEVEMENT_CATALOG / LEARNING_CARD_CATALOG. */
export const ACHIEVEMENT_ICON_MAP: Record<string, LucideIcon> = {
  Footprints, BookOpenCheck, Flame, GraduationCap, Layers, Crown, Rocket, Hammer,
  Award, Trophy, HeartHandshake, Sparkles, BookOpen, Library, CalendarCheck,
  CalendarClock, Gem, Star, Stars, Medal, Send, PartyPopper, Sparkle,
  Code, Smartphone, BarChart3, ShieldCheck,
};

export function resolveAchievementIcon(name: string): LucideIcon {
  return ACHIEVEMENT_ICON_MAP[name] ?? Award;
}
