import { useQuery } from "@tanstack/react-query";
import {
  getTransactionHistory,
  getUsageLogs,
} from "@/services/ai-media-studio/billingService";
import type { OperationType } from "@/lib/types/billing";

// The consume/refund hook that used to live here is gone. It charged
// `credit_wallets` from the browser and no screen ever imported it; charging
// VX is now `vx_reserve`/`vx_settle`, server-side only, behind
// `_shared/vx/meter.ts`. See .claude/references/vx-deprecations.md.

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
