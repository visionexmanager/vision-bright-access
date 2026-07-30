import { useQuery } from "@tanstack/react-query";
import * as catalog from "@/features/visionkids/services/wellness/catalog";
import type { HabitKind, WellnessCategory } from "@/features/visionkids/types/wellness.types";

export function useHabits(kind?: HabitKind) {
  return useQuery({ queryKey: ["kids-wellness", "habits", kind ?? "all"], queryFn: () => catalog.fetchHabits(kind) });
}

export function useLessons(category: WellnessCategory, topic?: string) {
  return useQuery({
    queryKey: ["kids-wellness", "lessons", category, topic ?? "all"],
    queryFn: () => catalog.fetchLessons(category, topic),
  });
}

export function useLesson(category: WellnessCategory, slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-wellness", "lesson", category, slug],
    queryFn: () => catalog.fetchLesson(category, slug!),
    enabled: !!slug,
  });
}

export function useHealthyChallenges() {
  return useQuery({ queryKey: ["kids-wellness", "challenges"], queryFn: catalog.fetchChallenges });
}

export function useEmergencyNumbers() {
  return useQuery({ queryKey: ["kids-wellness", "emergency-numbers"], queryFn: catalog.fetchEmergencyNumbers });
}
