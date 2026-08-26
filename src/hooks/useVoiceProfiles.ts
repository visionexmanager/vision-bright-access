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

/**
   * Deleting means the provider's copy and the recordings, not just the row.
   *
   * The response is checked rather than assumed. It used to report success on
   * any resolved promise, which meant "Voice profile deleted" appeared whether
   * or not the clone still existed at ElevenLabs — and for a copy of somebody's
   * voice, a false confirmation is worse than an error.
   */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await callVoiceStudio({ action: "delete_profile", profile_id: id });
      if (!result?.ok) throw new Error(result?.error || "The voice could not be fully removed");
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      // Also invalidate voices in case a cloned voice was added to ams_voices
      qc.invalidateQueries({ queryKey: ["ams", "voices"] });
      toast.success("Voice deleted, at the provider and here");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Failed to delete profile"),
  });

  /**
   * Recording consent.
   *
   * A voice cannot be cloned without this, and the edge function refuses
   * regardless of what the interface allows — this is the interface being
   * honest about the requirement, not the requirement itself.
   */
  const grantConsentMutation = useMutation({
    mutationFn: ({ id, subject }: { id: string; subject: string }) =>
      vs.grantVoiceConsent(id, subject),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      toast.success("Consent recorded");
    },
    onError: () => toast.error("Could not record consent"),
  });

  /**
   * Withdrawing consent, which also destroys the voice.
   *
   * Somebody changing their mind should not then have to find a second button
   * to make the copy go away, so this revokes and deletes in one act.
   */
  const revokeConsentMutation = useMutation({
    mutationFn: (id: string) => vs.revokeVoiceConsent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      qc.invalidateQueries({ queryKey: ["ams", "voices"] });
      toast.success("Consent withdrawn, and the voice removed");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not withdraw consent"),
  });

  const whatsappMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      vs.setVoiceWhatsAppEnabled(id, enabled),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: VS_PROFILES_KEY });
      toast.success(variables.enabled ? "Available on WhatsApp" : "Removed from WhatsApp");
    },
    onError: () => toast.error("Could not change the WhatsApp setting"),
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
    grantConsent:    grantConsentMutation.mutate,
    revokeConsent:   revokeConsentMutation.mutate,
    setWhatsAppEnabled: whatsappMutation.mutate,
    isRevoking:      revokeConsentMutation.isPending,
    isCreating:      createMutation.isPending,
    isDeleting:      deleteMutation.isPending,
    invalidate:      () => qc.invalidateQueries({ queryKey: VS_PROFILES_KEY }),
  };
}
