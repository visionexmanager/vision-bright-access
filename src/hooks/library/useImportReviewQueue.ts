import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchImportReviewQueue,
  approveImportedBook,
  rejectImportedBook,
  markImportAsDuplicate,
} from "@/services/library/importReview";

export function useImportReviewQueue() {
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.library.importReviewQueue(),
    queryFn: fetchImportReviewQueue,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.importReviewQueue() });

  const approve = async (bookId: string) => {
    try {
      await approveImportedBook(bookId);
      invalidate();
      toast({ title: "Book published" });
    } catch (err) {
      toast({ title: "Couldn't approve", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const reject = async (bookId: string, note: string) => {
    try {
      await rejectImportedBook(bookId, note);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't reject", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const markDuplicate = async (bookId: string, duplicateOfTitle: string) => {
    try {
      await markImportAsDuplicate(bookId, duplicateOfTitle);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't mark as duplicate", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { queue, isLoading, refetch, approve, reject, markDuplicate };
}
