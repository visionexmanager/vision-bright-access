import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { isFollowing, followUser, unfollowUser, fetchFollowers, fetchFollowing } from "@/services/library/follows";

export function useFollowUser(targetUserId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: following = false, isLoading } = useQuery({
    queryKey: queryKeys.library.isFollowing(targetUserId ?? "", user?.id ?? ""),
    queryFn: () => isFollowing(user!.id, targetUserId!),
    enabled: !!user && !!targetUserId && user.id !== targetUserId,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.isFollowing(targetUserId ?? "", user?.id ?? "") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.readerProfileStats(targetUserId ?? "") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.followers(targetUserId ?? "") });
  };

  const toggle = async () => {
    if (!user || !targetUserId) return;
    try {
      if (following) await unfollowUser(user.id, targetUserId);
      else await followUser(user.id, targetUserId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't update follow status", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { isFollowing: following, isLoading, toggle };
}

export function useFollowLists(userId: string | undefined) {
  const { data: followers = [], isLoading: isLoadingFollowers } = useQuery({
    queryKey: queryKeys.library.followers(userId ?? ""),
    queryFn: () => fetchFollowers(userId!),
    enabled: !!userId,
  });

  const { data: following = [], isLoading: isLoadingFollowing } = useQuery({
    queryKey: queryKeys.library.following(userId ?? ""),
    queryFn: () => fetchFollowing(userId!),
    enabled: !!userId,
  });

  return { followers, following, isLoading: isLoadingFollowers || isLoadingFollowing };
}
