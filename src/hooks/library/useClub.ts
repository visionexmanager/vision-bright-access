import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchClubBySlug, fetchClubMembers, fetchMyClubMembership,
  joinClub, leaveClub, inviteToClub, respondToClubInvite, approveClubJoinRequest, setClubMemberRole, setClubMemberBan,
  updateClub, deleteClub, type LibraryClubInput,
} from "@/services/library/clubs";

export function useClub(slug: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: club, isLoading: isLoadingClub } = useQuery({
    queryKey: queryKeys.library.club(slug ?? ""),
    queryFn: () => fetchClubBySlug(slug!),
    enabled: !!slug,
  });

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: queryKeys.library.clubMembers(club?.id ?? ""),
    queryFn: () => fetchClubMembers(club!.id),
    enabled: !!club,
  });

  const { data: myMembership } = useQuery({
    queryKey: queryKeys.library.myClubMembership(club?.id ?? "", user?.id ?? ""),
    queryFn: () => fetchMyClubMembership(club!.id, user!.id),
    enabled: !!club && !!user,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.club(slug ?? "") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.clubMembers(club?.id ?? "") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.myClubMembership(club?.id ?? "", user?.id ?? "") });
  };

  const wrap = (fn: () => Promise<unknown>, failTitle: string) => async () => {
    try {
      await fn();
      invalidate();
    } catch (err) {
      toast({ title: failTitle, description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const join = wrap(() => joinClub(club!.id), "Couldn't join club");
  const leave = wrap(() => leaveClub(club!.id), "Couldn't leave club");
  const acceptInvite = wrap(() => respondToClubInvite(club!.id, true), "Couldn't accept invite");
  const declineInvite = wrap(() => respondToClubInvite(club!.id, false), "Couldn't decline invite");

  const invite = async (email: string) => {
    try {
      const found = await inviteToClub(club!.id, email);
      if (found) toast({ title: "Invitation sent" });
      else toast({ title: "No account found with that email", variant: "destructive" });
      invalidate();
      return found;
    } catch (err) {
      toast({ title: "Couldn't send invite", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return false;
    }
  };

  const approveRequest = (userId: string, approve: boolean) => wrap(() => approveClubJoinRequest(club!.id, userId, approve), "Couldn't update request")();
  const setRole = (userId: string, role: "moderator" | "member") => wrap(() => setClubMemberRole(club!.id, userId, role), "Couldn't update role")();
  const setBan = (userId: string, banned: boolean) => wrap(() => setClubMemberBan(club!.id, userId, banned), "Couldn't update ban status")();

  const update = async (input: Partial<LibraryClubInput>) => {
    try {
      await updateClub(club!.id, input);
      invalidate();
      toast({ title: "Club updated" });
    } catch (err) {
      toast({ title: "Couldn't update club", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const remove = async () => {
    try {
      await deleteClub(club!.id);
      toast({ title: "Club deleted" });
      return true;
    } catch (err) {
      toast({ title: "Couldn't delete club", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return false;
    }
  };

  const isMember = myMembership?.status === "active";
  const isModerator = isMember && (myMembership?.role === "owner" || myMembership?.role === "moderator");
  const isOwner = myMembership?.role === "owner";

  return {
    club: club ?? null, members, myMembership: myMembership ?? null,
    isMember, isModerator, isOwner,
    isLoading: isLoadingClub || isLoadingMembers,
    join, leave, acceptInvite, declineInvite, invite, approveRequest, setRole, setBan, update, remove,
  };
}
