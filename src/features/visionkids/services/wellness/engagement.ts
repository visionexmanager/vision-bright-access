import { kidsDb, jsonPayload, rpcResult } from "@/features/visionkids/services/stories/kidsSupabase";
import type { ChallengeProgress, Companion, WellnessSettings, WellnessStats } from "@/features/visionkids/types/wellness.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

// ── Healthy challenges ─────────────────────────────────────────────────────
export async function fetchChallengeProgress(): Promise<ChallengeProgress[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_healthy_challenge_progress").select("*").eq("user_id", userId)
    .returns<ChallengeProgress[]>();
  if (error) throw error;
  return data ?? [];
}

export async function completeChallenge(challengeId: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("complete_kids_healthy_challenge", { _challenge_id: challengeId });
  if (error) throw error;
  return !!data;
}

// ── Stats ──────────────────────────────────────────────────────────────────
export async function fetchWellnessStats(): Promise<WellnessStats> {
  const { data, error } = await kidsDb.rpc("get_kids_wellness_stats");
  if (error) throw error;
  return rpcResult<WellnessStats>(data);
}

// ── Companion ──────────────────────────────────────────────────────────────
export async function fetchCompanion(): Promise<Companion | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_companion").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export interface CompanionInput {
  name: string;
  avatar: string;
  hobbies: string[];
  goals: string[];
}

export async function upsertCompanion(input: CompanionInput): Promise<Companion> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Must be signed in");
  const { data, error } = await kidsDb
    .from("kids_companion")
    .upsert({ user_id: userId, ...input }, { onConflict: "user_id" })
    .select("*").single();
  if (error) throw error;
  return data as Companion;
}

// ── Settings ───────────────────────────────────────────────────────────────
export async function fetchWellnessSettings(): Promise<WellnessSettings | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_wellness_settings").select("*").eq("user_id", userId).maybeSingle().returns<WellnessSettings>();
  if (error) throw error;
  return data ?? null;
}

export async function upsertWellnessSettings(input: Partial<Pick<WellnessSettings, "country_code" | "custom_emergency" | "reminders_enabled">>): Promise<WellnessSettings> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Must be signed in");
  // custom_emergency is the one jsonb column here; keep it out of the spread so
  // an omitted key stays omitted rather than being written as null.
  const { custom_emergency, ...rest } = input;
  const { data, error } = await kidsDb
    .from("kids_wellness_settings")
    .upsert(
      { user_id: userId, ...rest, ...(custom_emergency === undefined ? {} : { custom_emergency: jsonPayload(custom_emergency) }) },
      { onConflict: "user_id" },
    )
    .select("*").single();
  if (error) throw error;
  return data as WellnessSettings;
}
