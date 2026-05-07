/**
 * Voice room types and cost definitions.
 * Actual room creation goes through Supabase.
 */

export type VoiceRoomType = "mini" | "standard" | "pro" | "event";

export interface VoiceRoomConfig {
  type: VoiceRoomType;
  labelKey: string;
  maxUsers: number | null; // null = unlimited
  costVX: number;
  joinCostVX: number;
  icon: string;
}

export const VOICE_ROOM_CONFIGS: VoiceRoomConfig[] = [
  { type: "mini",     labelKey: "vroom.type.mini",     maxUsers: 4,    costVX: 10,     joinCostVX: 2,  icon: "🎙️" },
  { type: "standard", labelKey: "vroom.type.standard", maxUsers: 8,    costVX: 20,     joinCostVX: 5,  icon: "🎤" },
  { type: "pro",      labelKey: "vroom.type.pro",      maxUsers: 16,   costVX: 50,     joinCostVX: 10, icon: "🧏" },
  { type: "event",    labelKey: "vroom.type.event",    maxUsers: null, costVX: 10_000, joinCostVX: 20, icon: "🏟️" },
];

export const EVENT_HOURLY_COST = 5000;

// UUIDs of the three admin-managed default rooms seeded in the DB.
// Kept here so other modules can reference them without a DB call if needed.
export const DEFAULT_ROOM_IDS = [
  "00000000-0000-4000-a000-000000000001",
  "00000000-0000-4000-a000-000000000002",
  "00000000-0000-4000-a000-000000000003",
] as const;
