/**
 * useReadingChallenges — active challenges, each with the caller's own
 * progress embedded (or null if not joined / not signed in).
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchActiveChallenges, createCustomChallenge, joinChallenge, type LibraryCustomChallengeInput } from "@/services/library/challenges";

export function useReadingChallenges() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.library.challenges(),
    queryFn: fetchActiveChallenges,
    staleTime: 5 * 60 * 1000,
  });

  const create = async (input: LibraryCustomChallengeInput) => {
    if (!user) return;
    try {
      await createCustomChallenge(user.id, input);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.challenges() });
      toast({ title: "Challenge created" });
    } catch (err) {
      toast({ title: "Couldn't create challenge", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const join = async (challengeId: string) => {
    if (!user) return;
    try {
      await joinChallenge(user.id, challengeId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.challenges() });
    } catch (err) {
      toast({ title: "Couldn't join challenge", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { challenges: data ?? [], isLoading, error: error ? (error as Error).message : null, refetch, create, join };
}
