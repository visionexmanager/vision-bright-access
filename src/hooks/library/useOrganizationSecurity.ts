import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchOrganizationAuditLog, setOrganizationRequire2fa,
  listMfaFactors, enrollMfa, verifyMfaEnrollment, unenrollMfa, type MfaEnrollResult,
} from "@/services/library/organizationSecurity";

export function useOrganizationAuditLog(orgId: string) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.library.organizationAuditLog(orgId),
    queryFn: () => fetchOrganizationAuditLog(orgId),
    enabled: !!orgId,
  });
  return { entries, isLoading };
}

export function useOrganizationRequire2fa(orgId: string, orgSlug: string) {
  const queryClient = useQueryClient();

  const toggle = async (require2fa: boolean) => {
    try {
      await setOrganizationRequire2fa(orgId, require2fa);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationBySlug(orgSlug) });
      toast({ title: require2fa ? "2FA now required for members" : "2FA requirement removed" });
    } catch (err) {
      toast({ title: "Couldn't update setting", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { toggle };
}

export function useMyMfa() {
  const [isLoading, setIsLoading] = useState(false);
  const [enrollment, setEnrollment] = useState<MfaEnrollResult | null>(null);

  const { data: factors = [], refetch } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: () => listMfaFactors(),
  });

  const startEnroll = async () => {
    setIsLoading(true);
    try {
      setEnrollment(await enrollMfa());
    } catch (err) {
      toast({ title: "Couldn't start 2FA enrollment", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmEnroll = async (code: string) => {
    if (!enrollment) return false;
    setIsLoading(true);
    try {
      await verifyMfaEnrollment(enrollment.factorId, code);
      setEnrollment(null);
      void refetch();
      toast({ title: "Two-factor authentication enabled" });
      return true;
    } catch (err) {
      toast({ title: "Invalid code", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const remove = async (factorId: string) => {
    try {
      await unenrollMfa(factorId);
      void refetch();
      toast({ title: "Two-factor authentication disabled" });
    } catch (err) {
      toast({ title: "Couldn't disable 2FA", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { factors, isLoading, enrollment, startEnroll, confirmEnroll, remove, cancelEnroll: () => setEnrollment(null) };
}
