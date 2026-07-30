import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as moderation from "@/features/visionkids/services/social/moderation";
import type { ContentReport, ModerationAction, ModerationScope } from "@/features/visionkids/types/social.types";

export function useReportQueue(status: ContentReport["status"] = "pending") {
  return useQuery({ queryKey: ["kids-social", "report-queue", status], queryFn: () => moderation.fetchReportQueue(status) });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: ContentReport["status"] }) => moderation.resolveReport(reportId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "report-queue"] }),
  });
}

export function useApplyModerationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; action: ModerationAction; reason: string; scopeType?: ModerationScope; scopeId?: string; expiresAt?: string }) =>
      moderation.applyModerationAction(vars.userId, vars.action, vars.reason, vars.scopeType, vars.scopeId, vars.expiresAt),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["kids-social", "moderation-history", vars.userId] }),
  });
}

export function useModerationHistory(userId: string | undefined) {
  return useQuery({ queryKey: ["kids-social", "moderation-history", userId], queryFn: () => moderation.fetchModerationHistory(userId!), enabled: !!userId });
}

export function useAdminActionLog() {
  return useQuery({ queryKey: ["kids-social", "admin-log"], queryFn: () => moderation.fetchAdminActionLog() });
}

export function useDeleteGroupMessage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (messageId: string) => moderation.deleteGroupMessage(messageId), onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "group-messages"] }) });
}

export function useEndRoomAsModerator() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (roomId: string) => moderation.endRoomAsModerator(roomId), onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "voice-rooms"] }) });
}
