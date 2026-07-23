import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  fetchPendingReports, resolveReport, issueModerationAction, fetchUserModerationHistory,
  type LibraryModerationAction,
} from "@/services/library/moderation";
import { logLibraryAuditEvent } from "@/services/library/auditLog";

export function useModerationDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["library", "pending-reports"],
    queryFn: fetchPendingReports,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["library", "pending-reports"] });

  const resolve = async (reportId: string, status: "reviewed" | "dismissed" | "actioned") => {
    if (!user) return;
    try {
      await resolveReport(reportId, user.id, status);
      await logLibraryAuditEvent("content_report_resolved", "content_report", reportId, { status });
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't resolve report", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const takeAction = async (targetUserId: string, action: LibraryModerationAction, reason: string, expiresAt: string | null) => {
    if (!user) return;
    try {
      await issueModerationAction(targetUserId, user.id, action, reason, null, expiresAt);
      await logLibraryAuditEvent(`user_${action}`, "library_reader_profile", targetUserId, { reason });
      toast({ title: "Action taken" });
    } catch (err) {
      toast({ title: "Couldn't take action", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { reports, isLoading, resolve, takeAction };
}

export function useUserModerationHistory(userId: string | undefined) {
  const { data: history = [] } = useQuery({
    queryKey: ["library", "user-moderation-history", userId ?? ""],
    queryFn: () => fetchUserModerationHistory(userId!),
    enabled: !!userId,
  });
  return { history };
}
