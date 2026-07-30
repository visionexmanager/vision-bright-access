import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as catalog from "@/features/visionkids/services/economy/catalog";
import * as wallet from "@/features/visionkids/services/economy/wallet";
import * as subs from "@/features/visionkids/services/economy/subscriptions";
import * as gifts from "@/features/visionkids/services/economy/gifts";
import type { DonationCause } from "@/features/visionkids/types/economy.types";

// ── Catalog ──────────────────────────────────────────────────────────────────
export function usePlans(audience?: string) {
  return useQuery({ queryKey: ["kids-econ", "plans", audience ?? "all"], queryFn: () => catalog.fetchPlans(audience) });
}
export function useRedeemables(category?: string) {
  return useQuery({ queryKey: ["kids-econ", "redeemables", category ?? "all"], queryFn: () => catalog.fetchRedeemables(category) });
}
export function usePartners() {
  return useQuery({ queryKey: ["kids-econ", "partners"], queryFn: catalog.fetchPartners });
}

// ── Wallet ───────────────────────────────────────────────────────────────────
export function useEconomySummary() {
  return useQuery({ queryKey: ["kids-econ", "summary"], queryFn: wallet.fetchEconomySummary });
}
export function useCoinBalance() {
  return useQuery({ queryKey: ["points-total", "kids-econ"], queryFn: wallet.fetchCoinBalance });
}
export function usePointsHistory() {
  return useQuery({ queryKey: ["kids-econ", "history"], queryFn: wallet.fetchPointsHistory });
}
export function useRedemptionSlugs() {
  return useQuery({ queryKey: ["kids-econ", "redemptions"], queryFn: wallet.fetchRedemptionSlugs });
}
function invalidateWallet(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["kids-econ", "summary"] });
  qc.invalidateQueries({ queryKey: ["kids-econ", "redemptions"] });
  qc.invalidateQueries({ queryKey: ["points-total"] });
}
export function useRedeemReward() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (slug: string) => wallet.redeemReward(slug), onSuccess: () => invalidateWallet(qc) });
}
export function useDonate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ cause, amount }: { cause: DonationCause; amount: number }) => wallet.donate(cause, amount), onSuccess: () => invalidateWallet(qc) });
}

// ── Subscriptions ─────────────────────────────────────────────────────────────
export function useMySubscriptions() {
  return useQuery({ queryKey: ["kids-econ", "subscriptions"], queryFn: subs.fetchMySubscriptions });
}
export function useInvoices() {
  return useQuery({ queryKey: ["kids-econ", "invoices"], queryFn: subs.fetchInvoices });
}
function invalidateSubs(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["kids-econ", "subscriptions"] });
  qc.invalidateQueries({ queryKey: ["kids-econ", "summary"] });
}
export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ planSlug, orgId }: { planSlug: string; orgId?: string }) => subs.subscribe(planSlug, orgId), onSuccess: () => invalidateSubs(qc) });
}
export function useApproveSubscription() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => subs.approveSubscription(id), onSuccess: () => invalidateSubs(qc) });
}
export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => subs.cancelSubscription(id), onSuccess: () => invalidateSubs(qc) });
}
export function useFinancialReports() {
  return useQuery({ queryKey: ["kids-econ", "financials"], queryFn: subs.fetchFinancialReports });
}

// ── Gifts ─────────────────────────────────────────────────────────────────────
export function useGifts() {
  return useQuery({ queryKey: ["kids-econ", "gifts"], queryFn: gifts.fetchGifts });
}
export function useCreateGift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: gifts.CreateGiftInput) => gifts.createGift(input), onSuccess: () => { qc.invalidateQueries({ queryKey: ["kids-econ", "gifts"] }); qc.invalidateQueries({ queryKey: ["points-total"] }); } });
}
export function useClaimGift() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => gifts.claimGift(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["kids-econ", "gifts"] }); qc.invalidateQueries({ queryKey: ["kids-econ", "summary"] }); qc.invalidateQueries({ queryKey: ["points-total"] }); } });
}
