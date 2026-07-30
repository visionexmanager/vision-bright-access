import {
  Compass, Dog, FlaskConical, Rocket, Wand2, Users, GraduationCap, Home, Trees,
  Landmark, BookHeart, Moon, Languages, GitBranch, BookOpenText, Search, Sparkles,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { KidsColor } from "@/features/visionkids/types/visionkids.types";

/** Maps kids_story_categories.icon (a string) to its Lucide component — DB
 *  stores the icon name so an admin can add a 19th category without a
 *  frontend deploy; only genuinely new icons need an entry added here. */
export const STORY_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Compass, Dog, FlaskConical, Rocket, Wand2, Users, GraduationCap, Home, Trees,
  Landmark, BookHeart, Moon, Languages, GitBranch, BookOpenText, Search, Sparkles,
};

export function getStoryCategoryIcon(iconName: string | null | undefined): LucideIcon {
  return (iconName && STORY_CATEGORY_ICONS[iconName]) || BookOpen;
}

/** kids_story_categories.color stores one of the VisionKids brand tokens. */
export function isKidsColor(value: string | null | undefined): value is KidsColor {
  return !!value && ["primary", "secondary", "accent", "pink", "green", "purple"].includes(value);
}
