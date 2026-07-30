import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMyAnalytics } from "@/features/visionkids/services/academy/analytics";
import { fetchLearningRecommendations } from "@/features/visionkids/services/academy/recommendations";
import * as downloadsService from "@/features/visionkids/services/academy/downloads";

export function useMyAnalytics(userId?: string) {
  return useQuery({ queryKey: ["kids-academy", "analytics", userId ?? "me"], queryFn: () => fetchMyAnalytics(userId) });
}

export function useLearningRecommendations(limit = 5) {
  return useQuery({ queryKey: ["kids-academy", "recommendations", limit], queryFn: () => fetchLearningRecommendations(limit) });
}

export function useMyAcademyDownloads() {
  return useQuery({ queryKey: ["kids-academy", "downloads"], queryFn: downloadsService.fetchMyAcademyDownloads });
}

export function useLogAcademyDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: downloadsService.logAcademyDownload,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "downloads"] }),
  });
}
