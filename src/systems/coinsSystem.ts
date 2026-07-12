/**
 * VX Coins system – virtual currency utilities.
 * Integrates with the existing user_points table via Supabase.
 */

// 1,000 VX = $1. Must stay in sync with the identical formula hardcoded in
// create_vx_coin_order() (supabase/migrations/20260712120000_vx_coin_orders_custom_amount.sql) —
// that RPC never trusts a client-supplied price, it derives one from this
// same ratio server-side.
export const COINS_PER_USD = 1000;
export const MIN_COINS = 1000;
export const MAX_COINS = 5_000_000;

export const PLATFORM_FEE_RATE = 0.05;

export interface CoinPurchaseCalc {
  coins: number;
  price: number;
  fee: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Snap an arbitrary coin amount to the nearest valid (whole-dollar) multiple, clamped to bounds. */
export function snapCoins(coins: number): number {
  const snapped = Math.round(coins / COINS_PER_USD) * COINS_PER_USD;
  return Math.min(MAX_COINS, Math.max(MIN_COINS, snapped));
}

export function calculateFromCoins(coins: number): CoinPurchaseCalc {
  const snapped = snapCoins(coins);
  const price = snapped / COINS_PER_USD;
  const fee = round2(price * PLATFORM_FEE_RATE);
  return { coins: snapped, price, fee, total: round2(price + fee) };
}

export function calculateFromPrice(price: number): CoinPurchaseCalc {
  return calculateFromCoins(Math.max(0, price) * COINS_PER_USD);
}
