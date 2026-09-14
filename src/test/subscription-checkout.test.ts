import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkoutPath,
  fillTemplate,
  normalizeWhatsAppNumber,
  PAYMENT_METHODS,
  paymentWhatsAppLink,
} from "@/lib/billing/whatsappCheckout";

// Plans are paid through the owner on WhatsApp: the checkout files an order and
// opens a chat with it already written, and only an admin approving the order
// activates a plan. These pin the three things that must not drift — the link,
// the database's refusal to let a client activate anything, and the way in.

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261013000000_subscription_orders.sql");
const LOCALES = ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"];

/** The body of one SQL function, from its signature to its closing `$$;`. */
function functionBody(name: string): string {
  const start = migration.indexOf(`FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf("$$;", start));
}

describe("the WhatsApp link", () => {
  it("reads a number however an admin typed it", () => {
    expect(normalizeWhatsAppNumber("+961 70 123 456")).toBe("96170123456");
    expect(normalizeWhatsAppNumber("0096170123456")).toBe("96170123456");
    expect(normalizeWhatsAppNumber("(961) 70-123-456")).toBe("96170123456");
    for (const nothing of ["", "   ", "12345", null, undefined, 96170123456, "1234567890123456"]) {
      expect(normalizeWhatsAppNumber(nothing), String(nothing)).toBeNull();
    }
  });

  it("carries Arabic and line breaks through wa.me intact", () => {
    const message = "الطلب: VX-ABC123\nالخطة: Gold & more?";
    const link = paymentWhatsAppLink("96170123456", message);
    expect(link.startsWith("https://wa.me/96170123456?text=")).toBe(true);
    expect(link).not.toMatch(/\s/);
    expect(link.match(/\?/g)).toHaveLength(1);
    expect(decodeURIComponent(link.slice(link.indexOf("?text=") + 6))).toBe(message);
  });

  it("fills named placeholders and leaves an unknown one visible", () => {
    expect(fillTemplate("Order {reference} for {plan} {missing}", { reference: "VX-1", plan: "Gold" }))
      .toBe("Order VX-1 for Gold {missing}");
  });

  it("names the checkout path by plan", () => {
    expect(checkoutPath("gold")).toBe("/pricing/checkout/gold");
  });

  it("writes the order, plan, price and method in every language, and nothing that identifies the sender", () => {
    for (const locale of LOCALES) {
      const source = read(`src/i18n/${locale}.ts`);
      const line = source.match(/^\s{2}"planCheckout\.whatsappMessage": (".*"),\r?$/m);
      expect(line, locale).toBeTruthy();
      const message = JSON.parse(line![1]) as string;
      for (const placeholder of ["{reference}", "{plan}", "{price}", "{method}"]) {
        expect(message, `${locale} ${placeholder}`).toContain(placeholder);
      }
      expect(message, locale).not.toMatch(/\{(email|name|phone|user)\}/);
      for (const method of PAYMENT_METHODS) {
        expect(source, `${locale} ${method}`).toContain(`"planCheckout.method.${method}":`);
        expect(source, `${locale} ${method} hint`).toContain(`"planCheckout.method.${method}Hint":`);
      }
    }
  });
});

describe("subscription orders in the database", () => {
  it("gives the client no way to write an order", () => {
    expect(migration).not.toMatch(/CREATE POLICY[^;]*ON public\.subscription_orders\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)/i);
    // Nor a new door onto the table that decides access.
    expect(migration).not.toMatch(/POLICY[^;]*ON public\.user_subscriptions/i);
  });

  it("takes the price from billing_plans, never from the caller", () => {
    expect(migration).toMatch(/FUNCTION public\.create_subscription_order\(\s*_plan_id text,\s*_payment_method text\s*\)/);
    const create = functionBody("create_subscription_order");
    expect(create).toContain("SELECT b.price_monthly_usd INTO _price");
    expect(create).toContain("b.is_active AND b.price_monthly_usd > 0");
    expect(create).toContain("IF _uid IS NULL THEN");
  });

  it("activates a plan only when an admin approves, and nowhere else", () => {
    for (const name of ["approve_subscription_order", "reject_subscription_order"]) {
      expect(functionBody(name), name).toContain("IF NOT public.has_role(auth.uid(), 'admin') THEN");
      expect(functionBody(name), name).toContain("IF _order.status <> 'pending' THEN");
    }
    expect(migration.match(/INSERT INTO public\.user_subscriptions/g)).toHaveLength(1);
    expect(functionBody("approve_subscription_order")).toContain("INSERT INTO public.user_subscriptions");
  });

  it("keeps anon out and service_role in, for every function", () => {
    for (const signature of [
      "create_subscription_order(text, text)",
      "approve_subscription_order(uuid, text)",
      "reject_subscription_order(uuid, text)",
    ]) {
      expect(migration, signature).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC;`);
      expect(migration, signature).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM anon;`);
      expect(migration, signature).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated, service_role;`);
    }
  });
});

describe("the way there", () => {
  it("registers checkout and the review screen behind their guards", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('<Route path="/pricing/checkout/:planId" element={<AuthGuard><PlanCheckout /></AuthGuard>} />');
    expect(app).toContain('<Route path="/admin/subscription-orders" element={<AdminRoute><AdminSubscriptionOrders /></AdminRoute>} />');
  });

  it("is linked from somewhere a person will click", () => {
    expect(read("src/pages/Pricing.tsx")).toContain("checkoutPath(plan.id)");
    expect(read("src/pages/admin/AdminVX.tsx")).toContain('to="/admin/subscription-orders"');
    expect(read("src/pages/admin/AdminSettings.tsx")).toContain('"subscription_payment_whatsapp",');
  });

  it("no longer offers the upgrade that activated a plan without a payment", () => {
    expect(read("src/services/ai-media-studio/billingService.ts")).not.toContain('action: "upgrade"');
    expect(read("src/pages/services/ai-media-studio/components/billing/UpgradeDialog.tsx")).not.toContain("upgrade.mutate");
  });
});
