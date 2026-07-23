/**
 * useCollaborators — a book's collaborator list + invite/role/revoke
 * actions, plus a one-shot "claim my pending invitations" call meant to run
 * once per session after sign-in (see LibraryStudioBookOverview.tsx, which
 * calls claimMyInvitations on mount).
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchCollaborators, inviteCollaborator, updateCollaboratorRole, revokeCollaborator, claimPendingInvitations,
} from "@/services/library/collaborators";
import type { LibraryCollaboratorRole } from "@/lib/types/library-studio";

export function useCollaborators(bookId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: collaborators = [], isLoading } = useQuery({
    queryKey: queryKeys.library.studio.collaborators(bookId ?? ""),
    queryFn: () => fetchCollaborators(bookId!),
    enabled: !!bookId,
  });

  const invalidate = useCallback(() => {
    if (bookId) void queryClient.invalidateQueries({ queryKey: queryKeys.library.studio.collaborators(bookId) });
  }, [bookId, queryClient]);

  const invite = useCallback(
    async (email: string, role: LibraryCollaboratorRole) => {
      if (!bookId || !user) return;
      try {
        await inviteCollaborator(bookId, user.id, email, role);
        invalidate();
        toast({ title: "Invitation sent" });
      } catch (err) {
        toast({ title: "Couldn't send invitation", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [bookId, user, invalidate]
  );

  const changeRole = useCallback(
    async (collaboratorId: string, role: LibraryCollaboratorRole) => {
      await updateCollaboratorRole(collaboratorId, role);
      invalidate();
    },
    [invalidate]
  );

  const revoke = useCallback(
    async (collaboratorId: string) => {
      await revokeCollaborator(collaboratorId);
      invalidate();
    },
    [invalidate]
  );

  return { collaborators, isLoading, invite, changeRole, revoke };
}

/** Run once after sign-in (e.g. in a top-level Library layout effect) so a
 *  person invited by email becomes an active collaborator the moment they
 *  have an account, without needing a dedicated "accept invite" page. */
export function useClaimPendingInvitations() {
  const { user } = useAuth();
  return useCallback(async () => {
    if (!user?.email) return;
    try {
      await claimPendingInvitations(user.id, user.email);
    } catch {
      // Best-effort — a failed claim just means the invite stays pending, retried next sign-in.
    }
  }, [user]);
}
