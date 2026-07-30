import {
  Brain, Calculator, Type, BookOpen, Globe2, FlaskConical, Rocket, Dog, Music,
  Palette, Puzzle, Zap, Code2, Bot, Ear, Gamepad2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export { isKidsColor } from "@/features/visionkids/data/storyCategoryIcons";

/** Maps kids_game_categories.icon (a string) to its Lucide component — same
 *  pattern as storyCategoryIcons.ts, kept as a separate map since game and
 *  story categories are different sets of icons. */
export const GAME_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Brain, Calculator, Type, BookOpen, Globe2, FlaskConical, Rocket, Dog, Music,
  Palette, PuzzleIcon: Puzzle, Zap, Code2, Bot, Ear,
};

export function getGameCategoryIcon(iconName: string | null | undefined): LucideIcon {
  return (iconName && GAME_CATEGORY_ICONS[iconName]) || Gamepad2;
}
