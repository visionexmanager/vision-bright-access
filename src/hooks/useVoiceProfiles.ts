import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as vs from "@/services/ai-media-studio/voiceStudioService";
import { callVoiceStudio } from "@/lib/api/edgeFunctions";
import type {
  VoiceProfileFilters,
  CreateVoiceProfileInput,
  UpdateVoiceProfileInput,
} from "@/lib/types/voice-studio";

export const VS_PROFILES_KEY = ["vs", "profiles"] as const;

export function useVoiceProfiles() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<VoiceProfileFilters>({});

  const query = useQuery({
    queryKey: [...VS_PROFILES_KEY, filters],
    queryFn: () => vs.listProfiles(filters),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateVoiceProfileInput) => vs.createProfile(input),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      toast.success(`Voice profile "${p.name}" created`);
    },
    onError: () => toast.error("Failed to create voice profile"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVoiceProfileInput }) =>
      vs.updateProfile(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: VS_PROFILES_KEY }),
    onError: () => toast.error("Failed to update profile"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => vs.archiveProfile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      toast.success("Voice profile archived");
    },
    onError: () => toast.error("Failed to archive profile"),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => vs.restoreProfile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      toast.success("Profile restored");
    },
    onError: () => toast.error("Failed to restore profile"),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => vs.duplicateProfile(id),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      toast.success(`Duplicated as "${p.name}"`);
    },
    onError: () => toast.error("Failed to duplicate profile"),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, current }: { id: string; current: boolean }) =>
      vs.toggleFavoriteProfile(id, current),
    onSuccess: () => qc.invalidateQueries({ queryKey: VS_PROFILES_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      callVoiceStudio({ action: "delete_profile", profile_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      // Also invalidate voices in case a cloned voice was added to ams_voices
      qc.invalidateQueries({ queryKey: ["ams", "voices"] });
      toast.success("Voice profile deleted");
    },
    onError: () => toast.error("Failed to delete profile"),
  });

  const updateFilters = useCallback((patch: Partial<VoiceProfileFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const resetFilters = useCallback(() => setFilters({}), []);

  return {
    profiles:        query.data ?? [],
    isLoading:       query.isLoading,
    isError:         query.isError,
    filters,
    updateFilters,
    resetFilters,
    createProfile:   createMutation.mutate,
    updateProfile:   updateMutation.mutate,
    archiveProfile:  archiveMutation.mutate,
    restoreProfile:  restoreMutation.mutate,
    duplicateProfile: duplicateMutation.mutate,
    toggleFavorite:  toggleFavoriteMutation.mutate,
    deleteProfile:   deleteMutation.mutate,
    isCreating:      createMutation.isPending,
    isDeleting:      deleteMutation.isPending,
    invalidate:      () => qc.invalidateQueries({ queryKey: VS_PROFILES_KEY }),
  };
}
