import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchReadingListShares, shareReadingListByEmail, unshareReadingList } from "@/services/library/readingLists";

export function useReadingListShares(listId: string) {
  const queryClient = useQueryClient();
  const [isSharing, setIsSharing] = useState(false);

  const { data: shares = [] } = useQuery({
    queryKey: queryKeys.library.readingListShares(listId),
    queryFn: () => fetchReadingListShares(listId),
    enabled: !!listId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.readingListShares(listId) });

  const share = useCallback(async (email: string): Promise<boolean> => {
    setIsSharing(true);
    try {
      const found = await shareReadingListByEmail(listId, email);
      if (found) {
        invalidate();
        toast({ title: "List shared" });
      } else {
        toast({ title: "No account found with that email", variant: "destructive" });
      }
      return found;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch (err) {
      toast({ title: "Couldn't share list", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return false;
    } finally {
      setIsSharing(false);
    }
  }, [listId]);

  const unshare = useCallback(async (userId: string) => {
    try {
      await unshareReadingList(listId, userId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't remove share", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  return { shares, share, unshare, isSharing };
}
