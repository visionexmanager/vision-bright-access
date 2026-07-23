import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchMyOrganizations, createOrganization, type CreateOrganizationInput,
} from "@/services/library/organizations";

export function useOrganizations() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const queryClient = useQueryClient();

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: queryKeys.library.myOrganizations(uid),
    queryFn: () => fetchMyOrganizations(uid),
    enabled: !!user,
  });

  const create = async (input: CreateOrganizationInput) => {
    if (!user) return null;
    try {
      const org = await createOrganization(user.id, input);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.myOrganizations(uid) });
      return org;
    } catch (err) {
      toast({ title: "Couldn't create organization", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    }
  };

  return { organizations, isLoading, create };
}
