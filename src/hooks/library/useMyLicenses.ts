import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyLicenses, fetchLicenseSeats, inviteLicenseSeat, revokeLicenseSeat } from "@/services/library/licenses";

export function useMyLicenses() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: queryKeys.library.myLicenses(uid ?? ""),
    queryFn: () => fetchMyLicenses(uid!),
    enabled: !!uid,
  });

  return { licenses, isLoading };
}

export function useLicenseSeats(licenseId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: seats = [], isLoading } = useQuery({
    queryKey: queryKeys.library.licenseSeats(licenseId ?? ""),
    queryFn: () => fetchLicenseSeats(licenseId!),
    enabled: !!licenseId,
  });

  const invalidate = () => {
    if (!licenseId) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.licenseSeats(licenseId) });
  };

  const invite = async (email: string) => {
    if (!licenseId) return;
    try {
      await inviteLicenseSeat(licenseId, email);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't invite seat", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const revoke = async (userId: string) => {
    if (!licenseId) return;
    try {
      await revokeLicenseSeat(licenseId, userId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't revoke seat", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { seats, isLoading, invite, revoke };
}
