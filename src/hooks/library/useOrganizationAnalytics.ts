import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchOrganizationReadingStats, fetchOrganizationPopularBooks, fetchOrganizationDepartmentActivity,
  fetchOrganizationMemberEngagement, fetchOrganizationTrainingCompletion, fetchOrganizationCertificatesEarned,
} from "@/services/library/organizationAnalytics";

export function useOrganizationAnalytics(orgId: string) {
  const { data: readingStats, isLoading: isLoadingStats } = useQuery({
    queryKey: [...queryKeys.library.organizationAnalytics(orgId), "reading-stats"],
    queryFn: () => fetchOrganizationReadingStats(orgId),
    enabled: !!orgId,
  });

  const { data: popularBooks = [] } = useQuery({
    queryKey: [...queryKeys.library.organizationAnalytics(orgId), "popular-books"],
    queryFn: () => fetchOrganizationPopularBooks(orgId),
    enabled: !!orgId,
  });

  const { data: departmentActivity = [] } = useQuery({
    queryKey: [...queryKeys.library.organizationAnalytics(orgId), "department-activity"],
    queryFn: () => fetchOrganizationDepartmentActivity(orgId),
    enabled: !!orgId,
  });

  const { data: memberEngagement = [] } = useQuery({
    queryKey: [...queryKeys.library.organizationAnalytics(orgId), "member-engagement"],
    queryFn: () => fetchOrganizationMemberEngagement(orgId),
    enabled: !!orgId,
  });

  const { data: trainingCompletion = [] } = useQuery({
    queryKey: [...queryKeys.library.organizationAnalytics(orgId), "training-completion"],
    queryFn: () => fetchOrganizationTrainingCompletion(orgId),
    enabled: !!orgId,
  });

  const { data: certificatesEarned = 0 } = useQuery({
    queryKey: [...queryKeys.library.organizationAnalytics(orgId), "certificates-earned"],
    queryFn: () => fetchOrganizationCertificatesEarned(orgId),
    enabled: !!orgId,
  });

  return { readingStats, popularBooks, departmentActivity, memberEngagement, trainingCompletion, certificatesEarned, isLoading: isLoadingStats };
}
