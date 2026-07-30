import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as engagement from "@/features/visionkids/services/stem/engagement";

export function useExperimentProgress() {
  return useQuery({ queryKey: ["kids-stem", "experiment-progress"], queryFn: engagement.fetchExperimentProgress });
}

export function useCompleteExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ experimentId, quizScore }: { experimentId: string; quizScore?: number }) =>
      engagement.completeExperiment(experimentId, quizScore ?? 0),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-stem", "experiment-progress"] });
      qc.invalidateQueries({ queryKey: ["kids-stem", "stats"] });
    },
  });
}

export function useStemStats() {
  return useQuery({ queryKey: ["kids-stem", "stats"], queryFn: engagement.fetchStemStats });
}

export function useReadArticleIds() {
  return useQuery({ queryKey: ["kids-stem", "research-reads"], queryFn: engagement.fetchReadArticleIds });
}

export function useMarkResearchRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) => engagement.markResearchRead(articleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-stem", "research-reads"] });
      qc.invalidateQueries({ queryKey: ["kids-stem", "stats"] });
    },
  });
}

export function useStemSettings() {
  return useQuery({ queryKey: ["kids-stem", "settings"], queryFn: engagement.fetchStemSettings });
}

export function useUpsertStemSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: engagement.upsertStemSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-stem", "settings"] }),
  });
}
