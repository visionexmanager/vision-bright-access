import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as progress from "@/features/visionkids/services/talent/progress";

export function useMyModuleProgress(trackSlug?: string) {
  return useQuery({
    queryKey: ["kids-talent", "module-progress", trackSlug ?? "all"],
    queryFn: () => progress.fetchMyModuleProgress(trackSlug),
  });
}

export function useTalentStats() {
  return useQuery({ queryKey: ["kids-talent", "stats"], queryFn: progress.fetchTalentStats });
}

export function useCompleteModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) => progress.completeModule(moduleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-talent", "module-progress"] });
      qc.invalidateQueries({ queryKey: ["kids-talent", "stats"] });
    },
  });
}
