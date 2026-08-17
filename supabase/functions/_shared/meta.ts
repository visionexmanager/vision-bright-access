// The one place the Meta Graph API version is decided.
//
// Before this file the version was a literal in each call site and they had
// drifted: v21.0 for WhatsApp replies, v20.0 for Bazaar seller notifications,
// v21.0 for the social OAuth endpoints. Three versions is not a configuration,
// it is three separate bugs waiting for whichever one Meta retires first.
//
// Visionex targets v26.0. Meta retires a version roughly two years after
// release and answers a retired one with an error that reads like a permission
// problem, so the version is worth pinning deliberately rather than inheriting
// whatever a call site happened to be written against.

/**
 * Read an environment variable without assuming Deno.
 *
 * `_shared/whatsapp.ts` imports this module, and the Vitest suite imports that
 * one directly under Node, where `Deno` is undefined. A bare `Deno.env.get`
 * here would throw at import time and take the WhatsApp test file down with
 * it — so the global is probed rather than referenced.
 */
function env(name: string): string | undefined {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
}

/**
 * The Graph API version every Meta call uses.
 *
 * `META_GRAPH_API_VERSION` is deliberately NOT synced by deploy.yml and is
 * expected to be unset. It exists as an escape hatch: if Meta retires a version
 * unexpectedly, `supabase secrets set` moves every call site at once without
 * waiting for a full deploy. Normal operation uses the default below.
 */
export const GRAPH_VERSION = env("META_GRAPH_API_VERSION") ?? "v26.0";

/** Host for Graph API calls: messages, token exchange, node reads. */
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Host for the user-facing OAuth dialog. A different hostname from GRAPH_BASE
 * and not interchangeable with it — the dialog is a page a browser is sent to,
 * not an API endpoint.
 */
export const FB_DIALOG_BASE = `https://www.facebook.com/${GRAPH_VERSION}`;
