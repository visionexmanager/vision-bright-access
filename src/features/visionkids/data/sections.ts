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
 * The VisionKids sections. Each entry drives the home-page card grid, the
 * sidebar (a subset — see kidsNavItems), and the `/kids/:sectionSlug` route.
 *
 * Every section carries a real `path`. Twelve of them own a route tree and
 * point at its root. The other thirteen are *themes* rather than features —
 * "space", "animals", "coding" and so on — and each points at the page that
 * already covers it: a STEM lab, an explorer world, a game category, a studio
 * tool. Those thirteen used to fall through to a generic "coming soon" screen
 * even though the content existed one route away.
 *
 * Colors cycle through the 6 brand tokens so the grid reads as varied.
 */
export const kidsSections: KidsSection[] = [
  // ── Sections that own a route tree ──────────────────────────────────────
  { id: "stories", slug: "stories", path: "/kids/stories", icon: BookOpen, titleKey: "kids.section.stories.title", descKey: "kids.section.stories.desc", color: "primary", emoji: "📚" },
  { id: "games", slug: "games", path: "/kids/games", icon: Gamepad2, titleKey: "kids.section.games.title", descKey: "kids.section.games.desc", color: "secondary", emoji: "🎮" },
  { id: "academy", slug: "academy", path: "/kids/academy", icon: GraduationCap, titleKey: "kids.section.academy.title", descKey: "kids.section.academy.desc", color: "accent", emoji: "🎓" },
  { id: "talent", slug: "talent", path: "/kids/talent", icon: Sparkles, titleKey: "kids.section.talent.title", descKey: "kids.section.talent.desc", color: "purple", emoji: "🌟" },
  { id: "health", slug: "health", path: "/kids/health", icon: HeartPulse, titleKey: "kids.section.health.title", descKey: "kids.section.health.desc", color: "green", emoji: "💚" },
  { id: "stem", slug: "stem", path: "/kids/stem", icon: FlaskConical, titleKey: "kids.section.stem.title", descKey: "kids.section.stem.desc", color: "secondary", emoji: "🔬" },
  { id: "world", slug: "world", path: "/kids/world", icon: Globe2, titleKey: "kids.section.world.title", descKey: "kids.section.world.desc", color: "primary", emoji: "🌍" },
  { id: "market", slug: "market", path: "/kids/market", icon: ShoppingBag, titleKey: "kids.section.market.title", descKey: "kids.section.market.desc", color: "accent", emoji: "🛍️" },
  { id: "platform", slug: "platform", path: "/kids/platform", icon: Blocks, titleKey: "kids.section.platform.title", descKey: "kids.section.platform.desc", color: "purple", emoji: "🧩" },
  { id: "enterprise", slug: "enterprise", path: "/kids/enterprise", icon: School, titleKey: "kids.section.enterprise.title", descKey: "kids.section.enterprise.desc", color: "secondary", emoji: "🏫" },
  { id: "economy", slug: "economy", path: "/kids/economy", icon: Coins, titleKey: "kids.section.economy.title", descKey: "kids.section.economy.desc", color: "accent", emoji: "🪙" },
  { id: "everywhere", slug: "everywhere", path: "/kids/everywhere", icon: Smartphone, titleKey: "kids.section.everywhere.title", descKey: "kids.section.everywhere.desc", color: "primary", emoji: "🌐" },

  // ── Themes that point at the feature already covering them ──────────────
  { id: "drawing", slug: "drawing", path: "/kids/studio", icon: Palette, titleKey: "kids.section.drawing.title", descKey: "kids.section.drawing.desc", color: "pink", emoji: "🎨" },
  { id: "music", slug: "music", path: "/kids/studio/music-studio", icon: Music, titleKey: "kids.section.music.title", descKey: "kids.section.music.desc", color: "green", emoji: "🎵" },
  { id: "videos", slug: "videos", path: "/kids/studio/video-creator", icon: Tv, titleKey: "kids.section.videos.title", descKey: "kids.section.videos.desc", color: "purple", emoji: "📺" },
  { id: "puzzles", slug: "puzzles", path: "/kids/games/category/logic", icon: Puzzle, titleKey: "kids.section.puzzles.title", descKey: "kids.section.puzzles.desc", color: "primary", emoji: "🧩" },
  { id: "science", slug: "science", path: "/kids/stem/science", icon: FlaskConical, titleKey: "kids.section.science.title", descKey: "kids.section.science.desc", color: "secondary", emoji: "🧪" },
  { id: "space", slug: "space", path: "/kids/explorer/world/planet-explorer", icon: Rocket, titleKey: "kids.section.space.title", descKey: "kids.section.space.desc", color: "accent", emoji: "🚀" },
  { id: "animals", slug: "animals", path: "/kids/explorer/world/animal-kingdom", icon: Dog, titleKey: "kids.section.animals.title", descKey: "kids.section.animals.desc", color: "pink", emoji: "🐶" },
  { id: "geography", slug: "geography", path: "/kids/explorer/world/geography-explorer", icon: Globe2, titleKey: "kids.section.geography.title", descKey: "kids.section.geography.desc", color: "green", emoji: "🌍" },
  { id: "coding", slug: "coding", path: "/kids/games/category/coding", icon: Code2, titleKey: "kids.section.coding.title", descKey: "kids.section.coding.desc", color: "purple", emoji: "💻" },
  { id: "ai-teacher", slug: "ai-teacher", path: "/kids/ai-teacher", icon: Bot, titleKey: "kids.section.aiTeacher.title", descKey: "kids.section.aiTeacher.desc", color: "primary", emoji: "🤖" },
  { id: "challenges", slug: "challenges", path: "/kids/games/daily-challenges", icon: Trophy, titleKey: "kids.section.challenges.title", descKey: "kids.section.challenges.desc", color: "secondary", emoji: "🏆" },
  { id: "parents", slug: "parents", path: "/kids/social/parents/dashboard", icon: Users, titleKey: "kids.section.parents.title", descKey: "kids.section.parents.desc", color: "accent", emoji: "👨‍👩‍👧" },
  { id: "accessibility", slug: "accessibility", path: "/kids/settings", icon: Accessibility, titleKey: "kids.section.accessibility.title", descKey: "kids.section.accessibility.desc", color: "pink", emoji: "♿" },
];

export function getKidsSectionBySlug(slug: string | undefined): KidsSection | undefined {
  return kidsSections.find((s) => s.slug === slug);
}
