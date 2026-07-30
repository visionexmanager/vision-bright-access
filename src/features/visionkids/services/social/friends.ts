import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsFriendship, KidsFriendProfile } from "@/features/visionkids/types/social.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchMyFriendships(): Promise<KidsFriendship[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_friendships").select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .returns<KidsFriendship[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfiles(userIds: string[]): Promise<KidsFriendProfile[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await kidsDb
    .from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds)
    .returns<KidsFriendProfile[]>();
  if (error) throw error;
  return data ?? [];
}

export async function sendFriendRequest(addresseeId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_friendships").insert({ requester_id: userId, addressee_id: addresseeId });
  if (error) throw error;
}

export async function respondFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await kidsDb
    .from("kids_friendships")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) throw error;

  if (accept) {
    await kidsDb.rpc("award_kids_xp", { _amount: 10, _reason: `Friend added: ${friendshipId}` }).then(() => {}, () => {});
    await kidsDb.rpc("award_kids_achievement", { _key: "first_friend" }).then(() => {}, () => {});
  }
}

export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await kidsDb.from("kids_friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

export async function blockUser(friendshipId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb
    .from("kids_friendships")
    .update({ status: "blocked", blocked_by: userId, responded_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) throw error;
}

export async function fetchFavoriteFriendIds(): Promise<string[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb.from("kids_favorite_friends").select("friend_user_id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.friend_user_id as string);
}

export async function toggleFavoriteFriend(friendUserId: string, isFavorite: boolean): Promise<void> {
  const userId = await requireUserId();
  if (isFavorite) {
    const { error } = await kidsDb.from("kids_favorite_friends").insert({ user_id: userId, friend_user_id: friendUserId });
    if (error) throw error;
  } else {
    const { error } = await kidsDb.from("kids_favorite_friends").delete().eq("user_id", userId).eq("friend_user_id", friendUserId);
    if (error) throw error;
  }
}

export async function muteUser(mutedUserId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_user_mutes").insert({ muter_id: userId, muted_user_id: mutedUserId });
  if (error) throw error;
}

export async function unmuteUser(mutedUserId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await kidsDb.from("kids_user_mutes").delete().eq("muter_id", userId).eq("muted_user_id", mutedUserId);
  if (error) throw error;
}

export async function fetchMyMutedUserIds(): Promise<string[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb.from("kids_user_mutes").select("muted_user_id").eq("muter_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.muted_user_id as string);
}
