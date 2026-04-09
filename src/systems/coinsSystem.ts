/**
 * VX Coins system – virtual currency utilities.
 * Integrates with the existing user_points table via Supabase.
 */

export const COIN_PACKAGES = [
  { coins: 10_000, price: 10 },
  { coins: 50_000, price: 50 },
  { coins: 100_000, price: 100 },
  { coins: 150_000, price: 150 },
  { coins: 200_000, price: 200 },
  { coins: 500_000, price: 500 },
] as const;

export const PLATFORM_FEE_RATE = 0.05;

export function calculatePackageTotal(price: number) {
  const fee = price * PLATFORM_FEE_RATE;
  return { fee: Math.round(fee * 100) / 100, total: Math.round((price + fee) * 100) / 100 };
}
