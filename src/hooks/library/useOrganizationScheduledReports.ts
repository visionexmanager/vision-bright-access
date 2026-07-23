import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchScheduledReports, createScheduledReport, deleteScheduledReport, toggleScheduledReport,
  type OrganizationReportCadence,
} from "@/services/library/organizationScheduledReports";

export function useOrganizationScheduledReports(orgId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: scheduledReports = [], isLoading } = useQuery({
    queryKey: [...queryKeys.library.organizationAnalytics(orgId), "scheduled-reports"],
    queryFn: () => fetchScheduledReports(orgId),
    enabled: !!orgId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: [...queryKeys.library.organizationAnalytics(orgId), "scheduled-reports"] });

  const create = async (reportName: string, cadence: OrganizationReportCadence, recipientEmails: string[]) => {
    if (!user || !orgId) return;
    try {
      await createScheduledReport(orgId, user.id, reportName, cadence, recipientEmails);
      invalidate();
      toast({ title: "Scheduled report created" });
    } catch (err) {
      toast({ title: "Couldn't create scheduled report", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const remove = async (reportId: string) => {
    try {
      await deleteScheduledReport(reportId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete scheduled report", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const toggle = async (reportId: string, isActive: boolean) => {
    try {
      await toggleScheduledReport(reportId, isActive);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't update scheduled report", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { scheduledReports, isLoading, create, remove, toggle };
}
