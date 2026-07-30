import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { MultiplayerRoom, MultiplayerRoomPlayer } from "@/features/visionkids/types/games.types";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchPublicRooms(): Promise<MultiplayerRoom[]> {
  const { data, error } = await kidsDb
    .from("kids_multiplayer_rooms")
    .select("*, players:kids_multiplayer_room_players(*)")
    .eq("is_public", true)
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .returns<MultiplayerRoom[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchRoomByCode(code: string): Promise<MultiplayerRoom | null> {
  const { data, error } = await kidsDb
    .from("kids_multiplayer_rooms")
    .select("*, players:kids_multiplayer_room_players(*)")
    .eq("code", code.toUpperCase())
    .maybeSingle()
    .returns<MultiplayerRoom>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchRoomById(id: string): Promise<MultiplayerRoom | null> {
  const { data, error } = await kidsDb
    .from("kids_multiplayer_rooms")
    .select("*, players:kids_multiplayer_room_players(*)")
    .eq("id", id)
    .maybeSingle()
    .returns<MultiplayerRoom>();
  if (error) throw error;
  return data ?? null;
}

export interface CreateRoomInput {
  gameId?: string;
  roomName: string;
  isPublic: boolean;
  maxPlayers?: number;
}

export async function createRoom(input: CreateRoomInput): Promise<MultiplayerRoom> {
  const host_id = await requireUserId();
  const code = generateRoomCode();
  const { data, error } = await kidsDb
    .from("kids_multiplayer_rooms")
    .insert({ host_id, code, game_id: input.gameId ?? null, room_name: input.roomName, is_public: input.isPublic, max_players: input.maxPlayers ?? 4 })
    .select("*").single().returns<MultiplayerRoom>();
  if (error) throw error;

  await kidsDb.from("kids_multiplayer_room_players").insert({ room_id: data.id, user_id: host_id, is_ready: true });
  return data;
}

export async function joinRoom(roomId: string): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_multiplayer_room_players").insert({ room_id: roomId, user_id });
  if (error && error.code !== "23505") throw error;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_multiplayer_room_players").delete().eq("room_id", roomId).eq("user_id", user_id);
  if (error) throw error;
}

export async function setReady(roomId: string, isReady: boolean): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_multiplayer_room_players").update({ is_ready: isReady }).eq("room_id", roomId).eq("user_id", user_id);
  if (error) throw error;
}

export async function updateMyRoomScore(roomId: string, score: number): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_multiplayer_room_players").update({ score }).eq("room_id", roomId).eq("user_id", user_id);
  if (error) throw error;
}

export async function setRoomStatus(roomId: string, status: MultiplayerRoom["status"]): Promise<void> {
  const { error } = await kidsDb.from("kids_multiplayer_rooms").update({ status }).eq("id", roomId);
  if (error) throw error;
}

export async function fetchRoomPlayers(roomId: string): Promise<MultiplayerRoomPlayer[]> {
  const { data, error } = await kidsDb.from("kids_multiplayer_room_players").select("*").eq("room_id", roomId).returns<MultiplayerRoomPlayer[]>();
  if (error) throw error;
  return data ?? [];
}
