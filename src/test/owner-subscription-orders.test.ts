// Confirming a subscription order from the owner's WhatsApp.
//
// The parser and the replies are tested here as code. The SQL wrapper was also
// executed against a PGlite database with a stand-in for the two functions it
// delegates to (approve, reject, a Supabase-shaped auth.uid()): an admin's
// approval and rejection landed with that admin as reviewer, a second decision,
// an unknown reference, a non-admin actor and no actor were all refused, and
// auth.uid() was null again afterwards. The real approve function needs the
// full billing schema and is not run here.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("Deno", { env: { get: () => undefined } });

const MODULE = "../../supabase/functions/_shared/ownerOrders.ts";
const orders = await import(/* @vite-ignore */ MODULE) as typeof import("../../supabase/functions/_shared/ownerOrders.ts");

const sql = readFileSync("supabase/migrations/20261087000000_owner_review_subscription_order.sql", "utf8").replace(/\r\n/g, "\n");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8").replace(/\r\n/g, "\n");

describe("parsing the owner's message (after the slash)", () => {
  it.each([
    ["approve VX-AB12CD", true],
    ["APPROVE vx-ab12cd", true],
    ["وافق VX-AB12CD", true],
    ["تأكيد VX-AB12CD", true],
    ["confirm VX-AB12CD", true],
  ])("%s approves VX-AB12CD", (body, approve) => {
    expect(orders.parseOrderCommand(body)).toEqual({ kind: "decide", approve, reference: "VX-AB12CD", note: null });
  });

  it("rejects with the reason kept as the note", () => {
    expect(orders.parseOrderCommand("reject VX-AB12CD no transfer received")).toEqual({
      kind: "decide", approve: false, reference: "VX-AB12CD", note: "no transfer received",
    });
    expect(orders.parseOrderCommand("ارفض VX-AB12CD ما وصل المبلغ")).toMatchObject({ approve: false, note: "ما وصل المبلغ" });
  });

  it("lets a reject beat an approve word in the same sentence", () => {
    expect(orders.parseOrderCommand("don't approve, reject VX-AB12CD")).toMatchObject({ approve: false });
  });

  it("lists on /orders in either language", () => {
    for (const word of ["orders", "Orders", "الطلبات", "طلبات"]) expect(orders.parseOrderCommand(word)).toEqual({ kind: "list" });
  });

  it.each([
    ["a bare approval, which is a content proposal's business", "approve"],
    ["a content proposal reference", "approve AB2CD"],
    ["an order reference with no verb", "VX-AB12CD"],
    ["a reference one character short", "approve VX-AB12C"],
    ["an empty message", ""],
    ["an unrelated sentence", "how many users do we have"],
  ])("ignores %s", (_name, body) => {
    expect(orders.parseOrderCommand(body)).toBeNull();
  });
});

describe("deciding", () => {
  const command = { kind: "decide", approve: true, reference: "VX-AB12CD", note: null } as const;

  /** A database stand-in: one admin lookup and one rpc. */
  function db(rpc: unknown, admin: string | null = "admin-1") {
    const calls: Array<[string, Record<string, unknown>]> = [];
    return {
      calls,
      from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: admin ? { user_id: admin } : null }) }) }) }) }),
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push([name, args]);
        return rpc;
      },
    };
  }

  it("calls the one wrapper with the admin the owner acts as, and says what was granted", async () => {
    const d = db({ data: { ok: true, plan: "Kids", months: 3 }, error: null });
    const reply = await orders.decideOrder(d, command);
    expect(d.calls).toEqual([["owner_review_subscription_order", {
      _reference: "VX-AB12CD", _approve: true, _actor_id: "admin-1", _note: "via WhatsApp",
    }]]);
    expect(reply).toContain("Kids × 3 شهر");
    expect(reply).toContain("✅");
  });

  it("marks the reason as WhatsApp-sourced when rejecting", async () => {
    const d = db({ data: { ok: true, plan: "Kids", months: 1 }, error: null });
    await orders.decideOrder(d, { kind: "decide", approve: false, reference: "VX-AB12CD", note: "no payment" });
    expect(d.calls[0][1]).toMatchObject({ _approve: false, _note: "no payment (via WhatsApp)" });
  });

  it.each([
    [{ ok: false, error: "already_reviewed", status: "approved" }, "سبق البتّ فيه (مقبول)"],
    [{ ok: false, error: "already_reviewed", status: "rejected" }, "(مرفوض)"],
    [{ ok: false, error: "not_found" }, "لا يوجد طلب"],
  ])("explains %j", async (data, text) => {
    expect(await orders.decideOrder(db({ data, error: null }), command)).toContain(text);
  });

  it("answers a database error with a sentence, not the database's words", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reply = await orders.decideOrder(db({ data: null, error: { code: "42501", message: "permission denied for table subscription_orders" } }), command);
    expect(reply).toBe("تعذّر تسجيل القرار. جرّب مرة أخرى.");
    expect(reply).not.toContain("subscription_orders");
    expect(spy.mock.calls.flat().join(" ")).not.toContain("permission denied");
    spy.mockRestore();
  });

  it("does not call the database when there is no admin to record the decision under", async () => {
    const d = db({ data: { ok: true }, error: null }, null);
    expect(await orders.decideOrder(d, command)).toContain("لا يوجد حساب مدير");
    expect(d.calls).toHaveLength(0);
  });
});

describe("the list", () => {
  it("shows reference, plan, months, price and method, and no buyer details", () => {
    const text = orders.formatOrderList([
      { reference_code: "VX-AB12CD", plan_id: "kids", months: 3, price_usd: "9", payment_method: "omt", created_at: "2026-10-23T10:00:00Z" },
    ]);
    expect(text).toContain("VX-AB12CD — kids × 3 شهر — $9.00 — OMT");
    expect(text).not.toMatch(/@|\+\d{6,}/);
  });

  it("says so when nothing is waiting", () => {
    expect(orders.formatOrderList([])).toContain("لا توجد طلبات");
  });
});

describe("the migration", () => {
  it("is callable by service_role alone, and by name", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.owner_review_subscription_order\(text, boolean, uuid, text\) FROM PUBLIC, anon, authenticated;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.owner_review_subscription_order\(text, boolean, uuid, text\) TO service_role;/);
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*\) TO [^;]*\b(authenticated|anon|PUBLIC)\b/i);
  });

  it("refuses an actor who is not an admin, and delegates rather than copying the rules", () => {
    expect(sql).toMatch(/NOT public\.has_role\(_actor_id, 'admin'\)/);
    expect(sql).toContain("PERFORM public.approve_subscription_order(");
    expect(sql).toContain("PERFORM public.reject_subscription_order(");
    expect(sql).not.toMatch(/INSERT INTO public\.user_subscriptions/);
  });

  it("scopes the borrowed identity to the transaction", () => {
    const sets = sql.match(/set_config\([^;]*\)/g) ?? [];
    expect(sets.length).toBe(2);
    for (const s of sets) expect(s.replace(/\s+/g, " ")).toMatch(/, true\)$/);
  });
});

describe("webhook wiring", () => {
  it("reads order commands for the owner only, before the help fallback, and writes an audit row", () => {
    const owner = webhook.indexOf("isOwner(incoming.from, configuredOwner)");
    const order = webhook.indexOf("parseOrderCommand(ownerCommandBody(text)");
    const help = webhook.indexOf('command.kind === "help" || (command.kind === "unknown"');
    expect(owner).toBeGreaterThan(-1);
    expect(order).toBeGreaterThan(-1);
    expect(order).toBeLessThan(help);
    expect(webhook.slice(order, order + 700)).toContain("owner_command_order_");
  });

  it("is reached only through handleOwnerCommand", () => {
    expect(webhook.match(/parseOrderCommand\(/g)).toHaveLength(1);
    const fn = webhook.slice(webhook.indexOf("async function handleOwnerCommand("), webhook.indexOf("async function handleOwnerCommand(") + 6000);
    expect(fn).toContain("parseOrderCommand(");
  });
});
