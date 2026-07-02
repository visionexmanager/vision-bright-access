// Minimal Stripe REST helpers for Career Center subscription billing.
// Mirrors the existing bazaar-checkout/bazaar-stripe-webhook convention in
// this repo (raw fetch + form-encoded body, manual webhook HMAC
// verification) rather than pulling in the Stripe SDK, so this file has no
// new runtime dependency.

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const encoder = new TextEncoder();

export function requireStripeKey(): string {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

export async function stripePost(path: string, form: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API_BASE}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireStripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${path} failed: ${(data as { error?: { message?: string } })?.error?.message ?? res.status}`);
  }
  return data;
}

export async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${requireStripeKey()}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${path} failed: ${(data as { error?: { message?: string } })?.error?.message ?? res.status}`);
  }
  return data;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function secureEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

/** Verifies a Stripe webhook signature (5-minute tolerance) — same algorithm as bazaar-stripe-webhook. */
export async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`)));
  return signatures.some((candidate) => secureEqual(candidate, digest));
}
