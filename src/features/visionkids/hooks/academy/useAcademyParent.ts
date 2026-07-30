import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as parent from "@/features/visionkids/services/academy/parent";

export function useGenerateParentLinkCode() {
  return useMutation({ mutationFn: parent.generateParentLinkCode });
}

export function useRedeemParentLinkCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => parent.redeemParentLinkCode(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "my-children"] }),
  });
}

export function useMyChildren() {
  return useQuery({ queryKey: ["kids-academy", "my-children"], queryFn: parent.fetchMyChildren });
}

export function useMyLinkedParents() {
  return useQuery({ queryKey: ["kids-academy", "my-linked-parents"], queryFn: parent.fetchMyLinkedParents });
}

export function useUnlinkChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => parent.unlinkChild(linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "my-children"] }),
  });
}

export function useChildWeeklySummary(childUserId: string | undefined) {
  return useQuery({
    queryKey: ["kids-academy", "child-weekly-summary", childUserId],
    queryFn: () => parent.fetchChildWeeklySummary(childUserId!),
    enabled: !!childUserId,
  });
}

/** Family Accounts (Phase 7) — same table/service file, new functions. */
export function useMyFamily() {
  return useQuery({ queryKey: ["kids-social", "my-family"], queryFn: parent.fetchMyFamily });
}

export function useEnsureMyFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: parent.ensureMyFamily,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "my-family"] }),
  });
}

export function useRenameMyFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (familyName: string) => parent.renameMyFamily(familyName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "my-family"] }),
  });
}
