import { useQuery } from "@tanstack/react-query";
import * as catalog from "@/features/visionkids/services/talent/catalog";

export function useTalentDomains() {
  return useQuery({ queryKey: ["kids-talent", "domains"], queryFn: catalog.fetchDomains });
}

export function useTalentTracks() {
  return useQuery({ queryKey: ["kids-talent", "tracks"], queryFn: catalog.fetchTracks });
}

export function useTalentTrack(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-talent", "track", slug],
    queryFn: () => catalog.fetchTrack(slug!),
    enabled: !!slug,
  });
}

export function useTrackModules(trackSlug: string | undefined) {
  return useQuery({
    queryKey: ["kids-talent", "modules", trackSlug],
    queryFn: () => catalog.fetchTrackModules(trackSlug!),
    enabled: !!trackSlug,
  });
}

export function useTrackModule(trackSlug: string | undefined, moduleSlug: string | undefined) {
  return useQuery({
    queryKey: ["kids-talent", "module", trackSlug, moduleSlug],
    queryFn: () => catalog.fetchModule(trackSlug!, moduleSlug!),
    enabled: !!trackSlug && !!moduleSlug,
  });
}

export function useFutureSkills() {
  return useQuery({ queryKey: ["kids-talent", "future-skills"], queryFn: catalog.fetchFutureSkills });
}

export function useFutureSkill(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-talent", "future-skill", slug],
    queryFn: () => catalog.fetchFutureSkill(slug!),
    enabled: !!slug,
  });
}

export function useCareers() {
  return useQuery({ queryKey: ["kids-talent", "careers"], queryFn: catalog.fetchCareers });
}

export function useCareer(slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-talent", "career", slug],
    queryFn: () => catalog.fetchCareer(slug!),
    enabled: !!slug,
  });
}

export function useMentors() {
  return useQuery({ queryKey: ["kids-talent", "mentors"], queryFn: catalog.fetchMentors });
}
