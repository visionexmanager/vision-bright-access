import type { ProductType, CreatorKind, ProductLevel, LicenseKind } from "@/features/visionkids/types/market.types";

export type KidsColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export const MARKET_COLOR_CLASSES: Record<KidsColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

export interface ProductTypeMeta {
  type: ProductType;
  emoji: string;
  labelKey: string;
  color: KidsColor;
}

/** Every publishable content type. Adding one is a row here + a CHECK value in
 *  the catalog — the generic ProductListPage renders any type with no new code. */
export const PRODUCT_TYPES: ProductTypeMeta[] = [
  { type: "course", emoji: "🎓", labelKey: "kids.market.type.course", color: "primary" },
  { type: "book", emoji: "📕", labelKey: "kids.market.type.book", color: "accent" },
  { type: "game", emoji: "🎮", labelKey: "kids.market.type.game", color: "secondary" },
  { type: "worksheet", emoji: "📝", labelKey: "kids.market.type.worksheet", color: "green" },
  { type: "template", emoji: "🧩", labelKey: "kids.market.type.template", color: "purple" },
  { type: "music", emoji: "🎵", labelKey: "kids.market.type.music", color: "pink" },
  { type: "video", emoji: "🎬", labelKey: "kids.market.type.video", color: "primary" },
  { type: "model3d", emoji: "🧊", labelKey: "kids.market.type.model3d", color: "accent" },
  { type: "prompt", emoji: "💬", labelKey: "kids.market.type.prompt", color: "secondary" },
  { type: "bundle", emoji: "🎁", labelKey: "kids.market.type.bundle", color: "pink" },
  { type: "story", emoji: "📖", labelKey: "kids.market.type.story", color: "green" },
  { type: "activity", emoji: "🎨", labelKey: "kids.market.type.activity", color: "purple" },
  { type: "pdf", emoji: "📄", labelKey: "kids.market.type.pdf", color: "primary" },
  { type: "epub", emoji: "📗", labelKey: "kids.market.type.epub", color: "accent" },
  { type: "audio", emoji: "🎧", labelKey: "kids.market.type.audio", color: "secondary" },
  { type: "character", emoji: "🦸", labelKey: "kids.market.type.character", color: "pink" },
  { type: "puzzle", emoji: "🧩", labelKey: "kids.market.type.puzzle", color: "green" },
  { type: "sfx", emoji: "🔊", labelKey: "kids.market.type.sfx", color: "purple" },
];

export const PRODUCT_TYPE_META: Record<string, ProductTypeMeta> = Object.fromEntries(
  PRODUCT_TYPES.map((t) => [t.type, t]),
);

/** The content types that get their own browse page + static route. The rest
 *  are reachable via Discover's type filter. */
export interface TypePageConfig {
  type: ProductType;
  emoji: string;
  canonicalPath: string;
}

export const TYPE_PAGES: Record<string, TypePageConfig> = {
  course: { type: "course", emoji: "🎓", canonicalPath: "/kids/market/courses" },
  book: { type: "book", emoji: "📕", canonicalPath: "/kids/market/books" },
  game: { type: "game", emoji: "🎮", canonicalPath: "/kids/market/games" },
  worksheet: { type: "worksheet", emoji: "📝", canonicalPath: "/kids/market/worksheets" },
  template: { type: "template", emoji: "🧩", canonicalPath: "/kids/market/templates" },
  music: { type: "music", emoji: "🎵", canonicalPath: "/kids/market/music" },
  video: { type: "video", emoji: "🎬", canonicalPath: "/kids/market/videos" },
  model3d: { type: "model3d", emoji: "🧊", canonicalPath: "/kids/market/3d-models" },
  prompt: { type: "prompt", emoji: "💬", canonicalPath: "/kids/market/ai-prompts" },
  bundle: { type: "bundle", emoji: "🎁", canonicalPath: "/kids/market/bundles" },
};

export const CREATOR_KINDS: { kind: CreatorKind; emoji: string; dashboard: string }[] = [
  { kind: "creator", emoji: "🎨", dashboard: "/kids/market/creator" },
  { kind: "teacher", emoji: "🧑‍🏫", dashboard: "/kids/market/teacher" },
  { kind: "publisher", emoji: "📚", dashboard: "/kids/market/publisher" },
  { kind: "developer", emoji: "💻", dashboard: "/kids/market/developer" },
];

export const PRODUCT_LEVELS: ProductLevel[] = ["all", "beginner", "intermediate", "advanced"];
export const LICENSE_KINDS: LicenseKind[] = ["standard", "extended", "personal", "cc"];
export const LANGUAGES = ["en", "ar", "fr", "es", "de", "tr", "ur", "hi", "zh", "ru", "pt"];

export const SORT_OPTIONS = ["newest", "popular", "rating", "price_low", "price_high"] as const;

export const STATUS_BADGE: Record<string, { color: KidsColor; labelKey: string }> = {
  draft: { color: "secondary", labelKey: "kids.market.status.draft" },
  pending: { color: "accent", labelKey: "kids.market.status.pending" },
  published: { color: "green", labelKey: "kids.market.status.published" },
  rejected: { color: "pink", labelKey: "kids.market.status.rejected" },
};

export const RATING_STARS = [1, 2, 3, 4, 5];
