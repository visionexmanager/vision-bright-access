// ─── Multiplayer System ──────────────────────────────────────────────────────
// Types and helpers shared by all online-multiplayer games.

export type GameType =
  | "farkle" | "card99" | "briscola" | "uno"
  | "dominoes" | "quiz" | "neonbreach" | "logiquest" | "hangman";

export interface MPPlayer {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  ready: boolean;
}

export interface GameSession {
  id: string;
  game_type: GameType;
  host_id: string | null;
  status: "waiting" | "playing" | "finished";
  max_players: number;
  players: MPPlayer[];
  game_state: Record<string, unknown> | null;
  current_player_id: string | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export const GAME_LABELS: Record<GameType, string> = {
  farkle:     "🎲 Farkle",
  card99:     "🃏 Card 99",
  briscola:   "🃏 Briscola",
  uno:        "🎴 Uno Ultra",
  dominoes:   "🁣 Dominoes",
  quiz:       "📝 Quiz",
  neonbreach: "💻 Neon Breach",
  logiquest:  "🧩 LogiQuest",
  hangman:    "🔤 Hangman",
};

/** Generates a 6-character uppercase room code (no ambiguous chars). */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Returns the "other" player from a two-player session. */
export function getOpponent(session: GameSession, myId: string): MPPlayer | undefined {
  return session.players.find((p) => p.id !== myId);
}

/** Seeded pseudo-random number — same seed → same sequence on all clients. */
export function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
