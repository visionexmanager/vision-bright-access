import {
  BookOpen,
  Gamepad2,
  GraduationCap,
  Palette,
  Music,
  Tv,
  Puzzle,
  FlaskConical,
  Rocket,
  Dog,
  Globe2,
  Code2,
  Bot,
  Trophy,
  Users,
  Accessibility,
  Sparkles,
  HeartPulse,
  ShoppingBag,
  Blocks,
  School,
  Coins,
  Smartphone,
} from "lucide-react";
import type { KidsSection } from "@/features/visionkids/types/visionkids.types";

/**
 * The VisionKids sections. Each entry drives the home-page card grid,
 * the sidebar (a subset — see kidsNavItems below), and the generic
 * /kids/:slug section route. A section whose slug has its own dedicated
 * feature route (e.g. "talent" → /kids/talent, a static route that
 * out-ranks the :sectionSlug catch-all) links straight into that feature;
 * the rest fall through to the generic VisionKidsSection placeholder.
 * Colors cycle through the 6 brand tokens so the grid reads as varied.
 */
export const kidsSections: KidsSection[] = [
  { id: "stories", slug: "stories", icon: BookOpen, titleKey: "kids.section.stories.title", descKey: "kids.section.stories.desc", color: "primary", emoji: "📚" },
  { id: "games", slug: "games", icon: Gamepad2, titleKey: "kids.section.games.title", descKey: "kids.section.games.desc", color: "secondary", emoji: "🎮" },
  { id: "academy", slug: "academy", icon: GraduationCap, titleKey: "kids.section.academy.title", descKey: "kids.section.academy.desc", color: "accent", emoji: "🎓" },
  { id: "talent", slug: "talent", icon: Sparkles, titleKey: "kids.section.talent.title", descKey: "kids.section.talent.desc", color: "purple", emoji: "🌟" },
  { id: "health", slug: "health", icon: HeartPulse, titleKey: "kids.section.health.title", descKey: "kids.section.health.desc", color: "green", emoji: "💚" },
  { id: "stem", slug: "stem", icon: FlaskConical, titleKey: "kids.section.stem.title", descKey: "kids.section.stem.desc", color: "secondary", emoji: "🔬" },
  { id: "world", slug: "world", icon: Globe2, titleKey: "kids.section.world.title", descKey: "kids.section.world.desc", color: "primary", emoji: "🌍" },
  { id: "market", slug: "market", icon: ShoppingBag, titleKey: "kids.section.market.title", descKey: "kids.section.market.desc", color: "accent", emoji: "🛍️" },
  { id: "platform", slug: "platform", icon: Blocks, titleKey: "kids.section.platform.title", descKey: "kids.section.platform.desc", color: "purple", emoji: "🧩" },
  { id: "enterprise", slug: "enterprise", icon: School, titleKey: "kids.section.enterprise.title", descKey: "kids.section.enterprise.desc", color: "secondary", emoji: "🏫" },
  { id: "economy", slug: "economy", icon: Coins, titleKey: "kids.section.economy.title", descKey: "kids.section.economy.desc", color: "accent", emoji: "🪙" },
  { id: "everywhere", slug: "everywhere", icon: Smartphone, titleKey: "kids.section.everywhere.title", descKey: "kids.section.everywhere.desc", color: "primary", emoji: "🌐" },
  { id: "drawing", slug: "drawing", icon: Palette, titleKey: "kids.section.drawing.title", descKey: "kids.section.drawing.desc", color: "pink", emoji: "🎨" },
  { id: "music", slug: "music", icon: Music, titleKey: "kids.section.music.title", descKey: "kids.section.music.desc", color: "green", emoji: "🎵" },
  { id: "videos", slug: "videos", icon: Tv, titleKey: "kids.section.videos.title", descKey: "kids.section.videos.desc", color: "purple", emoji: "📺" },
  { id: "puzzles", slug: "puzzles", icon: Puzzle, titleKey: "kids.section.puzzles.title", descKey: "kids.section.puzzles.desc", color: "primary", emoji: "🧩" },
  { id: "science", slug: "science", icon: FlaskConical, titleKey: "kids.section.science.title", descKey: "kids.section.science.desc", color: "secondary", emoji: "🧪" },
  { id: "space", slug: "space", icon: Rocket, titleKey: "kids.section.space.title", descKey: "kids.section.space.desc", color: "accent", emoji: "🚀" },
  { id: "animals", slug: "animals", icon: Dog, titleKey: "kids.section.animals.title", descKey: "kids.section.animals.desc", color: "pink", emoji: "🐶" },
  { id: "geography", slug: "geography", icon: Globe2, titleKey: "kids.section.geography.title", descKey: "kids.section.geography.desc", color: "green", emoji: "🌍" },
  { id: "coding", slug: "coding", icon: Code2, titleKey: "kids.section.coding.title", descKey: "kids.section.coding.desc", color: "purple", emoji: "💻" },
  { id: "ai-teacher", slug: "ai-teacher", icon: Bot, titleKey: "kids.section.aiTeacher.title", descKey: "kids.section.aiTeacher.desc", color: "primary", emoji: "🤖" },
  { id: "challenges", slug: "challenges", icon: Trophy, titleKey: "kids.section.challenges.title", descKey: "kids.section.challenges.desc", color: "secondary", emoji: "🏆" },
  { id: "parents", slug: "parents", icon: Users, titleKey: "kids.section.parents.title", descKey: "kids.section.parents.desc", color: "accent", emoji: "👨‍👩‍👧" },
  { id: "accessibility", slug: "accessibility", icon: Accessibility, titleKey: "kids.section.accessibility.title", descKey: "kids.section.accessibility.desc", color: "pink", emoji: "♿" },
];

export function getKidsSectionBySlug(slug: string | undefined): KidsSection | undefined {
  return kidsSections.find((s) => s.slug === slug);
}
