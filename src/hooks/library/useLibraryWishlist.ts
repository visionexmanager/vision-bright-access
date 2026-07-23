/**
 * useLibraryWishlist — "I intend to buy this" list, distinct from
 * Favorites ("I liked this"). Powers both the WishlistButton on any book
 * card/details page and the dedicated LibraryWishlistPage.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchWishlistBookIds, fetchWishlistBooks, addToWishlist, removeFromWishlist } from "@/services/library/wishlist";

export function useLibraryWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const { data: wishlistIds = new Set<string>() } = useQuery({
    queryKey: queryKeys.library.wishlistIds(uid ?? ""),
    queryFn: () => fetchWishlistBookIds(uid!),
    enabled: !!uid,
  });

  const { data: books = [], isLoading: isLoadingBooks } = useQuery({
    queryKey: queryKeys.library.wishlist(uid ?? ""),
    queryFn: () => fetchWishlistBooks(uid!),
    enabled: !!uid,
  });

  const invalidate = () => {
    if (!uid) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.wishlistIds(uid) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.wishlist(uid) });
  };

  const toggleWishlist = async (bookId: string) => {
    if (!uid) return;
    try {
      if (wishlistIds.has(bookId)) await removeFromWishlist(uid, bookId);
      else await addToWishlist(uid, bookId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't update wishlist", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { wishlistIds, books, isLoadingBooks, toggleWishlist, isInWishlist: (bookId: string) => wishlistIds.has(bookId) };
}
