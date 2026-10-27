import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  needsAttention,
  refreshExpiringThreads,
  type RefreshDeps,
  type ThreadsTokenRow,
} from "../../supabase/functions/_shared/publishing/threadsTokenRefresh.ts";

// A Threads token lives about 60 days and can be extended only while it is
// valid and at least a day old. Nothing extended it, so the connection made
// today would have died in December. This is the sweep that does.

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-25T04:17:00Z");
const iso = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString();

function deps(rows: ThreadsTokenRow[], over: Partial<RefreshDeps> = {}) {
  const stored: Array<{ id: string; token: string; expiresAt: string | null }> = [];
  const extended: string[] = [];
  const base: RefreshDeps = {
    list: async () => rows,
    accessToken: async () => "current-token",
    extend: async (token) => { extended.push(token); return { ok: true, accessToken: "new-token", expiresAt: iso(60) }; },
    store: async (id, token, expiresAt) => { stored.push({ id, token, expiresAt }); return true; },
    now: () => NOW,
  };
  return { deps: { ...base, ...over }, stored, extended };
}

describe("refreshExpiringThreads", () => {
  it("leaves a token with plenty of life alone", async () => {
    const { deps: d, extended } = deps([{ accountId: "a", expiresAt: iso(45), writtenAt: iso(-15) }]);
    const reports = await refreshExpiringThreads(d);
    expect(reports).toEqual([{ accountId: "a", outcome: "not_due", expiresAt: iso(45) }]);
    expect(extended).toEqual([]);
  });

  it("extends a token with thirty days or less left and stores the new one", async () => {
    const { deps: d, stored, extended } = deps([{ accountId: "a", expiresAt: iso(29), writtenAt: iso(-31) }]);
    const reports = await refreshExpiringThreads(d);
    expect(reports[0]).toMatchObject({ accountId: "a", outcome: "refreshed", expiresAt: iso(60) });
    expect(extended).toEqual(["current-token"]);
    expect(stored).toEqual([{ id: "a", token: "new-token", expiresAt: iso(60) }]);
  });

  it("does not try a token younger than a day, which Threads refuses", async () => {
    const { deps: d, extended } = deps([{ accountId: "a", expiresAt: iso(20), writtenAt: new Date(NOW - 3600_000).toISOString() }]);
    const reports = await refreshExpiringThreads(d);
    expect(reports[0].outcome).toBe("too_young");
    expect(extended).toEqual([]);
  });

  it("asks for a reconnect when the token has already expired", async () => {
    const { deps: d, extended } = deps([{ accountId: "a", expiresAt: iso(-1), writtenAt: iso(-61) }]);
    const reports = await refreshExpiringThreads(d);
    expect(reports[0].outcome).toBe("reconnect_required");
    expect(extended).toEqual([]);
  });

  it("asks for a reconnect when the stored token cannot be read", async () => {
    const { deps: d } = deps([{ accountId: "a", expiresAt: iso(10), writtenAt: iso(-50) }], { accessToken: async () => null });
    expect((await refreshExpiringThreads(d))[0].outcome).toBe("reconnect_required");
  });

  it("reports a refusal from Threads and a failed store separately", async () => {
    const refused = deps([{ accountId: "a", expiresAt: iso(10), writtenAt: iso(-50) }], { extend: async () => ({ ok: false }) });
    expect((await refreshExpiringThreads(refused.deps))[0].outcome).toBe("refresh_failed");

    const unsaved = deps([{ accountId: "a", expiresAt: iso(10), writtenAt: iso(-50) }], { store: async () => false });
    expect((await refreshExpiringThreads(unsaved.deps))[0].outcome).toBe("store_failed");
  });

  it("does nothing for a token with no recorded expiry", async () => {
    const { deps: d, extended } = deps([{ accountId: "a", expiresAt: null, writtenAt: iso(-5) }]);
    expect((await refreshExpiringThreads(d))[0].outcome).toBe("not_due");
    expect(extended).toEqual([]);
  });

  it("carries no token in its report", async () => {
    const { deps: d } = deps([{ accountId: "a", expiresAt: iso(10), writtenAt: iso(-50) }]);
    expect(JSON.stringify(await refreshExpiringThreads(d))).not.toContain("token");
  });
});

describe("needsAttention", () => {
  it("is true only for the outcomes a person must act on", () => {
    expect(needsAttention([{ accountId: "a", outcome: "refreshed" }, { accountId: "b", outcome: "not_due" }, { accountId: "c", outcome: "too_young" }])).toBe(false);
    for (const outcome of ["reconnect_required", "refresh_failed", "store_failed"] as const) {
      expect(needsAttention([{ accountId: "a", outcome }])).toBe(true);
    }
  });
});

describe("the wiring", () => {
  const fn = readFileSync("supabase/functions/social-oauth/index.ts", "utf8");
  const workflow = readFileSync(".github/workflows/social-token-refresh.yml", "utf8");

  it("lives in social-oauth, which cannot publish, behind the cron secret", () => {
    const secretCheck = fn.indexOf("Bearer ${cronSecret}");
    const job = fn.indexOf('cronBody.action !== "refresh_tokens"');
    expect(secretCheck).toBeGreaterThan(-1);
    expect(job).toBeGreaterThan(secretCheck);
    // A caller holding the secret may do this one thing and nothing else.
    expect(fn).toContain('if (cronBody.action !== "refresh_tokens") return json({ error: "Unauthorized" }, 401);');
  });

  it("never reaches the publishing worker", () => {
    expect(workflow).not.toContain("functions/v1/social-publish");
    expect(workflow).toContain("functions/v1/social-oauth");
  });

  it("runs every half hour and fails the job when a person must act", () => {
    expect(workflow).toMatch(/schedule:\s*\r?\n\s*- cron: "17,47 \* \* \* \*"/);
    expect(workflow).toContain("refresh_tokens");
    expect(workflow).toContain("exit 1");
  });

  it("never prints a token, a handle or a response body", () => {
    expect(workflow).not.toMatch(/cat response\.json/);
    expect(workflow).toContain("{accountId, outcome, expiresAt}");
  });
});
