import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as reports from "@/features/visionkids/services/social/reports";
import type { ReportContentType } from "@/features/visionkids/types/social.types";

export function useFileReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contentType, contentId, reason, details }: { contentType: ReportContentType; contentId: string; reason: string; details?: string }) =>
      reports.fileReport(contentType, contentId, reason, details),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "my-reports"] }),
  });
}

export function useMyReports() {
  return useQuery({ queryKey: ["kids-social", "my-reports"], queryFn: reports.fetchMyReports });
}

export function useChildReports(childUserId: string | undefined) {
  return useQuery({ queryKey: ["kids-social", "child-reports", childUserId], queryFn: () => reports.fetchChildReports(childUserId!), enabled: !!childUserId });
}
