// Keeping a Threads connection alive.
//
// A Threads access token lives about 60 days and cannot be renewed once it has
// expired; it can be extended only while it is still valid and at least 24
// hours old, and an extension restarts the 60 days. Nothing did that, so a
// connection made today would have died in December and been noticed when a
// post failed.
//
// This is the sweep that does it. It is pure: the database, the decryption and
// the Threads call arrive as functions, so every outcome is testable without a
// network. A report carries account ids and outcome codes only, never a token.

export type RefreshOutcome =
  | "refreshed"
  | "not_due"
  | "too_young"
  | "reconnect_required"
  | "refresh_failed"
  | "store_failed";

export interface ThreadsTokenRow {
  readonly accountId: string;
  /** When the stored token dies, or null when none is recorded. */
  readonly expiresAt: string | null;
  /** When the token was last written (connected or refreshed). */
  readonly writtenAt: string | null;
}

export interface RefreshDeps {
  list(): Promise<ThreadsTokenRow[]>;
  /** The decrypted access token, or null when it has expired or cannot be read. */
  accessToken(accountId: string): Promise<string | null>;
  extend(accessToken: string): Promise<{ ok: boolean; accessToken?: string; expiresAt?: string }>;
  store(accountId: string, accessToken: string, expiresAt: string | null): Promise<boolean>;
  now(): number;
}

export interface RefreshReport {
  readonly accountId: string;
  readonly outcome: RefreshOutcome;
  readonly expiresAt?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Extend a token once less than this much of its life is left. Daily runs give thirty tries. */
export const REFRESH_WINDOW_DAYS = 30;
/** Threads refuses to extend a token younger than this. */
export const MIN_TOKEN_AGE_MS = DAY_MS;

export async function refreshExpiringThreads(
  deps: RefreshDeps,
  windowDays = REFRESH_WINDOW_DAYS,
): Promise<RefreshReport[]> {
  const reports: RefreshReport[] = [];
  const now = deps.now();

  for (const row of await deps.list()) {
    const expiry = row.expiresAt ? Date.parse(row.expiresAt) : NaN;

    // No recorded expiry is not a reason to act: the sweep only extends what it
    // can prove is running out.
    if (!Number.isFinite(expiry)) {
      reports.push({ accountId: row.accountId, outcome: "not_due", expiresAt: row.expiresAt });
      continue;
    }
    if (expiry - now > windowDays * DAY_MS) {
      reports.push({ accountId: row.accountId, outcome: "not_due", expiresAt: row.expiresAt });
      continue;
    }

    // Already dead, or unreadable: nothing here can bring it back.
    const token = expiry > now ? await deps.accessToken(row.accountId) : null;
    if (!token) {
      reports.push({ accountId: row.accountId, outcome: "reconnect_required", expiresAt: row.expiresAt });
      continue;
    }

    const written = row.writtenAt ? Date.parse(row.writtenAt) : NaN;
    if (Number.isFinite(written) && now - written < MIN_TOKEN_AGE_MS) {
      reports.push({ accountId: row.accountId, outcome: "too_young", expiresAt: row.expiresAt });
      continue;
    }

    const extended = await deps.extend(token);
    if (!extended.ok || !extended.accessToken) {
      reports.push({ accountId: row.accountId, outcome: "refresh_failed", expiresAt: row.expiresAt });
      continue;
    }

    const stored = await deps.store(row.accountId, extended.accessToken, extended.expiresAt ?? null);
    reports.push({
      accountId: row.accountId,
      outcome: stored ? "refreshed" : "store_failed",
      expiresAt: extended.expiresAt ?? null,
    });
  }

  return reports;
}

/** Outcomes that mean a person must act; the others are normal. */
export function needsAttention(reports: readonly RefreshReport[]): boolean {
  return reports.some((r) =>
    r.outcome === "reconnect_required" || r.outcome === "refresh_failed" || r.outcome === "store_failed"
  );
}
