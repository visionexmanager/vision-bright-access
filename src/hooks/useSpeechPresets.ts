import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as speechService from "@/services/ai-media-studio/speechService";
import type { CreatePresetInput, UpdatePresetInput } from "@/lib/types/speech-studio";

const KEY = ["ams", "speech-presets"] as const;

export function useSpeechPresets() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: speechService.listPresets,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreatePresetInput) => speechService.createPreset(input),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(`Preset "${p.name}" saved`);
    },
    onError: () => toast.error("Failed to save preset"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePresetInput }) =>
      speechService.updatePreset(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: () => toast.error("Failed to update preset"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => speechService.deletePreset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Preset deleted");
    },
    onError: () => toast.error("Failed to delete preset"),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => speechService.duplicatePreset(id),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(`Duplicated as "${p.name}"`);
    },
    onError: () => toast.error("Failed to duplicate preset"),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      speechService.updatePreset(id, { is_favorite: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return {
    presets:          query.data ?? [],
    isLoading:        query.isLoading,
    createPreset:     createMutation.mutate,
    updatePreset:     updateMutation.mutate,
    deletePreset:     deleteMutation.mutate,
    duplicatePreset:  duplicateMutation.mutate,
    toggleFavorite:   toggleFavoriteMutation.mutate,
    isCreating:       createMutation.isPending,
  };
}
