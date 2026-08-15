import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsEvent, KidsEventReplay, KidsReplayProgress } from "@/features/visionkids/types/events.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export interface ReplayWithEvent extends KidsEventReplay {
  event: KidsEvent | null;
}

export async function fetchReplays(searchQuery?: string): Promise<ReplayWithEvent[]> {
  const query = kidsDb.from("kids_event_replays").select("*, event:kids_events(*)").order("created_at", { ascending: false });
  const { data, error } = await query.returns<ReplayWithEvent[]>();
  if (error) throw error;
  const rows = data ?? [];
  if (!searchQuery) return rows;
  const q = searchQuery.toLowerCase();
  return rows.filter((r) => r.event?.title.toLowerCase().includes(q) || r.event?.category.toLowerCase().includes(q));
}

export async function fetchReplayByEventId(eventId: string): Promise<KidsEventReplay | null> {
  const { data, error } = await kidsDb.from("kids_event_replays").select("*").eq("event_id", eventId).maybeSingle().returns<KidsEventReplay>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchMyReplayProgress(replayId: string): Promise<KidsReplayProgress | null> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_replay_progress").select("*").eq("replay_id", replayId).eq("user_id", userId).maybeSingle()
    .returns<KidsReplayProgress>();
  if (error) throw error;
  return data ?? null;
}

export async function saveReplayProgress(replayId: string, positionSeconds: number): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb
    .from("kids_replay_progress")
    .upsert({ user_id: userId, replay_id: replayId, position_seconds: positionSeconds }, { onConflict: "user_id,replay_id" });
  if (error) throw error;
}

export async function fetchMyContinueWatching(limit = 6): Promise<(KidsReplayProgress & { replay: ReplayWithEvent | null })[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_replay_progress")
    .select("*, replay:kids_event_replays(*, event:kids_events(*))")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as (KidsReplayProgress & { replay: ReplayWithEvent | null })[];
}

export async function incrementReplayViewCount(replayId: string): Promise<void> {
  await kidsDb.rpc("increment_kids_replay_view", { _replay_id: replayId }).then(() => {}, () => {});
}
