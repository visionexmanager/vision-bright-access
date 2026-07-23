// ─── Library — Reader Follows (Phase 12: Reading Community) ───────────────
// library_follows is public-read (see migration), so followers/following
// lists are plain client queries — only names need the profile-summary RPC
// (see readerProfile.ts's resolveDisplay for why).

import { supabase } from "@/integrations/supabase/client";

export interface LibraryFollowUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

async function resolveDisplayMany(userIds: string[]): Promise<Map<string, { displayName: string; avatarUrl: string | null }>> {
  const map = new Map<string, { displayName: string; avatarUrl: string | null }>();
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return map;
  const { data, error } = await supabase.rpc("get_library_public_profile_summaries", { _user_ids: uniqueIds });
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ user_id: string; display_name: string | null; avatar_url: string | null }>) {
    map.set(row.user_id, { displayName: row.display_name ?? "Reader", avatarUrl: row.avatar_url ?? null });
  }
  return map;
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const { data, error } = await supabase.from("library_follows").select("follower_id").eq("follower_id", followerId).eq("followee_id", followeeId).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function followUser(followerId: string, followeeId: string): Promise<void> {
  const { error } = await supabase.from("library_follows").insert({ follower_id: followerId, followee_id: followeeId });
  if (error) throw new Error(error.message);
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<void> {
  const { error } = await supabase.from("library_follows").delete().eq("follower_id", followerId).eq("followee_id", followeeId);
  if (error) throw new Error(error.message);
}

export async function fetchFollowers(userId: string): Promise<LibraryFollowUser[]> {
  const { data, error } = await supabase.from("library_follows").select("follower_id").eq("followee_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => r.follower_id);
  const display = await resolveDisplayMany(ids);
  return ids.map((id) => ({ userId: id, ...(display.get(id) ?? { displayName: "Reader", avatarUrl: null }) }));
}

export async function fetchFollowing(userId: string): Promise<LibraryFollowUser[]> {
  const { data, error } = await supabase.from("library_follows").select("followee_id").eq("follower_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => r.followee_id);
  const display = await resolveDisplayMany(ids);
  return ids.map((id) => ({ userId: id, ...(display.get(id) ?? { displayName: "Reader", avatarUrl: null }) }));
}
