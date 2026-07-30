import { useQuery } from "@tanstack/react-query";
import * as catalog from "@/features/visionkids/services/stem/catalog";

export function useStemLabs() {
  return useQuery({ queryKey: ["kids-stem", "labs"], queryFn: catalog.fetchLabs });
}

export function useStemLab(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-stem", "lab", slug],
    queryFn: () => catalog.fetchLab(slug!),
    enabled: !!slug,
  });
}

export function useExperiments(lab: string, topic?: string) {
  return useQuery({
    queryKey: ["kids-stem", "experiments", lab, topic ?? "all"],
    queryFn: () => catalog.fetchExperiments(lab, topic),
  });
}

export function useExperiment(lab: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-stem", "experiment", lab, slug],
    queryFn: () => catalog.fetchExperiment(lab!, slug!),
    enabled: !!lab && !!slug,
  });
}

export function useInnovationChallenges() {
  return useQuery({ queryKey: ["kids-stem", "challenges"], queryFn: catalog.fetchInnovationChallenges });
}

export function useInnovationChallenge(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-stem", "challenge", slug],
    queryFn: () => catalog.fetchInnovationChallenge(slug!),
    enabled: !!slug,
  });
}

export function useResearchArticles(category?: string) {
  return useQuery({
    queryKey: ["kids-stem", "research", category ?? "all"],
    queryFn: () => catalog.fetchResearchArticles(category),
  });
}

export function useResearchArticle(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-stem", "research-article", slug],
    queryFn: () => catalog.fetchResearchArticle(slug!),
    enabled: !!slug,
  });
}
