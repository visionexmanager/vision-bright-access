// ─── Shared PayPal helpers (Phase 10 — Marketplace payment rails) ─────────
// Used by library-paypal-checkout (create order) and library-paypal-webhook
// (verify + capture). Uses the LIVE API host; point PAYPAL_API_BASE at
// api-m.sandbox.paypal.com via env override for testing once real sandbox
// credentials exist — this repo has none, so this integration is
// unverified end-to-end (documented in both functions' headers).

export const PAYPAL_API_BASE = Deno.env.get("PAYPAL_API_BASE") || "https://api-m.paypal.com";

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal is not configured (missing PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET)");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("Failed to authenticate with PayPal");
  const data = await res.json();
  return data.access_token as string;
}

/** PayPal Orders v2 has no free-form metadata bag like Stripe — custom_id
 *  (127 chars max, one per purchase_unit) is the only pass-through field, so
 *  the webhook's pricing_model/buyer_id routing information travels there
 *  as compact JSON. reference_id carries the book_id/bundle_id itself. */
export function encodeCustomId(pricingModel: string, buyerId: string, extra?: Record<string, string>): string {
  return JSON.stringify({ pm: pricingModel, uid: buyerId, ...extra });
}

export function decodeCustomId(customId: string | undefined): { pm: string; uid: string; coupon?: string; msg?: string } | null {
  if (!customId) return null;
  try {
    return JSON.parse(customId);
  } catch {
    return null;
  }
}

export async function createPayPalOrder(opts: { amountUsd: number; description: string; referenceId: string; customId: string }): Promise<{ id: string; approveUrl: string } | { error: string }> {
  const siteUrl = Deno.env.get("SITE_URL") || "https://visionex.app";
  const accessToken = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: opts.referenceId,
        custom_id: opts.customId,
        description: opts.description.slice(0, 127),
        amount: { currency_code: "USD", value: opts.amountUsd.toFixed(2) },
      }],
      application_context: {
        brand_name: "Visionex Library",
        user_action: "PAY_NOW",
        return_url: `${siteUrl}/library?checkout=success&rail=paypal`,
        cancel_url: `${siteUrl}/library?checkout=cancelled&rail=paypal`,
      },
    }),
  });
  const order = await res.json();
  if (!res.ok) return { error: order?.message || "PayPal order creation failed" };
  const approveUrl = (order.links ?? []).find((l: { rel: string; href: string }) => l.rel === "approve")?.href;
  if (!approveUrl) return { error: "PayPal did not return an approval link" };
  return { id: order.id, approveUrl };
}

/** Captures an approved order (buyer already completed PayPal's own
 *  approval flow) — this is the step that actually moves money. Returns the
 *  captured purchase_units so the caller can read back reference_id/
 *  custom_id/the captured amount without a second lookup. */
export async function capturePayPalOrder(orderId: string): Promise<
  | { status: string; purchaseUnits: Array<{ reference_id: string; custom_id?: string; amount: string }> }
  | { error: string }
> {
  const accessToken = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });
  const data = await res.json();
  // ORDER_ALREADY_CAPTURED is treated as success (webhook delivery + a
  // client-side return-flow capture could both race to capture the same
  // order) — any other failure is a real error.
  const alreadyCaptured = data?.details?.some((d: { issue?: string }) => d.issue === "ORDER_ALREADY_CAPTURED");
  if (!res.ok && !alreadyCaptured) return { error: data?.message || "PayPal capture failed" };

  const purchaseUnits = (data.purchase_units ?? []).map((pu: { reference_id: string; custom_id?: string; payments?: { captures?: Array<{ amount: { value: string } }> } }) => ({
    reference_id: pu.reference_id,
    custom_id: pu.custom_id,
    amount: pu.payments?.captures?.[0]?.amount?.value ?? "0",
  }));
  return { status: data.status ?? "COMPLETED", purchaseUnits };
}

/** Verifies a webhook event via PayPal's own verify-webhook-signature
 *  endpoint (simpler and more reliable from Deno than hand-rolling PayPal's
 *  CRC32 + cert-chain scheme, which is the officially documented
 *  alternative for server environments that can call back to PayPal). */
export async function verifyPayPalWebhookSignature(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
  if (!webhookId) return false;

  const accessToken = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_time: headers.get("paypal-transmission-time"),
      cert_url: headers.get("paypal-cert-url"),
      auth_algo: headers.get("paypal-auth-algo"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}
