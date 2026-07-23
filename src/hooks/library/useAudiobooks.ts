/**
 * useAudiobooks / useAudiobookDetails — Phase 1 mock audiobooks catalog.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAudiobooks, fetchAudiobookById } from "@/services/library/audiobooks";

export function useAudiobooks() {
  const filtersKey = "all";
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.audiobooks(filtersKey),
    queryFn: () => fetchAudiobooks(),
    staleTime: 60 * 1000,
  });
  return { audiobooks: data ?? [], isLoading };
}

export function useAudiobookDetails(audiobookId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.audiobook(audiobookId ?? ""),
    queryFn: () => fetchAudiobookById(audiobookId!),
    enabled: !!audiobookId,
  });
  return { audiobook: data ?? null, isLoading };
}
