import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as certificates from "@/features/visionkids/services/events/certificates";

export function useMyEventCertificates() {
  return useQuery({ queryKey: ["kids-events", "my-certificates"], queryFn: certificates.fetchMyEventCertificates });
}

export function useClaimEventCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, type }: { eventId: string; type: "event_participation" | "event_winner" }) => certificates.claimEventCertificate(eventId, type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "my-certificates"] }),
  });
}
