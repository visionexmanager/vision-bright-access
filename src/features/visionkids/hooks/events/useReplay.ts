import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as replay from "@/features/visionkids/services/events/replay";

export function useReplays(searchQuery?: string) {
  return useQuery({ queryKey: ["kids-events", "replays", searchQuery ?? ""], queryFn: () => replay.fetchReplays(searchQuery) });
}

export function useReplayByEventId(eventId: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "replay-by-event", eventId], queryFn: () => replay.fetchReplayByEventId(eventId!), enabled: !!eventId });
}

export function useMyReplayProgress(replayId: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "replay-progress", replayId], queryFn: () => replay.fetchMyReplayProgress(replayId!), enabled: !!replayId });
}

export function useSaveReplayProgress(replayId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (positionSeconds: number) => replay.saveReplayProgress(replayId!, positionSeconds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "replay-progress", replayId] }),
  });
}

export function useMyContinueWatching(limit = 6) {
  return useQuery({ queryKey: ["kids-events", "continue-watching", limit], queryFn: () => replay.fetchMyContinueWatching(limit) });
}

export function useIncrementReplayView() {
  return useMutation({ mutationFn: (replayId: string) => replay.incrementReplayViewCount(replayId) });
}
