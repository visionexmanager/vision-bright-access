import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as skills from "@/features/visionkids/services/talent/skills";

export function useSkills() {
  return useQuery({ queryKey: ["kids-talent", "skills"], queryFn: skills.fetchSkills });
}

export function useMySkillProgress() {
  return useQuery({ queryKey: ["kids-talent", "skill-progress"], queryFn: skills.fetchMySkillProgress });
}

export function useCompleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (skillSlug: string) => skills.completeSkill(skillSlug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-talent", "skill-progress"] });
      qc.invalidateQueries({ queryKey: ["kids-talent", "stats"] });
    },
  });
}
