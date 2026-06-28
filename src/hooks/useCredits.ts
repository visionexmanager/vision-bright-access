import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  consumeCredits,
  refundCredits,
  getTransactionHistory,
  getUsageLogs,
} from "@/services/ai-media-studio/billingService";
import { BILLING_KEY, BALANCE_KEY } from "@/hooks/useBilling";
import { useQuery } from "@tanstack/react-query";
import type { OperationType, BillingConsumeResult } from "@/lib/types/billing";

// ── Credit consumption hook ───────────────────────────────────────────────────

export function useCreditConsume() {
  const qc      = useQueryClient();
  const [state, setState] = useState<{
    consuming:    boolean;
    lastResult:   BillingConsumeResult | null;
    error:        string | null;
  }>({ consuming: false, lastResult: null, error: null });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: BILLING_KEY });
    qc.invalidateQueries({ queryKey: BALANCE_KEY });
  };

  const consume = useCallback(async (params: {
    operation_type:   OperationType;
    job_id?:          string;
    project_id?:      string;
    provider_slug?:   string;
    idempotency_key?: string;
  }): Promise<BillingConsumeResult> => {
    setState((s) => ({ ...s, consuming: true, error: null }));

    try {
      const result = await consumeCredits(params);
      if (result.ok) {
        invalidate();
      } else {
        setState((s) => ({ ...s, error: result.error ?? "Billing failed" }));
      }
      setState((s) => ({ ...s, lastResult: result, consuming: false }));
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Billing error";
      setState((s) => ({ ...s, error: msg, consuming: false, lastResult: null }));
      return { ok: false, error: msg };
    }
  }, [qc]);

  const refund = useCallback(async (jobId: string) => {
    try {
      const result = await refundCredits({ job_id: jobId });
      if (result.refunded) {
        invalidate();
        toast({ title: `Refunded ${result.amount_vx} VX` });
      }
    } catch { /* best-effort */ }
  }, [qc]);

  return { consume, refund, ...state };
}

// ── Transaction history ────────────────────────────────────────────────────────

export function useTransactionHistory(params: {
  limit?:  number;
  offset?: number;
  type?:   string;
} = {}) {
  return useQuery({
    queryKey: ["billing", "history", params],
    queryFn:  () => getTransactionHistory(params),
    staleTime: 60_000,
  });
}

// ── Usage logs ────────────────────────────────────────────────────────────────

export function useUsageLogs(params: {
  operation_type?: OperationType;
  limit?:          number;
  hours?:          number;
} = {}) {
  return useQuery({
    queryKey: ["billing", "usage", params],
    queryFn:  () => getUsageLogs(params),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
