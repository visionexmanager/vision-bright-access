import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as mentors from "@/features/visionkids/services/talent/mentors";

export function useMyMentorRequests() {
  return useQuery({ queryKey: ["kids-talent", "mentor-requests"], queryFn: mentors.fetchMyMentorRequests });
}

export function useRequestMentor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mentorSlug, topic }: { mentorSlug: string; topic?: string }) =>
      mentors.requestMentor(mentorSlug, topic),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-talent", "mentor-requests"] }),
  });
}

export function useCancelMentorRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mentors.cancelMentorRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-talent", "mentor-requests"] }),
  });
}
