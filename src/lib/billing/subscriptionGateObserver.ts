// Hears the server's subscription gate, so the site can say so once.
//
// The gate itself is server-side (`supabase/functions/_shared/subscriptionGate.ts`)
// and this file enforces nothing: hiding a button is not a permission, and a
// request that bypasses the site is refused exactly the same way. What this
// adds is the one localized sentence. Every Edge Function refuses with the
// same body — `{ error: "subscription_required", notify }` — and `notify` is
// true only on the single response the server chose to carry the notice, so
// the site announces it once rather than on every refused call.
//
// It has to be installed before the Supabase client is created: supabase-js
// captures `fetch` when the client is built, so `main.tsx` imports this first.

export const SUBSCRIPTION_GATE_EVENT = "visionex:subscription-required";

const FUNCTIONS_PATH = "/functions/v1/";

/** True only for the gate's own notice-bearing refusal. */
export function isSubscriptionGateNotice(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const row = body as Record<string, unknown>;
  return row.error === "subscription_required" && row.notify === true;
}

function requestUrl(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === "object" && "url" in input) return String((input as { url: unknown }).url);
  return "";
}

const INSTALLED = Symbol.for("visionex.subscriptionGateObserver");

/** Wrap `fetch` once. The response is returned untouched; a clone is read. */
export function installSubscriptionGateObserver(target: typeof globalThis = globalThis): void {
  const holder = target as typeof globalThis & { [INSTALLED]?: boolean };
  if (holder[INSTALLED] || typeof target.fetch !== "function") return;
  holder[INSTALLED] = true;

  const original = target.fetch.bind(target);
  target.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await original(...args);
    if (response.status === 403 && requestUrl(args[0]).includes(FUNCTIONS_PATH)) {
      response
        .clone()
        .json()
        .then((body: unknown) => {
          if (isSubscriptionGateNotice(body) && typeof target.dispatchEvent === "function") {
            target.dispatchEvent(new CustomEvent(SUBSCRIPTION_GATE_EVENT));
          }
        })
        .catch(() => undefined);
    }
    return response;
  };
}

installSubscriptionGateObserver();
