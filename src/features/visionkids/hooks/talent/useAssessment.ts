import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as assessment from "@/features/visionkids/services/talent/assessment";
import type { AssessmentQuestion } from "@/features/visionkids/types/talent.types";

export function useAssessmentQuestions() {
  return useQuery({ queryKey: ["kids-talent", "assessment-questions"], queryFn: assessment.fetchAssessmentQuestions });
}

export function useMyTalentResult() {
  return useQuery({ queryKey: ["kids-talent", "my-result"], queryFn: assessment.fetchMyTalentResult });
}

export function useSubmitAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questions, answers }: { questions: AssessmentQuestion[]; answers: Record<string, string> }) =>
      assessment.submitAssessment(questions, answers),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-talent", "my-result"] });
      qc.invalidateQueries({ queryKey: ["kids-talent", "stats"] });
    },
  });
}
