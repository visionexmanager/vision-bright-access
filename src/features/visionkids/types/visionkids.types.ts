import type { LucideIcon } from "lucide-react";

/** One of the fixed VisionKids brand colors — mapped to CSS custom properties in visionkids.css. */
export type KidsColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export interface KidsSection {
  /** Stable identifier, also used as the route slug under /kids/:slug */
  id: string;
  slug: string;
  icon: LucideIcon;
  /** i18n key resolved via useLanguage().t() */
  titleKey: string;
  descKey: string;
  color: KidsColor;
  /** Emoji shown alongside the icon on the home hero cards */
  emoji: string;
  /**
   * Where the card actually goes. Every section has one: a slug that owns a
   * route tree points at its own root, and a slug that is a theme rather than
   * a feature points at the page that already covers it (a STEM lab, an
   * explorer world, a game category). `/kids/:sectionSlug` redirects here too,
   * so a bookmarked slug lands in the same place as the card.
   */
  path: string;
}

export interface KidsNavItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  /** Absolute route, e.g. "/kids" or "/kids/stories" */
  to: string;
}

export type KidsTextScale = "normal" | "large" | "extra-large";

export interface KidsAccessibilityPrefs {
  textScale: KidsTextScale;
  reduceMotion: boolean;
}
