import { useQuery } from "@tanstack/react-query";
import * as dashboard from "@/features/visionkids/services/social/parentDashboard";

export function useParentDashboardStats(childUserId: string | undefined) {
  return useQuery({
    queryKey: ["kids-social", "dashboard-stats", childUserId],
    queryFn: () => dashboard.fetchParentDashboardStats(childUserId!),
    enabled: !!childUserId,
  });
}

export function useActivityTimeline(childUserId: string | undefined) {
  return useQuery({
    queryKey: ["kids-social", "activity-timeline", childUserId],
    queryFn: () => dashboard.fetchActivityTimeline(childUserId!),
    enabled: !!childUserId,
  });
}
