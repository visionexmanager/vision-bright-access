import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useFreeAccess } from "@/hooks/useFreeAccess";
import {
  getBillingStatus,
  getBalance,
  initializeBilling,
  upgradePlan,
  cancelSubscription,
} from "@/services/ai-media-studio/billingService";

export const BILLING_KEY   = ["billing", "status"]  as const;
export const BALANCE_KEY   = ["billing", "balance"]  as const;

// ── Core billing status ───────────────────────────────────────────────────────

export function useBillingStatus() {
  return useQuery({
    queryKey: BILLING_KEY,
    queryFn:  getBillingStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function useLiveBalance() {
  return useQuery({
    queryKey: BALANCE_KEY,
    queryFn:  getBalance,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

// ── Auto-initialize on first mount ────────────────────────────────────────────

export function useBillingInit() {
  const qc = useQueryClient();
  useEffect(() => {
    initializeBilling()
      .then(() => {
        qc.invalidateQueries({ queryKey: BILLING_KEY });
        qc.invalidateQueries({ queryKey: BALANCE_KEY });
      })
      .catch(() => null); // silent — user may already be initialized
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── Derived selectors ─────────────────────────────────────────────────────────

export function useCanGenerate() {
  const { data: status } = useBillingStatus();
  const { data: balance } = useLiveBalance();
  const { isAdmin, isNewUser } = useFreeAccess();

  // Admin users and users within 30-day free period always have full access
  if (isAdmin) return { canGenerate: true, reason: "admin" };
  if (isNewUser) return { canGenerate: true, reason: "free_period" };

  if (!status) return { canGenerate: true, reason: "loading" }; // optimistic

  if (status.can_generate) {
    if (balance?.in_trial) {
      return { canGenerate: true, reason: "trial", hoursLeft: balance.hours_left };
    }
    return { canGenerate: true, reason: "credits", balance: status.wallet.balance_vx };
  }

  return {
    canGenerate: false,
    reason:      "no_access",
    balance:     status.wallet.balance_vx,
  };
}

export function useTrialInfo() {
  const { data: status } = useBillingStatus();
  return status?.trial ?? null;
}

export function useWalletBalance() {
  const { data: balance } = useLiveBalance();
  return balance?.balance_vx ?? 0;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSubscriptionMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: BILLING_KEY });
    qc.invalidateQueries({ queryKey: BALANCE_KEY });
  };

  const upgrade = useMutation({
    mutationFn: (planId: string) => upgradePlan(planId),
    onSuccess: () => {
      invalidate();
      toast({ title: "Plan upgraded!", description: "Your new plan is now active." });
    },
    onError: (e: Error) => toast({
      title:       "Upgrade failed",
      description: e.message,
      variant:     "destructive",
    }),
  });

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      invalidate();
      toast({ title: "Subscription cancelled" });
    },
    onError: (e: Error) => toast({
      title:       "Cancel failed",
      description: e.message,
      variant:     "destructive",
    }),
  });

  return { upgrade, cancel };
}
