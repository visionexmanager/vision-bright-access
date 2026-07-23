// ─── Library — Achievements Service (Phase 10) ────────────────────────────
// library_achievements/library_user_achievements already existed (Phase
// 6.5) but had zero frontend consumption — this is the first real reader
// for them. Earning itself happens entirely via DB triggers (see the
// marketplace migration) — this file is read-only.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryAchievementRow } from "@/lib/types/library-marketplace";

export async function fetchAllAchievements(): Promise<LibraryAchievementRow[]> {
  const { data, error } = await supabase.from("library_achievements").select("id, code, name, description, icon, reward_vx").order("reward_vx", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryAchievementRow[];
}

export async function fetchMyEarnedAchievementIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("library_user_achievements").select("achievement_id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.achievement_id));
}
