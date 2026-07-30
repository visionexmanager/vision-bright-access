import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as rewards from "@/features/visionkids/services/events/rewards";
import type { MedalType } from "@/features/visionkids/types/events.types";

export function useEventMedals(eventId: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "medals", eventId], queryFn: () => rewards.fetchEventMedals(eventId!), enabled: !!eventId });
}

export function useMyMedals() {
  return useQuery({ queryKey: ["kids-events", "my-medals"], queryFn: rewards.fetchMyMedals });
}

export function useAwardMedal(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, medalType }: { userId: string; medalType: MedalType }) => rewards.awardMedal(eventId!, userId, medalType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "medals", eventId] }),
  });
}

export function useSubmissions(eventId: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "submissions", eventId], queryFn: () => rewards.fetchSubmissions(eventId!), enabled: !!eventId });
}

export function useMySubmission(eventId: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "my-submission", eventId], queryFn: () => rewards.fetchMySubmission(eventId!), enabled: !!eventId });
}

export function useSubmitEntry(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, fileUrl }: { content?: string; fileUrl?: string }) => rewards.submitEntry(eventId!, content, fileUrl),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-events", "submissions", eventId] });
      qc.invalidateQueries({ queryKey: ["kids-events", "my-submission", eventId] });
    },
  });
}

export function useLimitedRewards() {
  return useQuery({ queryKey: ["kids-events", "limited-rewards"], queryFn: rewards.fetchLimitedRewards });
}

export function useMyClaimedRewardIds() {
  return useQuery({ queryKey: ["kids-events", "claimed-rewards"], queryFn: rewards.fetchMyClaimedRewardIds });
}

export function useClaimLimitedReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: string) => rewards.claimLimitedReward(rewardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-events", "limited-rewards"] });
      qc.invalidateQueries({ queryKey: ["kids-events", "claimed-rewards"] });
    },
  });
}
