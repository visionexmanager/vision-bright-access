/**
 * Voice room types and cost definitions.
 * Actual room creation would go through Supabase / an edge function.
 */

export type VoiceRoomType = "mini" | "standard" | "pro" | "event";

export interface VoiceRoomConfig {
  type: VoiceRoomType;
  labelKey: string;
  maxUsers: number | null; // null = unlimited
  costVX: number;
  icon: string;
}

export const VOICE_ROOM_CONFIGS: VoiceRoomConfig[] = [
  { type: "mini",     labelKey: "vroom.type.mini",     maxUsers: 4,    costVX: 10,     icon: "🎙️" },
  { type: "standard", labelKey: "vroom.type.standard", maxUsers: 8,    costVX: 20,     icon: "🎤" },
  { type: "pro",      labelKey: "vroom.type.pro",      maxUsers: 16,   costVX: 50,     icon: "🎧" },
  { type: "event",    labelKey: "vroom.type.event",    maxUsers: null, costVX: 10_000, icon: "🏟️" },
];

export const EVENT_HOURLY_COST = 5000;

/** VX deducted every time a user joins a default public room */
export const PUBLIC_ROOM_JOIN_COST = 5;

export const DEFAULT_ROOMS = [
  { id: "00000000-0000-4000-a000-000000000001", nameKey: "vroom.default.mainHall" },
  { id: "00000000-0000-4000-a000-000000000002", nameKey: "vroom.default.techSupport" },
  { id: "00000000-0000-4000-a000-000000000003", nameKey: "vroom.default.tradeCommerce" },
];
