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

/**
 * Where the balances came from. `full`: the admin function, every user. `own`: the
 * paged read of user_points, which an admin session can only read for its own
 * rows; `viewerRead` says whether even that read finished.
 */
export type BalanceSource =
  | { kind: "full"; map: Record<string, number> }
  | { kind: "own"; map: Record<string, number>; viewerId: string | null | undefined; viewerRead: boolean };

/** A user's balance, or undefined when it is not known (shown as unavailable, never as 0). */
export function balanceOf(src: BalanceSource, userId: string): number | undefined {
  if (src.kind === "full") return src.map[userId] || 0;
  return src.viewerRead && userId === src.viewerId ? src.map[userId] || 0 : undefined;
}
