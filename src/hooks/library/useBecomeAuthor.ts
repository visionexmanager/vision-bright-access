/**
 * useBecomeAuthor — the signed-in user's own library_authors profile
 * (null if they haven't claimed one yet) plus the one-time self-service
 * creation call. See authors.ts's fetchAuthorByUserId/createAuthorProfile.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAuthorByUserId, createAuthorProfile } from "@/services/library/authors";

export function useBecomeAuthor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const { data: authorProfile, isLoading } = useQuery({
    queryKey: queryKeys.library.studio.ownAuthorProfile(uid ?? ""),
    queryFn: () => fetchAuthorByUserId(uid!),
    enabled: !!uid,
  });

  const becomeAuthor = async (fields: { name: string; bio?: string; photo_url?: string }) => {
    if (!uid) throw new Error("Sign in first");
    const profile = await createAuthorProfile(uid, fields);
    queryClient.setQueryData(queryKeys.library.studio.ownAuthorProfile(uid), profile);
    return profile;
  };

  return { authorProfile: authorProfile ?? null, isLoading, becomeAuthor };
}
