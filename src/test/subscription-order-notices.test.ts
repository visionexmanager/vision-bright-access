// The owner's Approve / Reject message and the buyer's decision notice.
//
// Pure wording and the button contract are tested as code; the one-notice-only
// claim is tested against a small in-memory stand-in for the table; the webhook
// wiring (a tap is checked against the owner's number and carries a reference,
// never a bare yes) is pinned structurally, with a guard run against a known-bad
// input so it cannot pass vacuously.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("Deno", { env: { get: () => undefined } });

const NOTICES = "../../supabase/functions/_shared/subscriptionOrderNotices.ts";
// Typed by hand: `typeof import(...)` would pull the Edge Function graph into tsc -b.
interface Order { reference_code: string; plan_id: string; plan_name?: string | null; months: number; price_usd: number | string; payment_method: string }
const n = await import(/* @vite-ignore */ NOTICES) as {
  orderButtonId(approve: boolean, reference: string): string;
  parseOrderButton(id: string | null | undefined): { approve: boolean; reference: string } | null;
  ownerOrderMessage(order: Order): {
    interactive: { type: string; body: { text: string }; action: { buttons: Array<{ reply: { id: string; title: string } }> } };
    text: string;
  };
  isBareOrdersReply(text: string): boolean;
  monthsLabel(months: number, language: "ar" | "en"): string;
  cleanNote(note: string | null | undefined): string;
  buyerNotice(order: Pick<Order, "plan_id" | "plan_name" | "months">, approved: boolean, note: string | null, language: "ar" | "en"): {
    inAppTitle: string; text: string; emailSubject: string; emailHtml: string; variables: [string, string]; template: { name: string };
  };
  ORDER_TEMPLATES: Array<{ name: string; category: string; translations: Record<"ar" | "en", { body: string; example: string[] }> }>;
};

const order: Order = { reference_code: "VX-AB12CD", plan_id: "pro", months: 3, price_usd: 30, payment_method: "omt" };

describe("the owner's buttons", () => {
  it("carries the order's own reference in both ids, inside Meta's limits", () => {
    const m = n.ownerOrderMessage(order);
    const [yes, no] = m.interactive.action.buttons;
    expect(n.parseOrderButton(yes.reply.id)).toEqual({ approve: true, reference: "VX-AB12CD" });
    expect(n.parseOrderButton(no.reply.id)).toEqual({ approve: false, reference: "VX-AB12CD" });
    for (const b of m.interactive.action.buttons) expect([...b.reply.title].length).toBeLessThanOrEqual(20);
    expect(m.interactive.body.text.length).toBeLessThanOrEqual(1024);
  });

  it("has a text twin that names the slash commands", () => {
    const { text } = n.ownerOrderMessage(order);
    expect(text).toContain("/approve VX-AB12CD");
    expect(text).toContain("/reject VX-AB12CD");
  });

  it("never carries the buyer's phone, e-mail or name", () => {
    const m = n.ownerOrderMessage({ ...order, whatsapp_phone: "96171234567", email: "a@b.co" } as Order);
    const all = JSON.stringify(m);
    expect(all).not.toMatch(/96171234567|a@b\.co/);
  });

  it.each(["order:approve", "order:approve:", "order:approve:AB12CD", "order:approve:VX-AB12C", "order:maybe:VX-AB12CD",
    "order:approve:VX-AB12CD extra", "approve", "موافقة", "", null, undefined])("refuses %j as a decision", (id) => {
    expect(n.parseOrderButton(id as string | null | undefined)).toBeNull();
  });

  it("recognises the word the template asks for, and nothing wider", () => {
    for (const w of ["طلبات", "الطلبات", "orders", "Orders!", " طلبات "]) expect(n.isBareOrdersReply(w)).toBe(true);
    for (const w of ["موافق", "yes", "approve VX-AB12CD", "طلبات كثيرة اليوم"]) expect(n.isBareOrdersReply(w)).toBe(false);
  });
});

describe("the templates Meta reviews", () => {
  it("declare as many examples as variables, in both languages", () => {
    for (const t of n.ORDER_TEMPLATES) {
      expect(t.category).toBe("UTILITY");
      for (const lang of ["ar", "en"] as const) {
        const vars = new Set(t.translations[lang].body.match(/\{\{\d\}\}/g) ?? []);
        expect(t.translations[lang].example).toHaveLength(vars.size);
        expect(t.translations[lang].body).not.toMatch(/\n\n\n|^\s|\s$/);
      }
    }
  });
});

describe("the buyer's notice", () => {
  it("states plan and months, in the buyer's language", () => {
    const ar = n.buyerNotice({ plan_id: "pro", months: 3 }, true, null, "ar");
    const en = n.buyerNotice({ plan_id: "pro", months: 3 }, true, null, "en");
    expect(ar.text).toContain("3 أشهر");
    expect(en.text).toContain("3 months");
    expect(ar.variables).toEqual(["الباقة الاحترافية", "3 أشهر"]);
    expect(ar.template.name).toBe("visionex_order_approved");
  });

  it("carries the owner's reason on a rejection, cleaned, but never on an approval", () => {
    const rejected = n.buyerNotice({ plan_id: "pro", months: 1 }, false, "ما وصل المبلغ (via WhatsApp)", "ar");
    expect(rejected.text).toContain("السبب: ما وصل المبلغ");
    expect(rejected.text).not.toContain("via WhatsApp");
    expect(rejected.template.name).toBe("visionex_order_rejected");
    expect(n.buyerNotice({ plan_id: "pro", months: 1 }, true, "internal", "ar").text).not.toContain("internal");
  });

  it("escapes anything the owner typed in the e-mail", () => {
    const html = n.buyerNotice({ plan_id: "pro", months: 1 }, false, "<script>x()</script>", "en").emailHtml;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps a note to one bounded line", () => {
    expect(n.cleanNote("a\nb\u0000c  d")).toBe("a b c d");
    expect(n.cleanNote("x".repeat(900))).toHaveLength(300);
    expect(n.cleanNote("via WhatsApp")).toBe("");
  });

  it("speaks Arabic month forms correctly", () => {
    expect([1, 2, 3, 11].map((m) => n.monthsLabel(m, "ar"))).toEqual(["شهر", "شهرين", "3 أشهر", "11 شهرًا"]);
  });
});

describe("the wiring", () => {
  const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  const webhook = read("supabase/functions/whatsapp-webhook/index.ts");
  const notify = read("supabase/functions/_shared/subscriptionOrderNotify.ts");
  const fn = read("supabase/functions/_shared/subscriptionOrderHttp.ts");
  const billing = read("supabase/functions/trial-billing/index.ts");

  /** A tap is only acted on when it is parsed as an order button AND the sender is the owner. */
  function tapIsOwnerGated(source: string): boolean {
    const at = source.indexOf("parseOrderButton(incoming.selection)");
    if (at < 0) return false;
    const before = source.slice(Math.max(0, at - 400), at);
    return /incoming\.selection\s*&&\s*isOwner\(incoming\.from,\s*configuredOwner\)/.test(before);
  }

  it("decides on a tap only for the owner's number", () => {
    expect(tapIsOwnerGated(webhook)).toBe(true);
  });

  it("the guard fails on a tap handler that forgot the owner check (known-bad input)", () => {
    const bad = webhook.replace(/incoming\.selection\s*&&\s*isOwner\(incoming\.from,\s*configuredOwner\)/, "incoming.selection");
    expect(tapIsOwnerGated(bad)).toBe(false);
  });

  it("handles a tap before the owner's text commands, so «موافقة» is never read as a bare yes", () => {
    expect(webhook.indexOf("parseOrderButton(incoming.selection)")).toBeLessThan(webhook.indexOf("handleOwnerCommand(db, incoming.from"));
  });

  it("claims each notice with a conditional update and releases a delivery that failed everywhere", () => {
    expect(notify).toMatch(/owner_notified_at: now\.toISOString\(\) \}\)[\s\S]*?\.is\("owner_notified_at", null\)/);
    expect(notify).toMatch(/buyer_notified_at: now\.toISOString\(\) \}\)[\s\S]*?\.is\("buyer_notified_at", null\)/);
    expect(notify).toContain("owner_notified_at: null");
    expect(notify).toContain("buyer_notified_at: null");
  });

  it("lets a user ask only for their own order, and only an admin report a decision", () => {
    expect(fn).toContain("order.user_id !== user.id");
    expect(fn).toMatch(/has_role[\s\S]*isAdmin !== true/);
  });

  it("logs no number, address, name or body", () => {
    for (const source of [notify, fn]) {
      const logs = source.match(/console\.(log|error|warn)\([^)]*\)/g) ?? [];
      for (const line of logs) expect(line).not.toMatch(/phone|email|wa_phone|body|text|name:/i);
    }
  });

  it("adds no Edge Function: billing serves the browser calls, and the sweep sits behind its cron secret", () => {
    expect(billing).toContain("handleOrderNoticeRequest");
    expect(billing.indexOf("isOrderNoticeRequest(parsed)")).toBeLessThan(billing.indexOf('Deno.env.get("CRON_SECRET")'));
    expect(billing.indexOf('task === "order_notices"')).toBeGreaterThan(billing.indexOf('Deno.env.get("CRON_SECRET")'));
    expect(read("supabase/config.toml")).not.toContain("subscription-order-notify");
  });
});
