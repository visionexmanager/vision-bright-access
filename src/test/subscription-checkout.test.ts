import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkoutPath,
  displayWhatsAppNumber,
  fillTemplate,
  isTransferMethod,
  normalizeWhatsAppNumber,
  PAYMENT_METHODS,
  paymentWhatsAppLink,
  PLAN_MONTHS,
  planTotal,
} from "@/lib/billing/whatsappCheckout";

// Plans are paid through the owner on WhatsApp: the checkout files an order and
// opens a chat with it already written, and only an admin approving the order
// activates a plan. These pin the three things that must not drift — the link,
// the database's refusal to let a client activate anything, and the way in.

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261013000000_subscription_orders.sql");
const LOCALES = ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"];

/** One translated string, read out of a dictionary's source. */
function localeString(source: string, key: string): string {
  const prefix = `  ${JSON.stringify(key)}: `;
  const line = source.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  expect(line, key).toBeTruthy();
  return JSON.parse(line!.slice(prefix.length).replace(/,$/, "")) as string;
}

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
    const message = "الطلب: VX-ABC123\nالخطة: Business & more?";
    const link = paymentWhatsAppLink("96170123456", message);
    expect(link.startsWith("https://wa.me/96170123456?text=")).toBe(true);
    expect(link).not.toMatch(/\s/);
    expect(link.match(/\?/g)).toHaveLength(1);
    expect(decodeURIComponent(link.slice(link.indexOf("?text=") + 6))).toBe(message);
  });

  it("fills named placeholders and leaves an unknown one visible", () => {
    expect(fillTemplate("Order {reference} for {plan} {missing}", { reference: "VX-1", plan: "Business" }))
      .toBe("Order VX-1 for Business {missing}");
  });

  it("names the checkout path by plan", () => {
    expect(checkoutPath("business")).toBe("/pricing/checkout/business");
  });

  it("sends OMT and Whish to a number and a card to a link", () => {
    expect(isTransferMethod("omt")).toBe(true);
    expect(isTransferMethod("whish")).toBe(true);
    expect(isTransferMethod("card")).toBe(false);
    expect(displayWhatsAppNumber("96170750609")).toBe("+96170750609");
  });

  it("offers the durations the database accepts, priced to the cent", () => {
    expect([...PLAN_MONTHS]).toEqual([1, 3, 6, 12]);
    expect(migration).toContain("CHECK (months IN (1, 3, 6, 12))");
    expect(planTotal(7, 12)).toBe(84);
    expect(planTotal(4.99, 3)).toBe(14.97);
  });

  it("writes the order, plan, duration, amount and method in every language, and nothing that identifies the sender", () => {
    for (const locale of LOCALES) {
      const source = read(`src/i18n/${locale}.ts`);
      for (const key of ["planCheckout.whatsappMessage", "planCheckout.transferMessage"]) {
        const message = localeString(source, key);
        for (const placeholder of ["{reference}", "{plan}", "{months}", "{price}", "{method}"]) {
          expect(message, `${locale} ${key} ${placeholder}`).toContain(placeholder);
        }
        expect(message, `${locale} ${key}`).not.toMatch(/\{(email|name|phone|user)\}/);
      }
      const body = localeString(source, "planCheckout.transferBody");
      for (const placeholder of ["{amount}", "{method}", "{reference}"]) {
        expect(body, `${locale} transferBody ${placeholder}`).toContain(placeholder);
      }
      for (const months of PLAN_MONTHS) localeString(source, `planCheckout.months.${months}`);
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
    expect(migration).toMatch(/FUNCTION public\.create_subscription_order\(\s*_plan_id text,\s*_payment_method text,\s*_months integer DEFAULT 1\s*\)/);
    const create = functionBody("create_subscription_order");
    expect(create).toContain("SELECT b.price_monthly_usd * _months INTO _price");
    expect(create).toContain("IF _months IS NULL OR _months NOT IN (1, 3, 6, 12) THEN");
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
      "create_subscription_order(text, text, integer)",
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
    // Seeded with the owner's number, so checkout works the moment it deploys.
    expect(migration).toContain(`SELECT 'subscription_payment_whatsapp', '"+96170750609"'::jsonb`);
  });

  it("no longer offers the upgrade that activated a plan without a payment", () => {
    expect(read("src/services/ai-media-studio/billingService.ts")).not.toContain('action: "upgrade"');
    expect(read("src/pages/services/ai-media-studio/components/billing/UpgradeDialog.tsx")).not.toContain("upgrade.mutate");
  });
});
