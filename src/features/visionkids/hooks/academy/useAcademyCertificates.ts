import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as certificates from "@/features/visionkids/services/academy/certificates";

export function useMyCertificates() {
  return useQuery({ queryKey: ["kids-academy", "certificates"], queryFn: certificates.fetchMyCertificates });
}

export function useIssueCourseCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => certificates.issueCourseCertificate(courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-academy", "certificates"] }),
  });
}

export function useVerifyCertificate(certificateNumber: string | undefined) {
  return useQuery({
    queryKey: ["kids-academy", "verify-certificate", certificateNumber],
    queryFn: () => certificates.verifyCertificate(certificateNumber!),
    enabled: !!certificateNumber,
  });
}
