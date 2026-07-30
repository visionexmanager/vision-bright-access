import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as challenges from "@/features/visionkids/services/studio/challenges";
import { useAwardXp, useAwardCoins, useAwardAchievement } from "@/features/visionkids/hooks/games/useGameEngagement";
import type { CreativeChallenge } from "@/features/visionkids/types/studio.types";

export function useThisWeeksChallenges() {
  return useQuery({ queryKey: ["kids-studio", "weekly-challenges"], queryFn: challenges.fetchThisWeeksChallenges });
}

export function useMyChallengeSubmissions() {
  return useQuery({ queryKey: ["kids-studio", "my-challenge-submissions"], queryFn: challenges.fetchMyChallengeSubmissions });
}

export function useSubmitToChallenge() {
  const qc = useQueryClient();
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();

  return useMutation({
    mutationFn: async ({ challenge, projectId }: { challenge: CreativeChallenge; projectId: string }) => {
      await challenges.submitToChallenge(challenge.id, projectId);
      await awardXp.mutateAsync({ amount: challenge.reward_xp, reason: `Creative challenge submitted: ${challenge.id}` }).catch(() => {});
      await awardCoins.mutateAsync({ amount: challenge.reward_coins, reason: `Creative challenge submitted: ${challenge.id}` }).catch(() => {});
      awardAchievement.mutate("creativity_badge");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-studio", "my-challenge-submissions"] }),
  });
}
