/**
 * Voice room types and cost definitions.
 * Actual room creation would go through Supabase / an edge function.
 */

export type VoiceRoomType = "mini" | "standard" | "pro" | "event";

export interface VoiceRoomConfig {
  type: VoiceRoomType;
  label: string;     // English label
  labelAr: string;   // Arabic label
  maxUsers: number | null; // null = unlimited
  costVX: number;
  icon: string;
}

export const VOICE_ROOM_CONFIGS: VoiceRoomConfig[] = [
  { type: "mini",     label: "Mini Room",     labelAr: "غرفة صغيرة",     maxUsers: 4,    costVX: 10,     icon: "🎙️" },
  { type: "standard", label: "Standard Room", labelAr: "غرفة عادية",     maxUsers: 8,    costVX: 20,     icon: "🎤" },
  { type: "pro",      label: "Pro Room",      labelAr: "غرفة احترافية",  maxUsers: 16,   costVX: 50,     icon: "🎧" },
  { type: "event",    label: "Event Room",    labelAr: "غرفة الفعاليات", maxUsers: null, costVX: 10_000, icon: "🏟️" },
];

export const EVENT_HOURLY_COST = 5000;

export const DEFAULT_ROOMS = [
  { id: "00000000-0000-4000-a000-000000000001", name: "Main Hall", nameAr: "الديوانية العامة" },
  { id: "00000000-0000-4000-a000-000000000002", name: "Tech Support", nameAr: "الدعم الفني" },
  { id: "00000000-0000-4000-a000-000000000003", name: "Trade & Commerce", nameAr: "قسم البيع والشراء" },
];
