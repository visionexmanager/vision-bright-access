import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as aiStories from "@/features/visionkids/services/stories/aiStories";
import type { GenerateAiStoryInput } from "@/features/visionkids/services/stories/aiStories";

export function useGenerateAiStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateAiStoryInput) => aiStories.generateAiStory(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids", "ai-stories"] }),
  });
}

export function useMyAiStories() {
  return useQuery({ queryKey: ["kids", "ai-stories"], queryFn: aiStories.fetchMyAiStories });
}

export function useAiStoryById(id: string | undefined) {
  return useQuery({
    queryKey: ["kids", "ai-story", id],
    queryFn: () => aiStories.fetchAiStoryById(id!),
    enabled: !!id,
  });
}

export function useDeleteAiStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiStories.deleteAiStory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids", "ai-stories"] }),
  });
}
