import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  GameSession, GameType, MPPlayer, generateRoomCode,
} from "@/systems/multiplayerSystem";
import { toast } from "sonner";

export function useMultiplayer(gameType: GameType) {
  const { user } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const myPlayer   = session?.players.find((p) => p.id === user?.id);
  const opponents  = session?.players.filter((p) => p.id !== user?.id) ?? [];
  const isHost     = session?.host_id === user?.id;
  const isMyTurn   = session?.current_player_id === user?.id;
  const status     = session?.status ?? "idle";
  const roomCode   = session?.id ?? null;

  // ── Subscribe to DB changes ───────────────────────────────────────────────
  useEffect(() => {
    if (!session?.id) return;
    const ch = supabase
      .channel(`gs:${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setSession(null);
            toast.info("The room was closed.");
          } else {
            setSession(payload.new as GameSession);
          }
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [session?.id]);

  // ── Build my MPPlayer entry ───────────────────────────────────────────────
  const meEntry = useCallback((): MPPlayer => ({
    id:     user!.id,
    name:   user!.user_metadata?.full_name || user!.email?.split("@")[0] || "Player",
    avatar: user!.user_metadata?.avatar_url,
    score:  0,
    ready:  false,
  }), [user]);

  // ── Create room ───────────────────────────────────────────────────────────
  const createRoom = useCallback(async (): Promise<string | null> => {
    if (!user) { toast.error("Login required"); return null; }
    setLoading(true);
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from("game_sessions")
      .insert({
        id: code,
        game_type: gameType,
        host_id: user.id,
        status: "waiting",
        max_players: 2,
        players: [meEntry()],
      })
      .select()
      .single();
    setLoading(false);
    if (error) { toast.error("Failed to create room"); return null; }
    setSession(data as unknown as GameSession);
    return code;
  }, [user, gameType, meEntry]);

  // ── Join room ─────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async (code: string): Promise<boolean> => {
    if (!user) { toast.error("Login required"); return false; }
    setLoading(true);
    const { data: existing, error: fe } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", code.toUpperCase().trim())
      .single();
    if (fe || !existing) { toast.error("Room not found"); setLoading(false); return false; }
    const s = existing as unknown as GameSession;
    if (s.status !== "waiting") { toast.error("Game already started"); setLoading(false); return false; }
    if (s.players.length >= s.max_players) { toast.error("Room is full"); setLoading(false); return false; }
    if (s.players.find((p) => p.id === user.id)) { setSession(s); setLoading(false); return true; }
    const { data, error } = await supabase
      .from("game_sessions")
      .update({ players: [...s.players, meEntry()] })
      .eq("id", s.id)
      .select()
      .single();
    setLoading(false);
    if (error) { toast.error("Failed to join room"); return false; }
    setSession(data as unknown as GameSession);
    return true;
  }, [user, meEntry]);

  // ── Start game (host only) ────────────────────────────────────────────────
  const startGame = useCallback(async (initialState: Record<string, unknown>) => {
    if (!session || !isHost) return;
    await supabase.from("game_sessions").update({
      status: "playing",
      game_state: initialState,
      current_player_id: session.host_id,
    }).eq("id", session.id);
  }, [session, isHost]);

  // ── Make a move (turn-based) ──────────────────────────────────────────────
  const makeMove = useCallback(async (
    newState: Record<string, unknown>,
    nextPlayerId: string,
  ) => {
    if (!session) return;
    await supabase.from("game_sessions").update({
      game_state: newState,
      current_player_id: nextPlayerId,
    }).eq("id", session.id);
  }, [session]);

  // ── Update my score (competitive) ────────────────────────────────────────
  const updateMyScore = useCallback(async (score: number, finished = false) => {
    if (!session || !user) return;
    const updatedPlayers = session.players.map((p) =>
      p.id === user.id ? { ...p, score } : p,
    );
    const newState = {
      ...(session.game_state ?? {}),
      [`fin_${user.id}`]: finished,
    };
    await supabase.from("game_sessions").update({
      players: updatedPlayers,
      game_state: newState,
    }).eq("id", session.id);
  }, [session, user]);

  // ── End game ──────────────────────────────────────────────────────────────
  const endGame = useCallback(async (winnerId?: string) => {
    if (!session) return;
    await supabase.from("game_sessions").update({
      status: "finished",
      winner_id: winnerId ?? null,
      current_player_id: null,
    }).eq("id", session.id);
  }, [session]);

  // ── Leave / close room ────────────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    if (!session || !user) return;
    if (isHost) {
      await supabase.from("game_sessions").delete().eq("id", session.id);
    } else {
      const rest = session.players.filter((p) => p.id !== user.id);
      await supabase.from("game_sessions").update({ players: rest }).eq("id", session.id);
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    setSession(null);
  }, [session, user, isHost]);

  return {
    session, loading, myPlayer, opponents,
    isHost, isMyTurn, status, roomCode,
    createRoom, joinRoom, startGame,
    makeMove, updateMyScore, endGame, leaveRoom,
  };
}
