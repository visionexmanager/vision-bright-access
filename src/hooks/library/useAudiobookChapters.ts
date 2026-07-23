/**
 * useAudiobookChapters — chapter list for one audiobook. Empty result means
 * either the audiobook has no chapters yet (legacy single-file model —
 * callers fall back to the audiobook's own audio_file_id, see
 * LibraryAudioPlayerContext) or the viewer lacks access (RLS-gated).
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchChaptersForAudiobook } from "@/services/library/audiobookChapters";

export function useAudiobookChapters(audiobookId: string | undefined) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.library.audiobookChapters(audiobookId ?? ""),
    queryFn: () => fetchChaptersForAudiobook(audiobookId!),
    enabled: !!audiobookId,
  });
  return { chapters: data ?? [], isLoading, refetch };
}
