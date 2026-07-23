import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchOrganizationResources, createOrganizationResource, deleteOrganizationResource, getSignedResourceUrl,
  type CreateResourceInput, type OrganizationResourceType,
} from "@/services/library/organizationResources";

export function useOrganizationResources(orgId: string, resourceType?: OrganizationResourceType) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: [...queryKeys.library.organizationResources(orgId), resourceType ?? "all"],
    queryFn: () => fetchOrganizationResources(orgId, resourceType),
    enabled: !!orgId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationResources(orgId) });

  const create = async (input: CreateResourceInput, file?: File) => {
    if (!user || !orgId) return null;
    setIsUploading(true);
    try {
      const resource = await createOrganizationResource(orgId, user.id, input, file);
      invalidate();
      toast({ title: "Resource added" });
      return resource;
    } catch (err) {
      toast({ title: "Couldn't add resource", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const remove = async (resourceId: string) => {
    try {
      await deleteOrganizationResource(resourceId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete resource", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const download = async (storagePath: string) => {
    const url = await getSignedResourceUrl(storagePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast({ title: "Couldn't generate download link", variant: "destructive" });
  };

  return { resources, isLoading, isUploading, create, remove, download };
}
