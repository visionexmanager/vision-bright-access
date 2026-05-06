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
  joinCostVX: number;
  icon: string;
}

export const VOICE_ROOM_CONFIGS: VoiceRoomConfig[] = [
  { type: "mini",     labelKey: "vroom.type.mini",     maxUsers: 4,    costVX: 10,     joinCostVX: 2,  icon: "🎙️" },
  { type: "standard", labelKey: "vroom.type.standard", maxUsers: 8,    costVX: 20,     joinCostVX: 5,  icon: "🎤" },
  { type: "pro",      labelKey: "vroom.type.pro",      maxUsers: 16,   costVX: 50,     joinCostVX: 10, icon: "🎧" },
  { type: "event",    labelKey: "vroom.type.event",    maxUsers: null, costVX: 10_000, joinCostVX: 20, icon: "🏟️" },
];

export const EVENT_HOURLY_COST = 5000;
