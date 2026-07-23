/**
 * useVXRewardProgress — "how much VX until the next reward" for the home
 * page's VX Rewards widget. No new backend concept: reuses the existing
 * app-wide useVXWallet() balance and applies a small fixed tier ladder
 * client-side (no tiering concept exists anywhere else in the app/schema
 * to reuse).
 */

import { useVXWallet } from "@/hooks/useVXWallet";

const VX_REWARD_TIERS = [100, 250, 500, 1_000, 2_500, 5_000, 10_000];

export function useVXRewardProgress() {
  const { balance, isLoading } = useVXWallet();

  const nextTier = VX_REWARD_TIERS.find((tier) => tier > balance) ?? null;
  const previousTier = nextTier ? (VX_REWARD_TIERS[VX_REWARD_TIERS.indexOf(nextTier) - 1] ?? 0) : VX_REWARD_TIERS[VX_REWARD_TIERS.length - 1];
  const remaining = nextTier !== null ? nextTier - balance : 0;
  const percentToNext = nextTier !== null ? Math.min(100, Math.round(((balance - previousTier) / (nextTier - previousTier)) * 100)) : 100;

  return { balance, isLoading, nextTier, remaining, percentToNext };
}
