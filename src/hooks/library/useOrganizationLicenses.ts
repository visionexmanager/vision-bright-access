import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchOrganizationLicenses, createOrganizationLicense, deactivateOrganizationLicense,
  fetchSeatUsage, assignLicenseSeat, revokeLicenseSeat, fetchConcurrentUserCount,
  fetchActiveSessions, endOrganizationSession, type CreateLicenseInput,
} from "@/services/library/organizationLicenses";

export function useOrganizationLicenses(orgId: string) {
  const queryClient = useQueryClient();

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: queryKeys.library.organizationLicenses(orgId),
    queryFn: () => fetchOrganizationLicenses(orgId),
    enabled: !!orgId,
  });

  const { data: seatUsage = [] } = useQuery({
    queryKey: queryKeys.library.organizationSeatUsage(orgId),
    queryFn: () => fetchSeatUsage(orgId),
    enabled: !!orgId,
  });

  const { data: concurrentCount = 0 } = useQuery({
    queryKey: queryKeys.library.organizationConcurrent(orgId),
    queryFn: () => fetchConcurrentUserCount(orgId),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationLicenses(orgId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationSeatUsage(orgId) });
  };

  const create = async (input: CreateLicenseInput) => {
    try {
      await createOrganizationLicense(orgId, input);
      invalidate();
      toast({ title: "License created" });
    } catch (err) {
      toast({ title: "Couldn't create license", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const deactivate = async (licenseId: string) => {
    try {
      await deactivateOrganizationLicense(licenseId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't deactivate license", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const assignSeat = async (licenseId: string, userId: string) => {
    try {
      await assignLicenseSeat(licenseId, userId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't assign seat", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const revokeSeat = async (licenseId: string, userId: string) => {
    try {
      await revokeLicenseSeat(licenseId, userId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't revoke seat", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { licenses, seatUsage, concurrentCount, isLoading, create, deactivate, assignSeat, revokeSeat };
}

export function useOrganizationSessions(orgId: string) {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: queryKeys.library.organizationSessions(orgId),
    queryFn: () => fetchActiveSessions(orgId),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  const revoke = async (sessionId: string) => {
    try {
      await endOrganizationSession(sessionId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationSessions(orgId) });
      toast({ title: "Session ended" });
    } catch (err) {
      toast({ title: "Couldn't end session", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { sessions, isLoading, revoke };
}
