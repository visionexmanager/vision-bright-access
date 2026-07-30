import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as challenges from "@/features/visionkids/services/games/challenges";

export function useDailyChallenges() {
  return useQuery({ queryKey: ["kids-games", "daily-challenges"], queryFn: challenges.fetchDailyChallenges });
}

export function useWeeklyChallenges() {
  return useQuery({ queryKey: ["kids-games", "weekly-challenges"], queryFn: challenges.fetchWeeklyChallenges });
}

export function useBumpDailyChallengeProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, targetValue, incrementBy }: { challengeId: string; targetValue: number; incrementBy?: number }) =>
      challenges.bumpDailyChallengeProgress(challengeId, targetValue, incrementBy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-games", "daily-challenges"] }),
  });
}

export function useBumpWeeklyChallengeProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, targetValue, incrementBy }: { challengeId: string; targetValue: number; incrementBy?: number }) =>
      challenges.bumpWeeklyChallengeProgress(challengeId, targetValue, incrementBy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-games", "weekly-challenges"] }),
  });
}

export function useActiveSeasonEvents() {
  return useQuery({ queryKey: ["kids-games", "season-events"], queryFn: challenges.fetchActiveSeasonEvents });
}
