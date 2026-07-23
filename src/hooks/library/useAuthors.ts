/**
 * useAuthors / useAuthorProfile — Phase 1 mock authors directory.
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAuthors, fetchAuthorById } from "@/services/library/authors";

export function useAuthors() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.authors(),
    queryFn: fetchAuthors,
    staleTime: 5 * 60 * 1000,
  });
  return { authors: data ?? [], isLoading };
}

export function useAuthorProfile(authorId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.author(authorId ?? ""),
    queryFn: () => fetchAuthorById(authorId!),
    enabled: !!authorId,
  });
  return { author: data ?? null, isLoading };
}
