import { kidsDb, rpcResult, jsonPayload } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  WorldHome, InventoryItem, QuestProgress, WorldSettings, WorldStats,
} from "@/features/visionkids/types/world.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

// ── Home ────────────────────────────────────────────────────────────────────
export async function fetchHome(): Promise<WorldHome | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_world_homes").select("*").eq("user_id", userId).maybeSingle().returns<WorldHome>();
  if (error) throw error;
  return data ?? null;
}

export async function saveHome(name: string, theme: string, rooms: Record<string, unknown>): Promise<void> {
  const { error } = await kidsDb.rpc("save_kids_home", { _name: name, _theme: theme, _rooms: jsonPayload(rooms) });
  if (error) throw error;
}

// ── Inventory ───────────────────────────────────────────────────────────────
export async function fetchInventory(): Promise<InventoryItem[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_world_inventory").select("*").eq("user_id", userId).order("acquired_at", { ascending: false })
    .returns<InventoryItem[]>();
  if (error) throw error;
  return data ?? [];
}

// ── Quests ──────────────────────────────────────────────────────────────────
export async function fetchQuestProgress(): Promise<QuestProgress[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_quest_progress").select("*").eq("user_id", userId)
    .returns<QuestProgress[]>();
  if (error) throw error;
  return data ?? [];
}

export interface WorldQuestResult { newly_completed: boolean; period_start: string; }

export async function completeQuest(activityId: string): Promise<WorldQuestResult> {
  const { data, error } = await kidsDb.rpc("complete_kids_world_quest", { _activity_id: activityId });
  if (error) throw error;
  return rpcResult<WorldQuestResult>(data);
}

// ── Region visits ───────────────────────────────────────────────────────────
export async function visitRegion(regionSlug: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("visit_kids_region", { _region_slug: regionSlug });
  if (error) throw error;
  return !!data;
}

export async function fetchVisitedRegionSlugs(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_region_visits").select("region_slug").eq("user_id", userId)
    .returns<{ region_slug: string }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.region_slug);
}

// ── Transport ───────────────────────────────────────────────────────────────
export async function fetchTransportUnlocks(): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_transport_unlocks").select("transport_slug").eq("user_id", userId)
    .returns<{ transport_slug: string }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.transport_slug);
}

export async function unlockTransport(transportSlug: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("unlock_kids_transport", { _transport_slug: transportSlug });
  if (error) throw error;
  return !!data;
}

// ── Settings ────────────────────────────────────────────────────────────────
export async function fetchWorldSettings(): Promise<WorldSettings | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_world_settings").select("*").eq("user_id", userId).maybeSingle().returns<WorldSettings>();
  if (error) throw error;
  return data ?? null;
}

export async function upsertWorldSettings(
  input: Partial<Pick<WorldSettings, "current_transport" | "weather" | "audio_navigation" | "voice_commands">>,
): Promise<WorldSettings> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Must be signed in");
  const { data, error } = await kidsDb
    .from("kids_world_settings")
    .upsert({ user_id: userId, ...input }, { onConflict: "user_id" })
    .select("*").single();
  if (error) throw error;
  return data as WorldSettings;
}

// ── Stats ───────────────────────────────────────────────────────────────────
export async function fetchWorldStats(): Promise<WorldStats> {
  const { data, error } = await kidsDb.rpc("get_kids_world_stats");
  if (error) throw error;
  return rpcResult<WorldStats>(data);
}
