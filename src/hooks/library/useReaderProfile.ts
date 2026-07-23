import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchReaderProfile, fetchReaderProfileStats, fetchPublicReadingLists, upsertMyReaderProfile,
  type LibraryReaderProfileInput,
} from "@/services/library/readerProfile";
import { fetchAllAchievements, fetchMyEarnedAchievementIds } from "@/services/library/achievements";
import { fetchMyReviews } from "@/services/library/reviews";

export function useReaderProfile(userId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSelf = !!user && user.id === userId;

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: queryKeys.library.readerProfile(userId ?? ""),
    queryFn: () => fetchReaderProfile(userId!),
    enabled: !!userId,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: queryKeys.library.readerProfileStats(userId ?? ""),
    queryFn: () => fetchReaderProfileStats(userId!),
    enabled: !!userId,
  });

  const { data: publicLists = [] } = useQuery({
    queryKey: queryKeys.library.publicReadingLists(userId ?? ""),
    queryFn: () => fetchPublicReadingLists(userId!),
    enabled: !!userId && (isSelf || profile?.show_reading_lists !== false),
  });

  const { data: achievements = [] } = useQuery({
    queryKey: queryKeys.library.achievements(),
    queryFn: fetchAllAchievements,
    staleTime: 60 * 60 * 1000,
  });

  const { data: earnedIds } = useQuery({
    queryKey: queryKeys.library.myAchievements(userId ?? ""),
    queryFn: () => fetchMyEarnedAchievementIds(userId!),
    enabled: !!userId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: queryKeys.library.reviews(userId ?? ""),
    queryFn: () => fetchMyReviews(userId!),
    enabled: !!userId && (isSelf || profile?.show_reviews !== false),
  });

  const saveProfile = async (input: LibraryReaderProfileInput) => {
    if (!user) return;
    try {
      await upsertMyReaderProfile(user.id, input);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.readerProfile(user.id) });
      toast({ title: "Profile updated" });
    } catch (err) {
      toast({ title: "Couldn't update profile", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const earnedAchievements = achievements.filter((a) => earnedIds?.has(a.id));

  return {
    profile: profile ?? null,
    stats: stats ?? null,
    publicLists,
    earnedAchievements,
    reviews,
    isSelf,
    isLoading: isLoadingProfile || isLoadingStats,
    saveProfile,
  };
}
