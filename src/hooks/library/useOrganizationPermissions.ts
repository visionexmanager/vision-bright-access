import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchRolePermissions, grantRolePermission, revokeRolePermission,
  type OrganizationPermission,
} from "@/services/library/organizationPermissions";
import type { OrganizationMemberRole } from "@/services/library/organizations";

export function useOrganizationPermissions(orgId: string) {
  const queryClient = useQueryClient();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: queryKeys.library.organizationPermissions(orgId),
    queryFn: () => fetchRolePermissions(orgId),
    enabled: !!orgId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationPermissions(orgId) });

  const has = (role: OrganizationMemberRole, permission: OrganizationPermission) =>
    permissions.some((p) => p.role === role && p.permission === permission);

  const toggle = async (role: OrganizationMemberRole, permission: OrganizationPermission, currentlyGranted: boolean) => {
    try {
      if (currentlyGranted) await revokeRolePermission(orgId, role, permission);
      else await grantRolePermission(orgId, role, permission);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't update permission", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { permissions, isLoading, has, toggle };
}
