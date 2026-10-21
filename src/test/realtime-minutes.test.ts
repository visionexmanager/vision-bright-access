import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  endRealtimeSession, REALTIME_MONTHLY_MESSAGE, reserveRealtimeMinutes,
  type RealtimeMinutesClient,
} from "../../supabase/functions/_shared/realtimeMinutes";

const cors = { "Access-Control-Allow-Origin": "https://visionex.app" };
const client = (reply: () => { data: unknown; error: { code?: string } | null } | Promise<never>): RealtimeMinutesClient => ({
  rpc: vi.fn(async () => reply() as never),
});

describe("reserveRealtimeMinutes", () => {
  it("lets an uncapped plan through with nothing to end later", async () => {
    const r = await reserveRealtimeMinutes(client(() => ({ data: { allowed: true, capped: false }, error: null })), "u", cors);
    expect(r).toEqual({ ok: true, reservation: { reservationId: null, sessionMinutes: null, remainingMinutes: null } });
  });

  it("returns the reservation of a capped plan", async () => {
    const r = await reserveRealtimeMinutes(client(() => ({
      data: { allowed: true, capped: true, reservation_id: "res-1", reserved_minutes: 10, remaining_minutes: 15 }, error: null,
    })), "u", cors);
    expect(r).toEqual({ ok: true, reservation: { reservationId: "res-1", sessionMinutes: 10, remainingMinutes: 15 } });
  });

  it("refuses with a 429 that names neither a plan, a cost nor a provider", async () => {
    const r = await reserveRealtimeMinutes(client(() => ({ data: { allowed: false, reason: "monthly_limit", limit_minutes: 20 }, error: null })), "u", cors);
    expect(r.ok).toBe(false);
    if (!("response" in r)) throw new Error("expected a refusal");
    expect(r.response.status).toBe(429);
    const body = await r.response.json();
    expect(body).toEqual({ error: REALTIME_MONTHLY_MESSAGE });
    expect(JSON.stringify(body)).not.toMatch(/openai|\$|plan|20/i);
  });

  it("fails closed when the RPC errors, throws, or answers nonsense", async () => {
    for (const c of [
      client(() => ({ data: null, error: { code: "42883" } })),
      client(() => Promise.reject(new Error("boom"))),
      client(() => ({ data: "yes", error: null })),
      client(() => ({ data: { allowed: true, capped: true }, error: null })), // capped but no reservation
      client(() => ({ data: { allowed: true, capped: true, reservation_id: "r", reserved_minutes: 0 }, error: null })),
    ]) {
      const r = await reserveRealtimeMinutes(c, "u", cors);
      expect(r.ok).toBe(false);
      expect("response" in r && r.response.status).toBe(503);
    }
  });

  it("never logs the user id", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await reserveRealtimeMinutes(client(() => ({ data: null, error: { code: "x" } })), "secret-user-id", cors);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret-user-id");
    spy.mockRestore();
  });
});

describe("endRealtimeSession", () => {
  it("reports whether the server ended it", async () => {
    expect(await endRealtimeSession(client(() => ({ data: { ended: true }, error: null })), "u", "r")).toBe(true);
    expect(await endRealtimeSession(client(() => ({ data: { ended: false }, error: null })), "u", "r")).toBe(false);
  });

  it("is best effort: an error or a throw returns false instead of failing the caller", async () => {
    expect(await endRealtimeSession(client(() => ({ data: null, error: { code: "x" } })), "u", "r")).toBe(false);
    expect(await endRealtimeSession(client(() => Promise.reject(new Error("net"))), "u", "r")).toBe(false);
  });

  it("passes the failed flag and never a duration", async () => {
    const c = client(() => ({ data: { ended: true }, error: null }));
    await endRealtimeSession(c, "u", "r", true);
    expect(c.rpc).toHaveBeenCalledWith("realtime_end", { _user_id: "u", _reservation_id: "r", _failed: true });
  });
});

describe("realtime-session wiring", () => {
  const src = readFileSync(resolve(process.cwd(), "supabase/functions/realtime-session/index.ts"), "utf8").replace(/\r\n/g, "\n");
  const at = (needle: string) => { const i = src.indexOf(needle); expect(i, needle).toBeGreaterThan(-1); return i; };

  it("reserves minutes after the gate and the daily unit, and before the provider is called", () => {
    expect(at("subscriptionGate(serviceClient")).toBeLessThan(at("chargeDailyLimit("));
    expect(at("chargeDailyLimit(")).toBeLessThan(at("reserveRealtimeMinutes("));
    expect(at("reserveRealtimeMinutes(")).toBeLessThan(at("realtime/client_secrets"));
  });

  it("ends a session without spending a daily unit or reaching the provider", () => {
    const end = at('body.action === "end"');
    expect(end).toBeGreaterThan(at("subscriptionGate(serviceClient"));
    expect(end).toBeLessThan(at("chargeDailyLimit("));
  });

  it("releases the reservation when the provider refuses or the key is missing", () => {
    const refusals = src.match(/endRealtimeSession\(serviceClient, user\.id, reservation\.reservationId, true\)/g) ?? [];
    expect(refusals.length).toBe(2);
  });
});

describe("migration 20261077", () => {
  const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261077000000_realtime_monthly_minutes.sql"), "utf8");
  it("sets no plan value, so applying it changes nothing", () => {
    const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(code).not.toMatch(/(INSERT INTO|UPDATE)\s+public\.billing_plans/i);
  });
  it("grants the functions to service_role only", () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.realtime_reserve\(uuid\) TO service_role/);
    expect(sql).not.toMatch(/GRANT[^;]*TO (anon|authenticated|PUBLIC)/i);
  });
});
