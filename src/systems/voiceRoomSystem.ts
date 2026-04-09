/**
 * Voice room types and cost definitions.
 * Actual room creation would go through Supabase / an edge function.
 */

export type VoiceRoomType = "mini" | "standard" | "pro" | "event";

export interface VoiceRoomConfig {
  type: VoiceRoomType;
  label: string;
  maxUsers: number | null; // null = unlimited
  costVX: number;
  icon: string;
}

export const VOICE_ROOM_CONFIGS: VoiceRoomConfig[] = [
  { type: "mini", label: "Mini Room", maxUsers: 4, costVX: 10, icon: "🎙️" },
  { type: "standard", label: "Standard Room", maxUsers: 8, costVX: 20, icon: "🎤" },
  { type: "pro", label: "Pro Room", maxUsers: 16, costVX: 50, icon: "🎧" },
  { type: "event", label: "Event Room", maxUsers: null, costVX: 10_000, icon: "🏟️" },
];

export const EVENT_HOURLY_COST = 5000;

export const DEFAULT_ROOMS = [
  { id: "main", name: "Main Hall", nameAr: "الديوانية العامة" },
  { id: "support", name: "Tech Support", nameAr: "الدعم الفني" },
  { id: "trade", name: "Trade & Commerce", nameAr: "قسم البيع والشراء" },
];
