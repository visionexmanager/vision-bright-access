import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchClubAnnouncements, createClubAnnouncement, deleteClubAnnouncement,
  fetchClubSchedule, setClubCurrentBook, fetchClubReadingProgress,
} from "@/services/library/clubExtras";

export function useClubAnnouncements(clubId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: queryKeys.library.clubAnnouncements(clubId ?? ""),
    queryFn: () => fetchClubAnnouncements(clubId!),
    enabled: !!clubId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.clubAnnouncements(clubId ?? "") });

  const create = async (title: string, body: string, isPinned: boolean) => {
    if (!clubId || !user) return;
    try {
      await createClubAnnouncement(clubId, user.id, title, body, isPinned);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't post announcement", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteClubAnnouncement(id);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete announcement", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { announcements, isLoading, create, remove };
}

export function useClubSchedule(clubId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: queryKeys.library.clubSchedule(clubId ?? ""),
    queryFn: () => fetchClubSchedule(clubId!),
    enabled: !!clubId,
  });

  const { data: progress = [] } = useQuery({
    queryKey: queryKeys.library.clubReadingProgress(clubId ?? ""),
    queryFn: () => fetchClubReadingProgress(clubId!),
    enabled: !!clubId,
  });

  const setCurrentBook = async (bookId: string, startDate: string, endDate: string | null, targetDescription: string | null) => {
    if (!clubId || !user) return;
    try {
      await setClubCurrentBook(clubId, bookId, user.id, startDate, endDate, targetDescription);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.clubSchedule(clubId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.clubReadingProgress(clubId) });
    } catch (err) {
      toast({ title: "Couldn't set current book", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const currentSchedule = schedule.find((s) => s.is_current) ?? null;

  return { schedule, currentSchedule, progress, isLoading, setCurrentBook };
}
