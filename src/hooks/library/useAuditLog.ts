import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchAuditLogs } from "@/services/library/auditLog";
import { fetchRecentBackgroundJobs } from "@/services/library/backgroundJobs";

export function useAuditLogs() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: queryKeys.library.auditLogs(),
    queryFn: () => fetchAuditLogs(100),
  });
  return { logs, isLoading };
}

export function useBackgroundJobs() {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: queryKeys.library.backgroundJobs(),
    queryFn: () => fetchRecentBackgroundJobs(50),
    refetchInterval: 15_000,
  });
  return { jobs, isLoading };
}
