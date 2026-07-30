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
