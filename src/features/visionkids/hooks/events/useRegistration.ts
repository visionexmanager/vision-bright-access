import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as registration from "@/features/visionkids/services/events/registration";

export function useMyRegistration(eventId: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "my-registration", eventId], queryFn: () => registration.fetchMyRegistration(eventId!), enabled: !!eventId });
}

export function useMyRegistrations() {
  return useQuery({ queryKey: ["kids-events", "my-registrations"], queryFn: registration.fetchMyRegistrations });
}

export function useRegisterForEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => registration.registerForEvent(eventId),
    onSuccess: (_d, eventId) => {
      qc.invalidateQueries({ queryKey: ["kids-events", "my-registration", eventId] });
      qc.invalidateQueries({ queryKey: ["kids-events", "my-registrations"] });
    },
  });
}

export function useCancelRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (registrationId: string) => registration.cancelRegistration(registrationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "my-registrations"] }),
  });
}

export function usePendingApprovalsForChild(childUserId: string | undefined) {
  return useQuery({
    queryKey: ["kids-events", "pending-approvals", childUserId],
    queryFn: () => registration.fetchPendingApprovalsForChild(childUserId!),
    enabled: !!childUserId,
  });
}

export function useDecideRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registrationId, approve }: { registrationId: string; approve: boolean }) => registration.decideRegistration(registrationId, approve),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "pending-approvals"] }),
  });
}
