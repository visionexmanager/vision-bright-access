import {
  Languages, Calculator, FlaskConical, Atom, TestTube, Leaf, Globe2, Landmark,
  Code2, Bot, Sparkles, Palette, Music, Puzzle, Brain, Coins, ShieldCheck, GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export { isKidsColor } from "@/features/visionkids/data/storyCategoryIcons";

/** Maps kids_subjects.icon (a string) to its Lucide component. */
export const SUBJECT_ICONS: Record<string, LucideIcon> = {
  Languages, Calculator, FlaskConical, Atom, TestTube, Leaf, Globe2, Landmark,
  Code2, Bot, Sparkles, Palette, Music, PuzzleIcon: Puzzle, Brain, Coins, ShieldCheck,
};

export function getSubjectIcon(iconName: string | null | undefined): LucideIcon {
  return (iconName && SUBJECT_ICONS[iconName]) || GraduationCap;
}
