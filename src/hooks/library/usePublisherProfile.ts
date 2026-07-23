/**
 * usePublisherProfile — the Publisher Store page's data: profile + follow
 * toggle. usePopularPublishers powers the Home page's "Popular Publishers"
 * rail — a separate, simpler hook since it needs no follow state.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchPublisherBySlug, fetchPopularPublishers, isFollowingPublisher, followPublisher, unfollowPublisher } from "@/services/library/publishers";

export function usePublisherProfile(slug: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: publisher, isLoading } = useQuery({
    queryKey: queryKeys.library.publisherBySlug(slug ?? ""),
    queryFn: () => fetchPublisherBySlug(slug!),
    enabled: !!slug,
  });

  const followQueryKey = queryKeys.library.isFollowingPublisher(publisher?.id ?? "", user?.id ?? "");
  const { data: isFollowing = false } = useQuery({
    queryKey: followQueryKey,
    queryFn: () => isFollowingPublisher(publisher!.id, user!.id),
    enabled: !!publisher && !!user,
  });

  const toggleFollow = async () => {
    if (!publisher || !user) return;
    if (isFollowing) await unfollowPublisher(publisher.id, user.id);
    else await followPublisher(publisher.id, user.id);
    void queryClient.invalidateQueries({ queryKey: followQueryKey });
  };

  return { publisher: publisher ?? null, isLoading, isFollowing, canFollow: !!user, toggleFollow };
}

export function usePopularPublishers(limit = 8) {
  const { data: publishers = [], isLoading } = useQuery({
    queryKey: queryKeys.library.popularPublishers(),
    queryFn: () => fetchPopularPublishers(limit),
  });
  return { publishers, isLoading };
}
