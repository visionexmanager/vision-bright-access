/**
 * useAuthorFollow — follow/unfollow an author, with the notification and
 * follower_count maintenance handled entirely by a DB trigger (see
 * library_author_followers in the publishing studio migration).
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { isFollowingAuthor, followAuthor, unfollowAuthor } from "@/services/library/authors";

export function useAuthorFollow(authorId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["library", "is-following-author", authorId ?? "", user?.id ?? ""] as const;

  const { data: isFollowing = false } = useQuery({
    queryKey,
    queryFn: () => isFollowingAuthor(authorId!, user!.id),
    enabled: !!authorId && !!user,
  });

  const toggle = async () => {
    if (!authorId || !user) return;
    try {
      if (isFollowing) await unfollowAuthor(authorId, user.id);
      else await followAuthor(authorId, user.id);
      void queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      toast({ title: "Couldn't update follow status", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { isFollowing, toggle, canFollow: !!user };
}
