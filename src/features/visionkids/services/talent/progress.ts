import { kidsDb, rpcResult } from "@/features/visionkids/services/stories/kidsSupabase";
import type { ModuleProgress, TalentStats } from "@/features/visionkids/types/talent.types";

export async function fetchMyModuleProgress(trackSlug?: string): Promise<ModuleProgress[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return [];
  let query = kidsDb.from("kids_track_module_progress").select("*").eq("user_id", userId);
  if (trackSlug) query = query.eq("track_slug", trackSlug);
  const { data, error } = await query.returns<ModuleProgress[]>();
  if (error) throw error;
  return data ?? [];
}

export interface CompleteModuleResult {
  newly_completed_module: boolean;
  track_completed_now: boolean;
  done: number;
  total: number;
}

export async function completeModule(moduleId: string): Promise<CompleteModuleResult> {
  const { data, error } = await kidsDb.rpc("complete_kids_track_module", { _module_id: moduleId });
  if (error) throw error;
  return rpcResult<CompleteModuleResult>(data);
}

export async function fetchTalentStats(): Promise<TalentStats> {
  const { data, error } = await kidsDb.rpc("get_kids_talent_stats");
  if (error) throw error;
  return rpcResult<TalentStats>(data);
}
