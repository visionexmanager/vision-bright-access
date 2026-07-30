export type KidsColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export type RegionKind = "district" | "island" | "system";

export interface WorldRegion {
  slug: string;
  title: string;
  subtitle: string | null;
  emoji: string;
  kind: RegionKind;
  parent_slug: string | null;
  route: string | null;
  color: KidsColor;
  map_x: number;
  map_y: number;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export type ActivityKind = "activity" | "quest" | "story" | "game" | "mission";
export type Cadence = "anytime" | "daily" | "weekly" | "seasonal";

export interface WorldActivity {
  id: string;
  region: string;
  slug: string;
  title: string;
  emoji: string;
  summary: string | null;
  kind: ActivityKind;
  cadence: Cadence;
  npc_slug: string | null;
  content: Record<string, unknown>;
  reward_xp: number;
  reward_coins: number;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export type NpcRole = "teacher" | "explorer" | "scientist" | "artist" | "robot" | "pilot" | "farmer";

export interface Npc {
  slug: string;
  name: string;
  role: NpcRole;
  region: string | null;
  emoji: string;
  greeting: string | null;
  content: Record<string, unknown>;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export type ItemCategory = "clothing" | "decor" | "furniture" | "pet" | "tool" | "effect";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface MarketItem {
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  category: ItemCategory;
  price_coins: number;
  rarity: Rarity;
  color: KidsColor;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface Transport {
  slug: string;
  name: string;
  emoji: string;
  speed: number;
  unlock_achievement: string | null;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

// ── Per-child ────────────────────────────────────────────────────────────────
export type HomeTheme = "cozy" | "modern" | "space" | "nature" | "candy";

export interface WorldHome {
  user_id: string;
  name: string;
  theme: HomeTheme;
  rooms: Record<string, unknown>;
  updated_at: string;
  created_at: string;
}

export interface InventoryItem {
  user_id: string;
  item_slug: string;
  category: ItemCategory;
  placed: boolean;
  room: string | null;
  pos_x: number | null;
  pos_y: number | null;
  acquired_at: string;
}

export interface QuestProgress {
  user_id: string;
  activity_id: string;
  period_start: string;
  status: "active" | "completed";
  completed_at: string | null;
}

export type WeatherKind = "auto" | "sunny" | "night" | "rain" | "snow" | "wind";

export interface WorldSettings {
  user_id: string;
  current_transport: string;
  weather: WeatherKind;
  audio_navigation: boolean;
  voice_commands: boolean;
  updated_at: string;
}

export interface WorldStats {
  coins: number;
  regions: number;
  quests: number;
  items: number;
  pets: number;
  transports: number;
  badges: string[];
}

export interface BuyResult {
  ok: boolean;
  balance_after: number;
}
