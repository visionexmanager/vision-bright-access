import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchOrganizationBySlug, fetchOrganizationMembers, updateOrganization,
  inviteOrganizationMember, bulkInviteOrganizationMembers, updateOrganizationMember, removeOrganizationMember,
  type OrganizationMemberRole, type OrganizationMemberStatus,
} from "@/services/library/organizations";

/** Loads one organization by slug plus its roster, and exposes the calling
 *  user's own role/admin-ness within it (organization_members has no
 *  reliable client-side "my role" shortcut, so this derives it from the
 *  already-fetched member list rather than a second query). */
export function useOrganization(slug: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: organization, isLoading: isLoadingOrg } = useQuery({
    queryKey: queryKeys.library.organizationBySlug(slug),
    queryFn: () => fetchOrganizationBySlug(slug),
    enabled: !!slug,
  });

  const orgId = organization?.id ?? "";

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: queryKeys.library.organizationMembers(orgId),
    queryFn: () => fetchOrganizationMembers(orgId),
    enabled: !!orgId,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationBySlug(slug) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationMembers(orgId) });
  };

  const myMembership = members.find((m) => m.user_id === user?.id);
  const myRole = myMembership?.role ?? (organization?.owner_id === user?.id ? "owner" : null);
  const isAdmin = myRole === "owner" || myRole === "admin" || myRole === "manager";

  const update = async (patch: Parameters<typeof updateOrganization>[1]) => {
    if (!orgId) return;
    try {
      await updateOrganization(orgId, patch);
      invalidate();
      toast({ title: "Organization updated" });
    } catch (err) {
      toast({ title: "Couldn't update organization", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const invite = async (email: string, role: OrganizationMemberRole, customRoleLabel?: string, departmentId?: string) => {
    if (!orgId) return false;
    try {
      await inviteOrganizationMember(orgId, email, role, customRoleLabel, departmentId);
      invalidate();
      toast({ title: "Member invited" });
      return true;
    } catch (err) {
      toast({ title: "Couldn't invite member", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return false;
    }
  };

  const bulkInvite = async (rows: { email: string; role: OrganizationMemberRole; customRoleLabel?: string }[]) => {
    if (!orgId) return [];
    const results = await bulkInviteOrganizationMembers(orgId, rows);
    invalidate();
    const failedCount = results.filter((r) => !r.ok).length;
    toast({
      title: failedCount === 0 ? "All members invited" : `${results.length - failedCount} invited, ${failedCount} failed`,
      variant: failedCount === 0 ? "default" : "destructive",
    });
    return results;
  };

  const updateMember = async (userId: string, patch: { role?: OrganizationMemberRole; customRoleLabel?: string; status?: OrganizationMemberStatus; departmentId?: string | null }) => {
    if (!orgId) return;
    try {
      await updateOrganizationMember(orgId, userId, patch);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't update member", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeMember = async (userId: string) => {
    if (!orgId) return;
    try {
      await removeOrganizationMember(orgId, userId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't remove member", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return {
    organization, members, isLoading: isLoadingOrg || isLoadingMembers, myRole, isAdmin,
    update, invite, bulkInvite, updateMember, removeMember,
  };
}

export function useOrganizationPermission(orgId: string, permission: string) {
  const { data: hasPermission = false } = useQuery({
    queryKey: [...queryKeys.library.organizationPermissions(orgId), permission],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("organization_member_has_permission", { _organization_id: orgId, _permission: permission });
      if (error) throw new Error(error.message);
      return data as boolean;
    },
    enabled: !!orgId,
  });
  return hasPermission;
}
