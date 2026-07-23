// ─── Library — Daily Reward Service (Phase 10) ────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type { LibraryDailyRewardClaimResult } from "@/lib/types/library-marketplace";

export async function fetchTodaysClaim(userId: string): Promise<{ claim_date: string; streak_day: number; vx_awarded: number } | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("library_daily_reward_claims").select("claim_date, streak_day, vx_awarded").eq("user_id", userId).eq("claim_date", today).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function claimDailyReward(): Promise<LibraryDailyRewardClaimResult> {
  const { data, error } = await supabase.rpc("claim_library_daily_reward");
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row as LibraryDailyRewardClaimResult;
}
