// Keeping an OAuth 2.0 connection alive (YouTube, TikTok, X).
//
// These platforms hand out an access token that lives about an hour (YouTube),
// a day (TikTok) or two hours (X), plus a refresh token that mints the next one.
// Nothing before the publishing worker refreshed them, so a connection worked
// for the first hour and then every publish failed. This is the sweep that
// renews a token while it still has little time left, or after it has run out
// as long as the refresh token is still good.
//
// It is pure: the database, the decryption and the platform call arrive as
// functions, so every outcome is testable without a network. A report carries
// account ids, platform names and outcome codes only, never a token.

export type OAuth2Outcome =
  | "refreshed"
  | "not_due"
  | "reconnect_required"
  | "refresh_failed";

export interface OAuth2TokenRow {
  readonly accountId: string;
  readonly platform: string;
  /** When the access token dies, or null when none is recorded. */
  readonly expiresAt: string | null;
}

export interface OAuth2RefreshDeps {
  list(): Promise<OAuth2TokenRow[]>;
  /** Renews one account; reconnect_required when no usable refresh token exists. */
  refresh(accountId: string, platform: string): Promise<"refreshed" | "reconnect_required" | "refresh_failed">;
  now(): number;
}

export interface OAuth2RefreshReport {
  readonly accountId: string;
  readonly platform: string;
  readonly outcome: OAuth2Outcome;
}

const MINUTE_MS = 60 * 1000;

/**
 * Renew a token once less than this much of its life is left. The schedule runs
 * every half hour, so a token that lives an hour is always renewed before it
 * dies and a publish started at any moment finds a live one.
 */
export const OAUTH2_REFRESH_WINDOW_MS = 50 * MINUTE_MS;

export async function refreshExpiringOAuth2(
  deps: OAuth2RefreshDeps,
  windowMs = OAUTH2_REFRESH_WINDOW_MS,
): Promise<OAuth2RefreshReport[]> {
  const reports: OAuth2RefreshReport[] = [];
  const now = deps.now();

  for (const row of await deps.list()) {
    const expiry = row.expiresAt ? Date.parse(row.expiresAt) : NaN;

    // No recorded expiry is not a reason to act: the sweep only renews what it
    // can prove is running out.
    if (!Number.isFinite(expiry) || expiry - now > windowMs) {
      reports.push({ accountId: row.accountId, platform: row.platform, outcome: "not_due" });
      continue;
    }

    const outcome = await deps.refresh(row.accountId, row.platform);
    reports.push({ accountId: row.accountId, platform: row.platform, outcome });
  }

  return reports;
}

/** Outcomes that mean a person must act; the others are normal. */
export function oauth2NeedsAttention(reports: readonly OAuth2RefreshReport[]): boolean {
  return reports.some((r) => r.outcome === "reconnect_required" || r.outcome === "refresh_failed");
}
