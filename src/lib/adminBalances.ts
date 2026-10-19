/**
 * The per-user balances the admin user list shows.
 *
 * `admin_user_balances()` returns one jsonb object, {"<user_id>": <balance>}. The
 * contract lives in the migration, so the client checks the shape instead of
 * trusting it: anything that is not a plain object, and any value that is not a
 * finite number, is rejected rather than shown as a balance. `null` means "use the
 * fallback", never "zero".
 */
export function balancesFromTotals(totals: unknown): Record<string, number> | null {
  if (!totals || typeof totals !== "object" || Array.isArray(totals)) return null;
  const out: Record<string, number> = {};
  for (const [userId, value] of Object.entries(totals as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    out[userId] = value;
  }
  return out;
}

/** Sum signed ledger rows per user (the fallback: only the rows the session can read). */
export function balancesFromRows(rows: ReadonlyArray<{ user_id: string; points: number | null }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.user_id] = (out[r.user_id] || 0) + (r.points || 0);
  return out;
}
