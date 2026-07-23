// ─── Library — Leaderboards (Phase 12: Reading Community) ─────────────────

import { supabase } from "@/integrations/supabase/client";

export type LibraryLeaderboardMetric = "readers" | "reviewers" | "helpful" | "clubs" | "authors";
export type LibraryLeaderboardPeriod = "week" | "month" | "year" | "all";

export interface LibraryLeaderboardEntry {
  entityId: string;
  name: string;
  imageUrl: string | null;
  score: number;
}

export async function fetchLeaderboard(metric: LibraryLeaderboardMetric, period: LibraryLeaderboardPeriod): Promise<LibraryLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("get_library_leaderboard", { _metric: metric, _period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ entity_id: string; name: string | null; image_url: string | null; score: number }>).map((row) => ({
    entityId: row.entity_id, name: row.name ?? "Reader", imageUrl: row.image_url, score: Number(row.score),
  }));
}
