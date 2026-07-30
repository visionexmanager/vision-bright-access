import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as challenges from "@/features/visionkids/services/social/challenges";

export function useActiveSocialChallenges() {
  return useQuery({ queryKey: ["kids-social", "challenges"], queryFn: challenges.fetchActiveChallenges });
}

export function useChallengeLeaderboard(challengeId: string | undefined) {
  return useQuery({ queryKey: ["kids-social", "leaderboard", challengeId], queryFn: () => challenges.fetchLeaderboard(challengeId!), enabled: !!challengeId });
}

export function useMyChallengeParticipation(challengeId: string | undefined) {
  return useQuery({ queryKey: ["kids-social", "my-participation", challengeId], queryFn: () => challenges.fetchMyParticipation(challengeId!), enabled: !!challengeId });
}

export function useJoinSocialChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => challenges.joinChallenge(challengeId),
    onSuccess: (_d, challengeId) => {
      qc.invalidateQueries({ queryKey: ["kids-social", "leaderboard", challengeId] });
      qc.invalidateQueries({ queryKey: ["kids-social", "my-participation", challengeId] });
    },
  });
}

export function useBumpChallengeScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, increment }: { challengeId: string; increment: number }) => challenges.bumpScore(challengeId, increment),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kids-social", "leaderboard", vars.challengeId] });
      qc.invalidateQueries({ queryKey: ["kids-social", "my-participation", vars.challengeId] });
    },
  });
}
