import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyCertificates, issueCertificate } from "@/services/library/certificates";
import type { LibraryCertificateType } from "@/lib/types/library-learning";

export function useCertificates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;
  const [isIssuing, setIsIssuing] = useState(false);

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: queryKeys.library.myCertificates(uid ?? ""),
    queryFn: () => fetchMyCertificates(uid!),
    enabled: !!uid,
  });

  const issue = async (certificateType: LibraryCertificateType, referenceId: string) => {
    setIsIssuing(true);
    try {
      const cert = await issueCertificate(certificateType, referenceId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.myCertificates(uid ?? "") });
      toast({ title: "Certificate issued!", description: cert.title });
      return cert;
    } catch (err) {
      toast({ title: "Couldn't issue certificate", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsIssuing(false);
    }
  };

  return { certificates, isLoading, isIssuing, issue };
}
