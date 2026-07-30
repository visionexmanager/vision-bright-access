import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as engagement from "@/features/visionkids/services/games/engagement";
import type { EndSessionInput } from "@/features/visionkids/services/games/engagement";
import type { LeaderboardScope } from "@/features/visionkids/services/games/engagement";
import { awardAchievement as awardAchievementService } from "@/features/visionkids/services/stories/engagement";

export function useStartGameSession() {
  return useMutation({ mutationFn: (gameId: string) => engagement.startGameSession(gameId) });
}

export function useEndGameSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EndSessionInput) => engagement.endGameSession(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-games", "recently-played"] });
      qc.invalidateQueries({ queryKey: ["kids-games", "player-stats"] });
      qc.invalidateQueries({ queryKey: ["kids-games", "leaderboard"] });
      qc.invalidateQueries({ queryKey: ["kids-games", "xp-total"] });
    },
  });
}

export function useRecentlyPlayed(limit = 12) {
  return useQuery({ queryKey: ["kids-games", "recently-played", limit], queryFn: () => engagement.fetchRecentlyPlayed(limit) });
}

export function useGameFavorites() {
  return useQuery({ queryKey: ["kids-games", "favorites"], queryFn: engagement.fetchGameFavorites });
}

export function useIsGameFavorite(gameId: string | undefined) {
  return useQuery({ queryKey: ["kids-games", "is-favorite", gameId], queryFn: () => engagement.isGameFavorite(gameId!), enabled: !!gameId });
}

export function useToggleGameFavorite(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: boolean) => engagement.toggleGameFavorite(gameId, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-games", "favorites"] });
      qc.invalidateQueries({ queryKey: ["kids-games", "is-favorite", gameId] });
    },
  });
}

export function useMyGameRating(gameId: string | undefined) {
  return useQuery({ queryKey: ["kids-games", "my-rating", gameId], queryFn: () => engagement.fetchMyGameRating(gameId!), enabled: !!gameId });
}

export function useRateGame(gameId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rating: number) => engagement.rateGame(gameId, rating),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-games", "my-rating", gameId] }),
  });
}

export function usePlayerGameStats(userId?: string) {
  return useQuery({ queryKey: ["kids-games", "player-stats", userId ?? "me"], queryFn: () => engagement.fetchPlayerGameStats(userId) });
}

export function useBestScoresByGame(userId: string | undefined) {
  return useQuery({
    queryKey: ["kids-games", "best-scores", userId],
    queryFn: () => engagement.fetchBestScoresByGame(userId!),
    enabled: !!userId,
  });
}

export function useMyXpTotal() {
  return useQuery({ queryKey: ["kids-games", "xp-total"], queryFn: engagement.fetchMyXpTotal });
}

export function useLevelForXp(xp: number) {
  return useQuery({ queryKey: ["kids-games", "level-for-xp", xp], queryFn: () => engagement.fetchLevelForXp(xp), enabled: xp >= 0 });
}

export function useLeaderboard(gameId: string | null, scope: LeaderboardScope = "global", limit = 50) {
  return useQuery({
    queryKey: ["kids-games", "leaderboard", gameId, scope, limit],
    queryFn: () => engagement.fetchLeaderboard(gameId, scope, limit),
  });
}

export function useAwardXp() {
  return useMutation({ mutationFn: ({ amount, reason }: { amount: number; reason: string }) => engagement.awardXp(amount, reason) });
}

export function useAwardCoins() {
  return useMutation({ mutationFn: ({ amount, reason }: { amount: number; reason: string }) => engagement.awardCoins(amount, reason) });
}

export function useAwardAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => awardAchievementService(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids", "achievements"] }),
  });
}
