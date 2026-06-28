import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as speechService from "@/services/ai-media-studio/speechService";

const KEY = ["ams", "speech-history"] as const;

export function useSpeechHistory(limit = 20) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [...KEY, limit],
    queryFn: () => speechService.listHistory(limit),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => speechService.deleteJob(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Generation deleted");
    },
    onError: () => toast.error("Failed to delete generation"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => speechService.cancelJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return {
    history:      query.data ?? [],
    isLoading:    query.isLoading,
    deleteJob:    deleteMutation.mutate,
    cancelJob:    cancelMutation.mutate,
    invalidate:   () => qc.invalidateQueries({ queryKey: KEY }),
  };
}
