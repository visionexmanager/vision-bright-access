import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as multiplayer from "@/features/visionkids/services/games/multiplayer";
import type { MultiplayerRoom, MultiplayerRoomPlayer } from "@/features/visionkids/types/games.types";

export function usePublicRooms() {
  return useQuery({ queryKey: ["kids-games", "public-rooms"], queryFn: multiplayer.fetchPublicRooms, refetchInterval: 8000 });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: multiplayer.createRoom,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-games", "public-rooms"] }),
  });
}

export function useJoinRoomByCode() {
  return useMutation({ mutationFn: (code: string) => multiplayer.fetchRoomByCode(code) });
}

/** Live room state — subscribes to Postgres changes on the room row and its
 *  players, same mechanism as the site's existing useMultiplayer hook
 *  (src/hooks/useMultiplayer.ts) for the adult games. */
export function useMultiplayerRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<MultiplayerRoom | null>(null);
  const [players, setPlayers] = useState<MultiplayerRoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    const [r, p] = await Promise.all([multiplayer.fetchRoomById(roomId), multiplayer.fetchRoomPlayers(roomId)]);
    setRoom(r);
    setPlayers(p);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`kids-mp-room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kids_multiplayer_rooms", filter: `id=eq.${roomId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "kids_multiplayer_room_players", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, refresh]);

  return { room, players, loading, refresh };
}

export function useJoinRoom() {
  return useMutation({ mutationFn: (roomId: string) => multiplayer.joinRoom(roomId) });
}

export function useLeaveRoom() {
  return useMutation({ mutationFn: (roomId: string) => multiplayer.leaveRoom(roomId) });
}

export function useSetReady() {
  return useMutation({ mutationFn: ({ roomId, isReady }: { roomId: string; isReady: boolean }) => multiplayer.setReady(roomId, isReady) });
}

export function useUpdateRoomScore() {
  return useMutation({ mutationFn: ({ roomId, score }: { roomId: string; score: number }) => multiplayer.updateMyRoomScore(roomId, score) });
}

export function useSetRoomStatus() {
  return useMutation({ mutationFn: ({ roomId, status }: { roomId: string; status: MultiplayerRoom["status"] }) => multiplayer.setRoomStatus(roomId, status) });
}

/** Ephemeral emoji reactions — broadcast-only (not persisted), same "Realtime
 *  broadcast, no table" pattern used for lightweight live signals elsewhere. */
export function useEmojiReactions(roomId: string | undefined) {
  const [reactions, setReactions] = useState<{ id: number; emoji: string; userId: string }[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`kids-mp-reactions:${roomId}`);
    channel
      .on("broadcast", { event: "emoji" }, ({ payload }) => {
        const entry = { id: Date.now() + Math.random(), emoji: payload.emoji as string, userId: payload.userId as string };
        setReactions((prev) => [...prev, entry]);
        window.setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== entry.id)), 2500);
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [roomId]);

  const sendReaction = useCallback(async (emoji: string, userId: string) => {
    await channelRef.current?.send({ type: "broadcast", event: "emoji", payload: { emoji, userId } });
  }, []);

  return { reactions, sendReaction };
}
