/**
 * useStudioBookDetail — one book's full author-side row (all fields,
 * including the Phase 9 studio-only columns), used across the editor,
 * overview, and pricing/workflow pages.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchStudioBookDetail, updateBookMetadata, updateBookPublishStatus, type LibraryBookMetadataPatch } from "@/services/library/studio";
import type { LibraryStudioBookFields } from "@/lib/types/library-studio";

export function useStudioBookDetail(bookId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: book, isLoading } = useQuery({
    queryKey: queryKeys.library.studio.bookDetail(bookId ?? ""),
    queryFn: () => fetchStudioBookDetail(bookId!),
    enabled: !!bookId,
  });

  const invalidate = () => {
    if (bookId) void queryClient.invalidateQueries({ queryKey: queryKeys.library.studio.bookDetail(bookId) });
  };

  const updateMetadata = async (patch: LibraryBookMetadataPatch) => {
    if (!bookId) return;
    await updateBookMetadata(bookId, patch);
    invalidate();
  };

  const updatePublishStatus = async (status: LibraryStudioBookFields["publish_status"], opts?: { reviewNote?: string; scheduledPublishAt?: string }) => {
    if (!bookId) return;
    await updateBookPublishStatus(bookId, status, opts);
    invalidate();
  };

  return { book: book ?? null, isLoading, updateMetadata, updatePublishStatus };
}
