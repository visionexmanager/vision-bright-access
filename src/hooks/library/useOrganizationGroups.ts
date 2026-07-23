import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchOrganizationGroups, createOrganizationGroup, updateOrganizationGroup, deleteOrganizationGroup,
  fetchGroupMembers, addGroupMember, removeGroupMember, type CreateGroupInput,
} from "@/services/library/organizationGroups";

export function useOrganizationGroups(orgId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: queryKeys.library.organizationGroups(orgId),
    queryFn: () => fetchOrganizationGroups(orgId),
    enabled: !!orgId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationGroups(orgId) });

  const create = async (input: CreateGroupInput) => {
    if (!user || !orgId) return null;
    try {
      const group = await createOrganizationGroup(orgId, user.id, input);
      invalidate();
      return group;
    } catch (err) {
      toast({ title: "Couldn't create group", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    }
  };

  const update = async (groupId: string, patch: Partial<CreateGroupInput>) => {
    try {
      await updateOrganizationGroup(groupId, patch);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't update group", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const remove = async (groupId: string) => {
    try {
      await deleteOrganizationGroup(groupId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete group", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { groups, isLoading, create, update, remove };
}

export function useOrganizationGroupMembers(groupId: string) {
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: queryKeys.library.organizationGroupMembers(groupId),
    queryFn: () => fetchGroupMembers(groupId),
    enabled: !!groupId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationGroupMembers(groupId) });

  const addMember = async (userId: string, role: "lead" | "member" = "member") => {
    try {
      await addGroupMember(groupId, userId, role);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't add member", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await removeGroupMember(groupId, userId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't remove member", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { members, isLoading, addMember, removeMember };
}
