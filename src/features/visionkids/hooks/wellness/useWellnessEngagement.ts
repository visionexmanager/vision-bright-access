import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as engagement from "@/features/visionkids/services/wellness/engagement";

export function useWellnessStats() {
  return useQuery({ queryKey: ["kids-wellness", "stats"], queryFn: engagement.fetchWellnessStats });
}

export function useChallengeProgress() {
  return useQuery({ queryKey: ["kids-wellness", "challenge-progress"], queryFn: engagement.fetchChallengeProgress });
}

export function useCompleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => engagement.completeChallenge(challengeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-wellness", "challenge-progress"] });
      qc.invalidateQueries({ queryKey: ["kids-wellness", "stats"] });
    },
  });
}

export function useCompanion() {
  return useQuery({ queryKey: ["kids-wellness", "companion"], queryFn: engagement.fetchCompanion });
}

export function useUpsertCompanion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: engagement.CompanionInput) => engagement.upsertCompanion(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-wellness", "companion"] }),
  });
}

export function useWellnessSettings() {
  return useQuery({ queryKey: ["kids-wellness", "settings"], queryFn: engagement.fetchWellnessSettings });
}

export function useUpsertWellnessSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: engagement.upsertWellnessSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-wellness", "settings"] }),
  });
}
