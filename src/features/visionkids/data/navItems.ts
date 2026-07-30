import {
  Home,
  BookOpen,
  Gamepad2,
  GraduationCap,
  Palette,
  Music,
  FlaskConical,
  Rocket,
  Dog,
  Code2,
  Bot,
  Users,
  Settings,
} from "lucide-react";
import type { KidsNavItem } from "@/features/visionkids/types/visionkids.types";

/** Curated sidebar subset — matches the spec's sidebar list exactly (a smaller set than the 16 home cards). */
export const kidsNavItems: KidsNavItem[] = [
  { id: "home", labelKey: "kids.nav.home", icon: Home, to: "/kids" },
  { id: "stories", labelKey: "kids.nav.stories", icon: BookOpen, to: "/kids/stories" },
  { id: "games", labelKey: "kids.nav.games", icon: Gamepad2, to: "/kids/games" },
  { id: "learning", labelKey: "kids.nav.learning", icon: GraduationCap, to: "/kids/academy" },
  { id: "drawing", labelKey: "kids.nav.drawing", icon: Palette, to: "/kids/drawing" },
  { id: "music", labelKey: "kids.nav.music", icon: Music, to: "/kids/music" },
  { id: "science", labelKey: "kids.nav.science", icon: FlaskConical, to: "/kids/science" },
  { id: "space", labelKey: "kids.nav.space", icon: Rocket, to: "/kids/space" },
  { id: "animals", labelKey: "kids.nav.animals", icon: Dog, to: "/kids/animals" },
  { id: "coding", labelKey: "kids.nav.coding", icon: Code2, to: "/kids/coding" },
  { id: "ai-teacher", labelKey: "kids.nav.aiTeacher", icon: Bot, to: "/kids/ai-teacher" },
  { id: "parents", labelKey: "kids.nav.parents", icon: Users, to: "/kids/parents" },
  { id: "settings", labelKey: "kids.nav.settings", icon: Settings, to: "/kids/settings" },
];
