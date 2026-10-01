import { beforeEach, describe, expect, it } from "vitest";
import type { Actor, Ctx } from "../src/actions.js";
import { harness, type Harness } from "./helpers.js";

const ctx: Ctx = { source: "WEB", ip: "203.0.113.5" };
const actor = (id = "11111111-1111-4111-8111-111111111111", role: Actor["role"] = "ADMIN"): Actor => ({ type: "ADMIN_USER", id, role, label: "tester" });
let h: Harness;
beforeEach(async () => {
  h = await harness();
});

const audits = async () => (await h.c.db.query<{ action: string; result: string }>("SELECT action, result FROM audit_logs ORDER BY id")).rows;

describe("two-step actions", () => {
  it("request changes nothing; confirm suspends, verifies with a fresh read, and audits", async () => {
    const p = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    expect(p).toMatchObject({ currentStatus: "ACTIVE", resultingStatus: "SUSPENDED", state: "PENDING" });
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
    const r = await h.c.actions.confirm(actor(), ctx, p.id);
    expect(r).toMatchObject({ ok: true, state: "SUCCEEDED", replayed: false });
    expect(h.providers.data.get("1001")!.status).toBe("SUSPENDED");
    expect((await audits()).map((a) => `${a.action}:${a.result}`)).toEqual(["SERVICE_SUSPEND:REQUESTED", "SERVICE_SUSPEND:SUCCESS"]);
  });

  it("is idempotent: a redelivered request returns the same pending row", async () => {
    const a = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    const b = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    expect(b.id).toBe(a.id);
    expect((await h.c.db.query("SELECT 1 FROM pending_actions")).rowCount).toBe(1);
  });

  it("a double confirm runs the operation once and replays the stored outcome", async () => {
    const p = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    const [x] = await Promise.all([h.c.actions.confirm(actor(), ctx, p.id), h.c.actions.confirm(actor(), ctx, p.id).catch((e) => e)]);
    expect(x.ok).toBe(true);
    expect(h.providers.calls.filter((c) => c === "radius.disable")).toHaveLength(1);
    const z = await h.c.actions.confirm(actor(), ctx, p.id);
    expect(z).toMatchObject({ ok: true, replayed: true });
    expect(h.providers.calls.filter((c) => c === "radius.disable")).toHaveLength(1);
  });

  it("reusing a key for a different target is refused", async () => {
    await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    await expect(h.c.actions.request(actor(), ctx, "SUSPEND", "1002", "key-0000001")).rejects.toMatchObject({ code: "IDEMPOTENCY_MISMATCH" });
  });

  it("another admin cannot see, confirm or cancel someone else's request (IDOR)", async () => {
    const p = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    const other = actor("22222222-2222-4222-8222-222222222222");
    await expect(h.c.actions.confirm(other, ctx, p.id)).rejects.toMatchObject({ status: 404 });
    await expect(h.c.actions.cancel(other, ctx, p.id)).rejects.toMatchObject({ status: 404 });
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
  });

  it("an expired request cannot be confirmed", async () => {
    const p = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    h.clock.t += 3 * 60_000;
    await expect(h.c.actions.confirm(actor(), ctx, p.id)).rejects.toMatchObject({ code: "EXPIRED" });
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
  });

  it("aborts if the customer changed between request and confirm", async () => {
    const p = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    h.providers.data.get("1001")!.status = "EXPIRED";
    const r = await h.c.actions.confirm(actor(), ctx, p.id);
    expect(r).toMatchObject({ ok: false, errorCode: "STATE_CHANGED" });
    expect(h.providers.calls).not.toContain("radius.disable");
  });

  it("never reports success when the read-back does not show the change", async () => {
    const p = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    h.providers.ignoreWrites = true;
    const r = await h.c.actions.confirm(actor(), ctx, p.id);
    expect(r).toMatchObject({ ok: false, errorCode: "VERIFICATION_FAILED" });
    expect((await audits()).at(-1)).toMatchObject({ result: "FAILURE" });
  });

  it("reports a provider failure accurately and without internals", async () => {
    const p = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    h.providers.failNext = "radius.disable";
    const r = await h.c.actions.confirm(actor(), ctx, p.id);
    expect(r).toMatchObject({ ok: false, errorCode: "UPSTREAM_ERROR" });
    expect(r.message).not.toMatch(/injected|Error/);
  });

  it("refuses transitions the current state does not allow, and unknown state", async () => {
    await expect(h.c.actions.request(actor(), ctx, "RESUME", "1001", "key-0000001")).rejects.toMatchObject({ code: "INVALID_STATE" });
    h.providers.data.get("1001")!.status = "UNKNOWN";
    await expect(h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000002")).rejects.toMatchObject({ code: "STATE_UNKNOWN" });
  });

  it("rejects malformed customer ids before touching the provider", async () => {
    for (const id of ["1001; DROP TABLE customers", "../etc/passwd", "a".repeat(80), ""])
      await expect(h.c.actions.request(actor(), ctx, "SUSPEND", id, "key-0000001")).rejects.toMatchObject({ status: 400 });
    expect(h.providers.calls).toHaveLength(0);
  });

  it("termination is never executed (no provider support, flag off)", async () => {
    await expect(h.c.actions.request(actor("1", "SUPER_ADMIN"), ctx, "TERMINATE", "1001", "key-0000001")).rejects.toMatchObject({ status: 409 });
  });
});

describe("authorisation, flags and the kill switch", () => {
  it("READ_ONLY_ADMIN is denied and the denial is audited", async () => {
    await expect(h.c.actions.request(actor("r", "READ_ONLY_ADMIN"), ctx, "SUSPEND", "1001", "key-0000001")).rejects.toMatchObject({ status: 403 });
    expect((await audits())[0]).toMatchObject({ result: "DENIED" });
  });

  it("the kill switch blocks new requests and pending confirms, while reads continue", async () => {
    const p = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    await h.c.gate.set({ allWrites: true, whatsappWrites: false, radiusWrites: false }, "owner");
    const r = await h.c.actions.confirm(actor(), ctx, p.id);
    expect(r).toMatchObject({ ok: false, errorCode: "ACTIONS_DISABLED" });
    await expect(h.c.actions.request(actor(), ctx, "SUSPEND", "1002", "key-0000009")).rejects.toMatchObject({ code: "ACTIONS_DISABLED" });
    expect(await h.c.directory.profile(actor(), ctx, "1001")).toBeTruthy();
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
  });

  it("a feature flag that is off in the environment cannot be overridden", async () => {
    const off = await harness({ ENABLE_CUSTOMER_SUSPENSION: "false" });
    await expect(off.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001")).rejects.toMatchObject({ code: "ACTIONS_DISABLED" });
  });

  it("the WhatsApp-only switch blocks WhatsApp but not the web", async () => {
    await h.c.gate.set({ allWrites: false, whatsappWrites: true, radiusWrites: false }, "owner");
    await expect(h.c.actions.request(actor(), { source: "WHATSAPP" }, "SUSPEND", "1001", "key-0000001")).rejects.toMatchObject({ code: "ACTIONS_DISABLED" });
    expect((await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000002")).state).toBe("PENDING");
  });

  it("the worker flags an execution that never finished", async () => {
    const p = await h.c.actions.request(actor(), ctx, "SUSPEND", "1001", "key-0000001");
    await h.c.db.query("UPDATE pending_actions SET status='EXECUTING', executed_at=$2 WHERE id=$1", [p.id, new Date(h.clock.t - 10 * 60_000).toISOString()]);
    expect(await h.c.actions.sweep()).toMatchObject({ interrupted: 1 });
    expect((await h.c.db.query("SELECT 1 FROM system_events WHERE severity='CRITICAL'")).rowCount).toBe(1);
  });
});

describe("customer reads", () => {
  it("rejects wildcard and too-short searches", async () => {
    for (const q of ["%", "ab", "a%b", "us_r", "*"]) await expect(h.c.directory.search(actor(), ctx, q)).rejects.toMatchObject({ status: 400 });
  });
  it("treats SQL metacharacters as plain text", async () => {
    const r = await h.c.directory.search(actor(), ctx, "' OR 1=1 --");
    expect(r.items).toEqual([]);
  });
  it("reads work for every role that may read", async () => {
    expect((await h.c.directory.profile(actor("r", "READ_ONLY_ADMIN"), ctx, "1001")).radius).toBeDefined();
    expect((await h.c.directory.profile(actor("w", "WHATSAPP_ADMIN"), ctx, "1001")).customer.username).toBe("user1001");
  });
  it("caches the customer and keeps the search text out of the audit log", async () => {
    await h.c.directory.profile(actor(), ctx, "1001");
    expect((await h.c.db.query("SELECT 1 FROM customers WHERE external_customer_id='1001'")).rowCount).toBe(1);
    await h.c.directory.search(actor(), ctx, "user1001");
    const a = await h.c.db.query<{ metadata: object }>("SELECT metadata FROM audit_logs WHERE action='CUSTOMER_SEARCH'");
    expect(JSON.stringify(a.rows[0]!.metadata)).not.toContain("user1001");
  });
  it("flags scraping: many distinct customers in minutes", async () => {
    for (let i = 0; i < 55; i++) h.providers.data.set(`c${i}`, { externalId: `c${i}`, username: `u${i}`, status: "ACTIVE" });
    for (let i = 0; i < 55; i++) await h.c.directory.profile({ ...actor(), id: "scraper" }, ctx, `c${i}`, {}).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 50));
    expect((await h.c.db.query("SELECT 1 FROM system_events WHERE event_type='ENUMERATION_SUSPECTED'")).rowCount).toBeGreaterThan(0);
  });
});
