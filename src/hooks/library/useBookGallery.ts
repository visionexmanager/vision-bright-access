import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchBookGallery } from "@/services/library/studio";

/** Reader-facing gallery read — library_book_gallery is public-readable for
 *  any published book (see 20260728000000_library_publishing_studio.sql),
 *  so this needs no access-gating beyond the book itself being visible. */
export function useBookGallery(bookId: string | undefined) {
  const { data: gallery = [], isLoading } = useQuery({
    queryKey: queryKeys.library.studio.gallery(bookId ?? ""),
    queryFn: () => fetchBookGallery(bookId!),
    enabled: !!bookId,
  });
  return { gallery, isLoading };
}
