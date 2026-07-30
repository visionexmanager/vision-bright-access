import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as childSettings from "@/features/visionkids/services/social/childSettings";

export function useChildSettings(childUserId: string | undefined) {
  return useQuery({
    queryKey: ["kids-social", "child-settings", childUserId],
    queryFn: () => childSettings.fetchChildSettings(childUserId!),
    enabled: !!childUserId,
  });
}

export function useUpdateChildSettings(childUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: childSettings.UpdateChildSettingsInput) => childSettings.updateChildSettings(childUserId!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "child-settings", childUserId] }),
  });
}
