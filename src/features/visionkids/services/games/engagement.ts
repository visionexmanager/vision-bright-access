import { kidsDb, jsonPayload } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  GameSession, GameFavorite, PlayerGameStats, LeaderboardEntry, GameRating,
} from "@/features/visionkids/types/games.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

// ── Sessions (a completed session IS the score entry) ──────────────────────
export async function startGameSession(gameId: string): Promise<GameSession> {
  const user_id = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_game_sessions")
    .insert({ user_id, game_id: gameId })
    .select("*").single().returns<GameSession>();
  if (error) throw error;
  return data;
}

export interface EndSessionInput {
  sessionId: string;
  score: number;
  livesUsed?: number;
  hintsUsed?: number;
  durationSeconds: number;
  won: boolean;
  metadata?: Record<string, unknown>;
}

export async function endGameSession(input: EndSessionInput): Promise<void> {
  const { error } = await kidsDb
    .from("kids_game_sessions")
    .update({
      ended_at: new Date().toISOString(),
      score: input.score,
      lives_used: input.livesUsed ?? 0,
      hints_used: input.hintsUsed ?? 0,
      duration_seconds: input.durationSeconds,
      won: input.won,
      completed: true,
      metadata: jsonPayload(input.metadata ?? {}),
    })
    .eq("id", input.sessionId);
  if (error) throw error;
}

export async function fetchRecentlyPlayed(limit = 12): Promise<GameSession[]> {
  const { data, error } = await kidsDb
    .from("kids_game_sessions")
    .select("*, game:kids_games(*)")
    .eq("completed", true)
    .order("started_at", { ascending: false })
    .limit(limit * 3) // over-fetch, then dedupe by game client-side
    .returns<GameSession[]>();
  if (error) throw error;
  const seen = new Set<string>();
  const deduped: GameSession[] = [];
  for (const session of data ?? []) {
    if (seen.has(session.game_id)) continue;
    seen.add(session.game_id);
    deduped.push(session);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

// ── Favorites ────────────────────────────────────────────────────────────
export async function fetchGameFavorites(): Promise<GameFavorite[]> {
  const { data, error } = await kidsDb
    .from("kids_game_favorites").select("*, game:kids_games(*)").order("created_at", { ascending: false })
    .returns<GameFavorite[]>();
  if (error) throw error;
  return data ?? [];
}

export async function isGameFavorite(gameId: string): Promise<boolean> {
  const { data, error } = await kidsDb.from("kids_game_favorites").select("id").eq("game_id", gameId).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleGameFavorite(gameId: string, next: boolean): Promise<void> {
  const user_id = await requireUserId();
  if (next) {
    const { error } = await kidsDb.from("kids_game_favorites").insert({ user_id, game_id: gameId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await kidsDb.from("kids_game_favorites").delete().eq("user_id", user_id).eq("game_id", gameId);
    if (error) throw error;
  }
}

// ── Ratings ──────────────────────────────────────────────────────────────
export async function fetchMyGameRating(gameId: string): Promise<GameRating | null> {
  const { data, error } = await kidsDb
    .from("kids_game_ratings").select("*").eq("game_id", gameId).maybeSingle().returns<GameRating>();
  if (error) throw error;
  return data ?? null;
}

export async function rateGame(gameId: string, rating: number): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb
    .from("kids_game_ratings").upsert({ user_id, game_id: gameId, rating }, { onConflict: "user_id,game_id" });
  if (error) throw error;
}

// ── Player stats / profile ──────────────────────────────────────────────
export async function fetchPlayerGameStats(userId?: string): Promise<PlayerGameStats | null> {
  let targetId = userId;
  if (!targetId) {
    const { data } = await kidsDb.auth.getUser();
    targetId = data.user?.id;
  }
  if (!targetId) return null;
  const { data, error } = await kidsDb
    .from("kids_player_game_stats").select("*").eq("user_id", targetId).maybeSingle().returns<PlayerGameStats>();
  if (error) throw error;
  return data ?? null;
}

export async function fetchBestScoresByGame(userId: string): Promise<{ game_id: string; best_score: number }[]> {
  const { data, error } = await kidsDb
    .from("kids_game_leaderboard_entries").select("game_id, best_score").eq("user_id", userId)
    .order("best_score", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyXpTotal(): Promise<number> {
  const user_id = await requireUserId().catch(() => null);
  if (!user_id) return 0;
  const { data, error } = await kidsDb.from("kids_xp_events").select("amount").eq("user_id", user_id);
  if (error) throw error;
  return (data ?? []).reduce((sum: number, row: { amount: number }) => sum + row.amount, 0);
}

export async function fetchLevelForXp(xp: number): Promise<number> {
  const { data, error } = await kidsDb.rpc("kids_level_for_xp", { _xp: xp });
  if (error) throw error;
  return data as number;
}

/** Credits public.user_points (the real VX wallet) AND kids_xp_events (drives level) — see award_kids_xp's own comment. */
export async function awardXp(amount: number, reason: string): Promise<void> {
  const { error } = await kidsDb.rpc("award_kids_xp", { _amount: amount, _reason: reason });
  if (error) throw error;
}

/** Credits public.user_points ONLY — does not raise level. See award_kids_coins' own comment. */
export async function awardCoins(amount: number, reason: string): Promise<void> {
  const { error } = await kidsDb.rpc("award_kids_coins", { _amount: amount, _reason: reason });
  if (error) throw error;
}

// ── Leaderboard ──────────────────────────────────────────────────────────
export type LeaderboardScope = "global" | "weekly" | "monthly" | "friends";

/** The accepted friendships this user is part of, as the other person's id
 *  plus the user's own — a friends board that excludes you is not a board you
 *  can place on. Returns null when signed out, which the caller reads as "no
 *  friends board to show" rather than "no friends". */
async function friendCircleIds(): Promise<string[] | null> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return null;

  const { data, error } = await kidsDb
    .from("kids_friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;

  const ids = new Set<string>([userId]);
  for (const row of data ?? []) {
    ids.add(row.requester_id === userId ? row.addressee_id : row.requester_id);
  }
  return [...ids];
}

export async function fetchLeaderboard(gameId: string | null, scope: LeaderboardScope = "global", limit = 50): Promise<LeaderboardEntry[]> {
  let query = kidsDb.from("kids_game_leaderboard_entries").select("user_id, game_id, best_score, last_played_at");
  if (gameId) query = query.eq("game_id", gameId);

  if (scope === "weekly" || scope === "monthly") {
    const since = new Date();
    since.setDate(since.getDate() - (scope === "weekly" ? 7 : 30));
    query = query.gte("last_played_at", since.toISOString());
  }

  if (scope === "friends") {
    const circle = await friendCircleIds();
    if (circle === null) return [];
    query = query.in("user_id", circle);
  }

  const { data, error } = await query.order("best_score", { ascending: false }).limit(limit);
  if (error) throw error;

  const entries = (data ?? []) as LeaderboardEntry[];
  if (entries.length === 0) return [];

  const userIds = [...new Set(entries.map((e) => e.user_id))];
  const { data: profiles } = await kidsDb.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
  const profileMap = new Map((profiles ?? []).map((p: { user_id: string; display_name: string; avatar_url: string }) => [p.user_id, p]));

  return entries.map((e) => ({
    ...e,
    display_name: profileMap.get(e.user_id)?.display_name,
    avatar_url: profileMap.get(e.user_id)?.avatar_url,
  }));
}
