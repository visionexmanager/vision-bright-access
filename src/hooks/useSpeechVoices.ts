import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as speechService from "@/services/ai-media-studio/speechService";
import type { SpeechVoice, VoiceFilters, VoiceGender, VoiceCategory } from "@/lib/types/speech-studio";

const VOICES_KEY    = ["ams", "voices"] as const;
const FAVES_KEY     = ["ams", "voice-favorites"] as const;
const RECENT_KEY    = ["ams", "voice-recent"] as const;

export function useSpeechVoices() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<VoiceFilters>({});

  const voicesQuery  = useQuery({ queryKey: VOICES_KEY,  queryFn: speechService.listVoices });
  const favesQuery   = useQuery({ queryKey: FAVES_KEY,   queryFn: speechService.listFavoriteVoiceIds });
  const recentQuery  = useQuery({ queryKey: RECENT_KEY,  queryFn: speechService.listRecentVoices });

  const favoriteIds = useMemo(() => new Set(favesQuery.data ?? []), [favesQuery.data]);
  const recentMap   = useMemo(
    () => new Map((recentQuery.data ?? []).map((r) => [r.voice_id, r])),
    [recentQuery.data]
  );

  // Merge in favorite / recent flags
  const enrichedVoices: SpeechVoice[] = useMemo(
    () =>
      (voicesQuery.data ?? []).map((v) => ({
        ...v,
        is_favorite:      favoriteIds.has(v.id),
        is_recent:        recentMap.has(v.id),
        recent_use_count: recentMap.get(v.id)?.use_count,
      })),
    [voicesQuery.data, favoriteIds, recentMap]
  );

  // Apply filters
  const filteredVoices = useMemo(
    () => speechService.filterVoices(enrichedVoices, filters),
    [enrichedVoices, filters]
  );

  // Recently used — ordered by recency
  const recentVoices: SpeechVoice[] = useMemo(() => {
    const recentIds = (recentQuery.data ?? []).map((r) => r.voice_id);
    return recentIds
      .map((id) => enrichedVoices.find((v) => v.id === id))
      .filter(Boolean) as SpeechVoice[];
  }, [recentQuery.data, enrichedVoices]);

  // Favorite voices
  const favoriteVoices: SpeechVoice[] = useMemo(
    () => enrichedVoices.filter((v) => v.is_favorite),
    [enrichedVoices]
  );

  // Recommended (most sorted)
  const recommendedVoices: SpeechVoice[] = useMemo(
    () => [...enrichedVoices].sort((a, b) => a.sort_order - b.sort_order).slice(0, 6),
    [enrichedVoices]
  );

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ voiceId, isFav }: { voiceId: string; isFav: boolean }) => {
      if (isFav) await speechService.removeVoiceFavorite(voiceId);
      else       await speechService.addVoiceFavorite(voiceId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FAVES_KEY }),
  });

  const updateFilters = useCallback((patch: Partial<VoiceFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const resetFilters = useCallback(() => setFilters({}), []);

  return {
    voices:           filteredVoices,
    allVoices:        enrichedVoices,
    recentVoices,
    favoriteVoices,
    recommendedVoices,
    isLoading:        voicesQuery.isLoading,
    filters,
    updateFilters,
    resetFilters,
    toggleFavorite:   (voiceId: string, isFav: boolean) =>
      toggleFavoriteMutation.mutate({ voiceId, isFav }),
    favoriteIds,
  };
}
