import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  OAUTH2_REFRESH_WINDOW_MS,
  oauth2NeedsAttention,
  refreshExpiringOAuth2,
  type OAuth2RefreshDeps,
  type OAuth2TokenRow,
} from "../../supabase/functions/_shared/publishing/oauth2TokenRefresh.ts";

// A YouTube access token lives an hour and nothing renewed it, so a connection
// worked until the first hour passed and every publish failed after that. This
// is the sweep that renews it while it still has little time left.

const MIN = 60 * 1000;
const NOW = Date.parse("2026-10-26T10:00:00Z");
const at = (minutes: number) => new Date(NOW + minutes * MIN).toISOString();

function deps(rows: OAuth2TokenRow[], result: "refreshed" | "reconnect_required" | "refresh_failed" = "refreshed") {
  const refreshed: string[] = [];
  const d: OAuth2RefreshDeps = {
    list: async () => rows,
    refresh: async (id) => { refreshed.push(id); return result; },
    now: () => NOW,
  };
  return { d, refreshed };
}

describe("refreshExpiringOAuth2", () => {
  it("leaves a token with plenty of life alone", async () => {
    const { d, refreshed } = deps([{ accountId: "a", platform: "tiktok", expiresAt: at(600) }]);
    expect(await refreshExpiringOAuth2(d)).toEqual([{ accountId: "a", platform: "tiktok", outcome: "not_due" }]);
    expect(refreshed).toEqual([]);
  });

  it("renews a token with under fifty minutes left", async () => {
    const { d, refreshed } = deps([{ accountId: "a", platform: "youtube", expiresAt: at(20) }]);
    expect((await refreshExpiringOAuth2(d))[0].outcome).toBe("refreshed");
    expect(refreshed).toEqual(["a"]);
  });

  it("still tries a token that has already run out, because the refresh token may be good", async () => {
    const { d, refreshed } = deps([{ accountId: "a", platform: "youtube", expiresAt: at(-30) }]);
    await refreshExpiringOAuth2(d);
    expect(refreshed).toEqual(["a"]);
  });

  it("does not act on a token with no recorded expiry", async () => {
    const { d, refreshed } = deps([{ accountId: "a", platform: "x", expiresAt: null }]);
    expect((await refreshExpiringOAuth2(d))[0].outcome).toBe("not_due");
    expect(refreshed).toEqual([]);
  });

  it("uses a window shorter than an hour so a half-hourly schedule never lets one lapse", () => {
    expect(OAUTH2_REFRESH_WINDOW_MS).toBeLessThan(60 * MIN);
    expect(OAUTH2_REFRESH_WINDOW_MS).toBeGreaterThan(30 * MIN);
  });

  it("reports reconnect and failure outcomes and carries no token", async () => {
    for (const outcome of ["reconnect_required", "refresh_failed"] as const) {
      const { d } = deps([{ accountId: "a", platform: "x", expiresAt: at(5) }], outcome);
      const reports = await refreshExpiringOAuth2(d);
      expect(reports[0].outcome).toBe(outcome);
      expect(oauth2NeedsAttention(reports)).toBe(true);
      expect(JSON.stringify(reports)).not.toContain("token");
    }
    expect(oauth2NeedsAttention([{ accountId: "a", platform: "x", outcome: "refreshed" }, { accountId: "b", platform: "x", outcome: "not_due" }])).toBe(false);
  });
});

describe("the wiring", () => {
  const fn = readFileSync("supabase/functions/social-oauth/index.ts", "utf8");
  const publishCron = readFileSync(".github/workflows/social-publish-cron.yml", "utf8");

  it("runs the OAuth 2.0 sweep inside the same secret-guarded branch as Threads", () => {
    const secretCheck = fn.indexOf("Bearer ${cronSecret}");
    const sweep = fn.indexOf("refreshExpiringOAuth2({");
    const operatorLogin = fn.indexOf("const asCaller = createClient");
    expect(secretCheck).toBeGreaterThan(-1);
    expect(sweep).toBeGreaterThan(secretCheck);
    expect(operatorLogin).toBeGreaterThan(sweep);
  });

  it("only sweeps platforms whose strategy is oauth2", () => {
    expect(fn).toContain('PROVIDERS[p].refreshStrategy === "oauth2"');
  });

  it("renews tokens before the publishing worker is called, without making that step fatal", () => {
    const renew = publishCron.indexOf("Renew expiring platform tokens first");
    const drain = publishCron.indexOf("Drain the publishing queue");
    expect(renew).toBeGreaterThan(-1);
    expect(drain).toBeGreaterThan(renew);
    const step = publishCron.slice(renew, drain);
    expect(step).toContain("functions/v1/social-oauth");
    expect(step).not.toContain("functions/v1/social-publish");
    expect(step).toContain("|| true");
  });
});
