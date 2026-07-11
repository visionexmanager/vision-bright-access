/**
 * useLearningTracks — curated multi-course learning paths (Phase 1 backend).
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchLearningTracks, fetchLearningTrackById, fetchLearningTrackProgress } from "@/services/academy/lms";

export function useLearningTracks() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.academy.lms.tracks(),
    queryFn: fetchLearningTracks,
    staleTime: 5 * 60 * 1000,
  });
  return { tracks: data ?? [], isLoading };
}

export function useLearningTrack(trackId: string | undefined) {
  const { user } = useAuth();

  const trackQuery = useQuery({
    queryKey: queryKeys.academy.lms.track(trackId ?? ""),
    queryFn: () => fetchLearningTrackById(trackId!),
    enabled: !!trackId,
  });

  const progressQuery = useQuery({
    queryKey: queryKeys.academy.lms.trackProgress(user?.id ?? "", trackId ?? ""),
    queryFn: () => fetchLearningTrackProgress(user!.id, trackId!),
    enabled: !!user && !!trackId,
  });

  return {
    track: trackQuery.data ?? null,
    progress: progressQuery.data ?? null,
    isLoading: trackQuery.isLoading,
  };
}
