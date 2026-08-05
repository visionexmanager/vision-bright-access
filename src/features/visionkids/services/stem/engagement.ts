import { kidsDb, rpcResult } from "@/features/visionkids/services/stories/kidsSupabase";
import type { ExperimentProgress, StemSettings, StemStats } from "@/features/visionkids/types/stem.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

// ── Experiment progress ─────────────────────────────────────────────────────
export async function fetchExperimentProgress(): Promise<ExperimentProgress[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_experiment_progress").select("*").eq("user_id", userId)
    .returns<ExperimentProgress[]>();
  if (error) throw error;
  return data ?? [];
}

export interface CompleteExperimentResult {
  newly_completed: boolean;
  best_score: number;
}

export async function completeExperiment(experimentId: string, quizScore = 0): Promise<CompleteExperimentResult> {
  const { data, error } = await kidsDb.rpc("complete_kids_experiment", {
    _experiment_id: experimentId,
    _quiz_score: quizScore,
  });
  if (error) throw error;
  return rpcResult<CompleteExperimentResult>(data);
}

// ── Research reads ──────────────────────────────────────────────────────────
export async function markResearchRead(articleId: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("mark_kids_research_read", { _article_id: articleId });
  if (error) throw error;
  return !!data;
}

export async function fetchReadArticleIds(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_research_reads").select("article_id").eq("user_id", userId)
    .returns<{ article_id: string }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.article_id);
}

// ── Stats ───────────────────────────────────────────────────────────────────
export async function fetchStemStats(): Promise<StemStats> {
  const { data, error } = await kidsDb.rpc("get_kids_stem_stats");
  if (error) throw error;
  return rpcResult<StemStats>(data);
}

// ── Settings ────────────────────────────────────────────────────────────────
export async function fetchStemSettings(): Promise<StemSettings | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_stem_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertStemSettings(
  input: Partial<Pick<StemSettings, "audio_descriptions" | "voice_commands" | "simple_language">>,
): Promise<StemSettings> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Must be signed in");
  const { data, error } = await kidsDb
    .from("kids_stem_settings")
    .upsert({ user_id: userId, ...input }, { onConflict: "user_id" })
    .select("*").single();
  if (error) throw error;
  return data as StemSettings;
}
