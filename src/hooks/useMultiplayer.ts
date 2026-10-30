import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  GameSession, GameType, MPPlayer, generateRoomCode,
} from "@/systems/multiplayerSystem";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { P2PLink, p2pSupported, type P2PMessage, type P2PSignal } from "@/systems/p2pLink";

/**
 * Moves go straight to the other player's device when a peer-to-peer link is
 * open, and to the game_sessions row when it is not. The row is also a
 * checkpoint, written every few moves, so a refresh or a dropped link can
 * continue from where the game was.
 */
const CHECKPOINT_EVERY = 6;

export function useMultiplayer(gameType: GameType) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const linkRef = useRef<P2PLink | null>(null);
  const seqRef = useRef(0);
  const sinceCheckpointRef = useRef(0);
  const handledSignalRef = useRef(0);

  /** Every change to the session goes through here so the refs never lag behind. */
  const commit = useCallback((next: GameSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

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
            commit(null);
            toast.info(t("mp.roomClosed"));
          } else {
            const incoming = payload.new as GameSession;
            const local = sessionRef.current;
            // A row older than what the players already did over the link
            // (a checkpoint arriving late) must not rewind the game.
            const behind = local && incoming.status === "playing" && (incoming.p2p_seq ?? 0) < seqRef.current;
            commit(behind
              ? {
                  ...incoming,
                  game_state: local.game_state,
                  current_player_id: local.current_player_id,
                  p2p_seq: seqRef.current,
                  players: incoming.players.map((p) => local.players.find((q) => q.id === p.id) ?? p),
                }
              : incoming);
          }
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [session?.id, t, commit]);

  // ── Peer-to-peer link ─────────────────────────────────────────────────────
  const handleP2P = useCallback((message: P2PMessage) => {
    const cur = sessionRef.current;
    if (!cur || !user) return;
    if (message.t === "move") {
      if (message.seq <= seqRef.current) return;
      if (message.next !== null && !cur.players.some((p) => p.id === message.next)) return;
      seqRef.current = message.seq;
      commit({ ...cur, game_state: message.state, current_player_id: message.next, p2p_seq: message.seq });
    } else if (message.id !== user.id && cur.players.some((p) => p.id === message.id)) {
      commit({
        ...cur,
        players: cur.players.map((p) => (p.id === message.id ? { ...p, score: message.score } : p)),
        game_state: { ...(cur.game_state ?? {}), [`fin_${message.id}`]: message.fin },
      });
    }
  }, [user, commit]);

  /** Writes the game as the players have it now, so the row can catch up. */
  const checkpoint = useCallback(async () => {
    const cur = sessionRef.current;
    if (!cur) return;
    sinceCheckpointRef.current = 0;
    await supabase.from("game_sessions").update({
      game_state: cur.game_state as unknown as Json,
      current_player_id: cur.current_player_id,
      players: cur.players as unknown as Json,
      p2p_seq: seqRef.current,
    }).eq("id", cur.id);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    // The link dropped: whatever it carried since the last checkpoint goes to the row.
    if (!open && sinceCheckpointRef.current > 0) void checkpoint();
  }, [checkpoint]);

  const sid = session?.id;
  const hostId = session?.host_id;
  const linkWanted = Boolean(sid && user && (session?.players.length ?? 0) >= 2 && session?.status !== "finished");

  useEffect(() => {
    handledSignalRef.current = 0;
    seqRef.current = 0;
    sinceCheckpointRef.current = 0;
  }, [sid]);

  useEffect(() => {
    if (!linkWanted || !sid || !user || !p2pSupported()) return;
    const link = new P2PLink({
      role: hostId === user.id ? "offer" : "answer",
      myId: user.id,
      publishSignal: async (signal: P2PSignal) => {
        await supabase.from("game_sessions").update({ rtc_signal: signal as unknown as Json }).eq("id", sid);
      },
      onMessage: handleP2P,
      onOpenChange: handleOpenChange,
    });
    linkRef.current = link;
    if (hostId === user.id) void link.start().catch(() => link.close());
    return () => {
      link.close();
      if (linkRef.current === link) linkRef.current = null;
    };
  }, [linkWanted, sid, hostId, user, handleP2P, handleOpenChange]);

  // The other side's handshake arrives as an update to the row.
  const signal = session?.rtc_signal;
  useEffect(() => {
    const link = linkRef.current;
    if (!signal || !link || signal.ts <= handledSignalRef.current) return;
    handledSignalRef.current = signal.ts;
    void link.handleSignal(signal).catch(() => link.close());
  }, [signal]);

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
    if (!user) { toast.error(t("mp.loginRequiredShort")); return null; }
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
        players: [meEntry()] as unknown as Json,
      })
      .select()
      .single();
    setLoading(false);
    if (error) { toast.error(t("mp.createRoomFailed")); return null; }
    commit(data as unknown as GameSession);
    return code;
  }, [user, gameType, meEntry, t, commit]);

  // ── Join room ─────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async (code: string): Promise<boolean> => {
    if (!user) { toast.error(t("mp.loginRequiredShort")); return false; }
    setLoading(true);
    const { data: existing, error: fe } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", code.toUpperCase().trim())
      .single();
    if (fe || !existing) { toast.error(t("mp.roomNotFound")); setLoading(false); return false; }
    const s = existing as unknown as GameSession;
    if (s.status !== "waiting") { toast.error(t("mp.gameAlreadyStarted")); setLoading(false); return false; }
    if (s.players.length >= s.max_players) { toast.error(t("mp.roomFull")); setLoading(false); return false; }
    if (s.players.find((p) => p.id === user.id)) { commit(s); setLoading(false); return true; }
    const { data, error } = await supabase
      .from("game_sessions")
      .update({ players: [...s.players, meEntry()] as unknown as Json })
      .eq("id", s.id)
      .select()
      .single();
    setLoading(false);
    if (error) { toast.error(t("mp.joinRoomFailed")); return false; }
    commit(data as unknown as GameSession);
    return true;
  }, [user, meEntry, t, commit]);

  // ── Start game (host only) ────────────────────────────────────────────────
  const startGame = useCallback(async (initialState: Record<string, unknown>) => {
    if (!session || !isHost) return;
    await supabase.from("game_sessions").update({
      status: "playing",
      game_state: initialState as unknown as Json,
      current_player_id: session.host_id,
    }).eq("id", session.id);
  }, [session, isHost]);

  // ── Make a move (turn-based) ──────────────────────────────────────────────
  const makeMove = useCallback(async (
    newState: Record<string, unknown>,
    nextPlayerId: string,
  ) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const seq = seqRef.current + 1;
    const sent = linkRef.current?.send({ t: "move", seq, state: newState, next: nextPlayerId }) ?? false;
    seqRef.current = seq;
    if (sent) {
      commit({ ...cur, game_state: newState, current_player_id: nextPlayerId, p2p_seq: seq });
      sinceCheckpointRef.current++;
      if (sinceCheckpointRef.current >= CHECKPOINT_EVERY) await checkpoint();
      return;
    }
    sinceCheckpointRef.current = 0;
    await supabase.from("game_sessions").update({
      game_state: newState as unknown as Json,
      current_player_id: nextPlayerId,
      p2p_seq: seq,
    }).eq("id", cur.id);
  }, [commit, checkpoint]);

  // ── Update my score (competitive) ────────────────────────────────────────
  const updateMyScore = useCallback(async (score: number, finished = false) => {
    const cur = sessionRef.current;
    if (!cur || !user) return;
    const updatedPlayers = cur.players.map((p) =>
      p.id === user.id ? { ...p, score } : p,
    );
    const newState = {
      ...(cur.game_state ?? {}),
      [`fin_${user.id}`]: finished,
    };
    // Running scores stay between the players; the final one goes to the row.
    if (!finished && linkRef.current?.send({ t: "score", id: user.id, score, fin: false })) {
      commit({ ...cur, players: updatedPlayers, game_state: newState });
      return;
    }
    await supabase.from("game_sessions").update({
      players: updatedPlayers as unknown as Json,
      game_state: newState as unknown as Json,
    }).eq("id", cur.id);
  }, [user, commit]);

  // ── End game ──────────────────────────────────────────────────────────────
  const endGame = useCallback(async (winnerId?: string) => {
    const cur = sessionRef.current;
    if (!cur) return;
    await supabase.from("game_sessions").update({
      status: "finished",
      winner_id: winnerId ?? null,
      current_player_id: null,
      // What the players saw last, if it only ever travelled over the link.
      ...(seqRef.current > 0
        ? { game_state: cur.game_state as unknown as Json, players: cur.players as unknown as Json, p2p_seq: seqRef.current }
        : {}),
    }).eq("id", cur.id);
  }, []);

  // ── Leave / close room ────────────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    if (!session || !user) return;
    if (isHost) {
      await supabase.from("game_sessions").delete().eq("id", session.id);
    } else {
      const rest = session.players.filter((p) => p.id !== user.id);
      await supabase.from("game_sessions").update({ players: rest as unknown as Json }).eq("id", session.id);
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    linkRef.current?.close();
    commit(null);
  }, [session, user, isHost, commit]);

  return {
    session, loading, myPlayer, opponents,
    isHost, isMyTurn, status, roomCode,
    createRoom, joinRoom, startGame,
    makeMove, updateMyScore, endGame, leaveRoom,
  };
}
