// ─── Library — Listening Stats Service (Phase 7) ──────────────────────────
// Wraps the two self-scoped RPCs added in
// 20260726000000_library_audiobooks_platform.sql. recordListeningHeartbeat
// is deliberately separate from useAudiobookProgress's position tracking —
// position tracking answers "where was I," this answers "how much have I
// listened" (streak/hours), and seeking must never count as new listening
// time. The player engine throttles calls to ~once per 20s of ACTIVE
// playback, never on every timeupdate tick.

import { supabase } from "@/integrations/supabase/client";

export interface LibraryListeningStats {
  total_seconds_listened: number;
  total_books_completed: number;
  avg_playback_rate: number | null;
  current_streak_days: number;
}

export async function fetchListeningStats(): Promise<LibraryListeningStats> {
  const { data, error } = await supabase.rpc("get_library_listening_stats");
  if (error) throw new Error(error.message);
  return (data?.[0] as LibraryListeningStats) ?? { total_seconds_listened: 0, total_books_completed: 0, avg_playback_rate: null, current_streak_days: 0 };
}

export async function recordListeningHeartbeat(secondsDelta: number, rate?: number): Promise<void> {
  const { error } = await supabase.rpc("record_library_listening_heartbeat", { _seconds_delta: secondsDelta, _rate: rate ?? null });
  if (error) console.warn("library listening heartbeat failed:", error.message);
}
