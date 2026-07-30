import type { KidsColor, ItemCategory, Rarity, HomeTheme, WeatherKind } from "@/features/visionkids/types/world.types";

export const WORLD_COLOR_CLASSES: Record<KidsColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

/** The named districts that get their own static route + thin wrapper page,
 *  all rendered by the generic RegionPage over the polymorphic catalog. Adding
 *  a district is a catalog row + (optionally) a wrapper; islands and future
 *  regions use the generic /kids/world/region/:slug route with zero new code. */
export interface DistrictPageConfig {
  slug: string;
  emoji: string;
  canonicalPath: string;
}

export const DISTRICT_PAGES: Record<string, DistrictPageConfig> = {
  "science-city": { slug: "science-city", emoji: "🔬", canonicalPath: "/kids/world/science-city" },
  "reading-village": { slug: "reading-village", emoji: "📚", canonicalPath: "/kids/world/reading-village" },
  "art-district": { slug: "art-district", emoji: "🎨", canonicalPath: "/kids/world/art-district" },
  "music-town": { slug: "music-town", emoji: "🎵", canonicalPath: "/kids/world/music-town" },
  "sports-arena": { slug: "sports-arena", emoji: "⚽", canonicalPath: "/kids/world/sports-arena" },
  "space-port": { slug: "space-port", emoji: "🚀", canonicalPath: "/kids/world/space-port" },
  "ocean-world": { slug: "ocean-world", emoji: "🐠", canonicalPath: "/kids/world/ocean-world" },
  "nature-park": { slug: "nature-park", emoji: "🌳", canonicalPath: "/kids/world/nature-park" },
  "events-plaza": { slug: "events-plaza", emoji: "🎪", canonicalPath: "/kids/world/events-plaza" },
};

export const MARKET_CATEGORIES: (ItemCategory | "all")[] = [
  "all", "clothing", "decor", "furniture", "pet", "tool", "effect",
];

export const RARITY_RING: Record<Rarity, string> = {
  common: "ring-border",
  rare: "ring-kids-secondary",
  epic: "ring-kids-purple",
  legendary: "ring-kids-accent",
};

export const HOME_THEMES: { slug: HomeTheme; emoji: string; bg: string }[] = [
  { slug: "cozy", emoji: "🛋️", bg: "from-kids-accent/15 to-kids-pink/10" },
  { slug: "modern", emoji: "🏢", bg: "from-kids-primary/15 to-kids-secondary/10" },
  { slug: "space", emoji: "🪐", bg: "from-kids-purple/20 to-kids-primary/10" },
  { slug: "nature", emoji: "🌿", bg: "from-kids-green/20 to-kids-accent/10" },
  { slug: "candy", emoji: "🍭", bg: "from-kids-pink/20 to-kids-purple/10" },
];

/** Weather options a child can set in the Weather Center. `auto` follows the
 *  time of day (day/night) computed client-side. */
export const WEATHER_OPTIONS: { slug: WeatherKind; emoji: string }[] = [
  { slug: "auto", emoji: "🔄" },
  { slug: "sunny", emoji: "☀️" },
  { slug: "night", emoji: "🌙" },
  { slug: "rain", emoji: "🌧️" },
  { slug: "snow", emoji: "❄️" },
  { slug: "wind", emoji: "🌬️" },
];

/** Visual treatment per weather for the world backdrop. */
export const WEATHER_BACKDROP: Record<Exclude<WeatherKind, "auto"> | "day", { gradient: string; overlay: string }> = {
  day: { gradient: "from-sky-200/40 to-kids-green/10", overlay: "" },
  sunny: { gradient: "from-amber-200/40 to-sky-200/30", overlay: "☀️" },
  night: { gradient: "from-indigo-900/40 to-slate-800/30", overlay: "🌙" },
  rain: { gradient: "from-slate-400/30 to-sky-300/20", overlay: "🌧️" },
  snow: { gradient: "from-sky-100/50 to-slate-200/30", overlay: "❄️" },
  wind: { gradient: "from-teal-200/30 to-slate-200/20", overlay: "🍃" },
};

/** The 8 World achievement badges (keys match kids_achievements seed). */
export const WORLD_BADGES: { key: string; emoji: string }[] = [
  { key: "world_explorer", emoji: "🧭" },
  { key: "world_scientist", emoji: "🔬" },
  { key: "world_reader", emoji: "📚" },
  { key: "world_artist", emoji: "🎨" },
  { key: "world_musician", emoji: "🎵" },
  { key: "world_inventor", emoji: "🚀" },
  { key: "world_builder", emoji: "🏠" },
  { key: "world_programmer", emoji: "💻" },
];

export const ACTIVITY_KIND_EMOJI: Record<string, string> = {
  activity: "⭐",
  quest: "🎯",
  story: "📖",
  game: "🎮",
  mission: "🚀",
};
