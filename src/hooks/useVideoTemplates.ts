import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/services/ai-media-studio/videoStudioService";
import type { VideoTemplate } from "@/lib/types/video-studio";

const TEMPLATES_KEY = ["vx", "templates"] as const;

export function useVideoTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn:  listTemplates,
    staleTime: 60_000,
  });
}

export function useVideoTemplateMutations() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY });

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createTemplate>[0]) => createTemplate(input),
    onSuccess: () => {
      invalidate();
      toast({ title: "Template saved" });
    },
    onError: () => toast({ title: "Failed to save template", variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<VideoTemplate> }) =>
      updateTemplate(id, patch),
    onSuccess: invalidate,
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Template deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const toggleFavorite = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      updateTemplate(id, { is_favorite: value }),
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: TEMPLATES_KEY });
      qc.setQueryData<VideoTemplate[]>(TEMPLATES_KEY as unknown as string[], (old) =>
        old?.map((t) => (t.id === id ? { ...t, is_favorite: value } : t))
      );
    },
    onSettled: invalidate,
  });

  return { create, update, remove, toggleFavorite };
}
