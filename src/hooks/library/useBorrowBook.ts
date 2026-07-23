/**
 * useBorrowBook — "Borrow" / "Return" for the Book Details action bar.
 * Only relevant when the book has lending_copies_total set (the "borrowing
 * enabled" flag per book) — callers should gate rendering on that, this
 * hook itself just surfaces the current borrow state and actions.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyBorrowForBook, borrowBook, returnBorrowedBook } from "@/services/library/borrowing";

export function useBorrowBook(bookId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const { data: borrow = null, isLoading } = useQuery({
    queryKey: queryKeys.library.borrowStatus(bookId ?? "", uid ?? ""),
    queryFn: () => fetchMyBorrowForBook(bookId!, uid!),
    enabled: !!bookId && !!uid,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.library.borrowStatus(bookId ?? "", uid ?? "") });
  }, [queryClient, bookId, uid]);

  const borrowNow = useCallback(async () => {
    if (!bookId || !uid) return false;
    try {
      await borrowBook(bookId, uid);
      invalidate();
      toast({ title: "Book borrowed", description: "You can read it until the due date." });
      return true;
    } catch (err) {
      toast({ title: "Couldn't borrow this book", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return false;
    }
  }, [bookId, uid, invalidate]);

  const returnNow = useCallback(async () => {
    if (!borrow) return;
    try {
      await returnBorrowedBook(borrow.id);
      invalidate();
      toast({ title: "Book returned" });
    } catch (err) {
      toast({ title: "Couldn't return this book", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }, [borrow, invalidate]);

  return { borrow, isLoading, borrowNow, returnNow };
}
