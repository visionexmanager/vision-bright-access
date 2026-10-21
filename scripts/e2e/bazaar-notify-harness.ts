// Runs the REAL bazaar-notify-seller handler with Supabase, Resend and Meta replaced, and
// records every notification, e-mail and WhatsApp message it would have produced.
//
//   deno run --no-lock --node-modules-dir=none -A scripts/e2e/bazaar-notify-harness.ts
//
// No network request is made. The limit decision (bazaar_notify_claim) is stubbed here
// and tested for real, in SQL, by bazaar-notify-claim-scenarios.mjs and, under concurrent
// connections on real PostgreSQL, by ai-subscription-gate-concurrency.mjs. This harness
// judges what the HANDLER does with each decision.

// @ts-nocheck — a harness that replaces Deno.serve and fetch.

Deno.env.set("SUPABASE_URL", "http://stub.supabase.test");
Deno.env.set("SUPABASE_ANON_KEY", "stub-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service");
Deno.env.set("RESEND_API_KEY", "harness-resend");
Deno.env.set("WHATSAPP_TOKEN", "harness-wa");
Deno.env.set("WHATSAPP_PHONE_NUMBER_ID", "123456");

const BUYER = "00000000-0000-4000-8000-0000000000d1";
const OWNER = "00000000-0000-4000-8000-0000000000d2";
const SHOP = "00000000-0000-4000-8000-0000000000e1";

let handler: ((req: Request) => Promise<Response>) | null = null;
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };

let claimReply: any = { allowed: true, reason: "ok", external: true };
let claimFails = false;
let orderRow: any = null;
const seen = { notifications: [] as any[], emails: 0, whatsapp: 0, claims: [] as any[], orderQueries: 0, other: [] as string[] };
const reset = () => { seen.notifications = []; seen.emails = 0; seen.whatsapp = 0; seen.claims = []; seen.orderQueries = 0; seen.other = []; };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(req.url);
  if (url.hostname === "api.resend.com") { seen.emails++; return json({ id: "e1" }); }
  if (url.hostname === "graph.facebook.com") { seen.whatsapp++; return json({ messages: [{ id: "w1" }] }); }
  if (url.hostname !== "stub.supabase.test") { seen.other.push(url.hostname); return json({ error: "blocked" }, 599); }
  const single = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
  const auth = req.headers.get("authorization") ?? "";
  if (url.pathname === "/auth/v1/user") {
    return auth === "Bearer buyer-session" || auth === "Bearer owner-session"
      ? json({ id: auth === "Bearer owner-session" ? OWNER : BUYER, aud: "authenticated", role: "authenticated", email: "buyer.private@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
      : json({ code: 401, msg: "invalid JWT" }, 401);
  }
  if (url.pathname.startsWith("/auth/v1/admin/users/")) return json({ id: OWNER, email: "seller@example.test", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  if (url.pathname === "/rest/v1/rpc/bazaar_notify_claim") {
    seen.claims.push(JSON.parse(await req.text()));
    return claimFails ? json({ code: "XX000", message: "down" }, 500) : json(claimReply);
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.split("/").pop()!;
    if (req.method === "POST") { if (table === "notifications") seen.notifications.push(JSON.parse(await req.text())); return new Response(null, { status: 201 }); }
    if (table === "bazaar_shops") return json({ id: SHOP, owner_id: OWNER, name: "Harness Shop", email_notifications: true, whatsapp_notifications: true, whatsapp_number: "+961 70 000 000", order_notifications: true, message_notifications: true, review_notifications: true, low_stock_notifications: true });
    if (table === "bazaar_orders") { seen.orderQueries++; return orderRow ? (single ? json(orderRow) : json([orderRow])) : (single ? json({ code: "PGRST116", message: "0 rows" }, 406) : json([])); }
    if (table === "profiles") return single ? json({ display_name: "Sam Buyer" }) : json([{ display_name: "Sam Buyer" }]);
    if (table === "bazaar_products") return single ? json({ name: "Lamp" }) : json([{ name: "Lamp" }]);
    return single ? json({ code: "PGRST116", message: "0 rows" }, 406) : json([]);
  }
  seen.other.push(url.pathname);
  return json({}, 404);
};

await import("../../supabase/functions/bazaar-notify-seller/index.ts");
if (!handler) throw new Error("no handler registered");

let fail = 0;
const check = (label: string, ok: boolean) => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); };
async function call(body: unknown, auth: string | null = "Bearer buyer-session") {
  reset();
  const res = await handler!(new Request("http://localhost/functions/v1/bazaar-notify-seller", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://visionex.app", ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  }));
  let b: any = null; try { b = JSON.parse(await res.text()); } catch { /* not json */ }
  return { status: res.status, body: b };
}
const nothingSent = () => seen.notifications.length === 0 && seen.emails === 0 && seen.whatsapp === 0;

// ── Unauthorized ──
let r = await call({ shopId: SHOP, eventType: "message", message: "hi" }, null);
check("no Authorization header → 401, nothing created or sent", r.status === 401 && nothingSent() && seen.claims.length === 0);
r = await call({ shopId: SHOP, eventType: "message", message: "hi" }, "Bearer stub-anon");
check("the public anon key as bearer → 401, nothing created or sent", r.status === 401 && nothingSent());

// ── Normal delivery ──
claimReply = { allowed: true, reason: "ok", external: true };
r = await call({ shopId: SHOP, productId: "00000000-0000-4000-8000-0000000000f1", eventType: "add_to_cart" });
check("a normal user event → 200, one in-app notification, one e-mail, one WhatsApp message", r.status === 200 && seen.notifications.length === 1 && seen.emails === 1 && seen.whatsapp === 1);
check("…the claim was made once for this user, shop and event", seen.claims.length === 1 && seen.claims[0]._user_id === BUYER && seen.claims[0]._shop_id === SHOP && seen.claims[0]._event_type === "add_to_cart");
check("…the buyer is named by display name, and their e-mail address appears nowhere", JSON.stringify(seen.notifications).includes("Sam Buyer") && !JSON.stringify(seen.notifications).includes("buyer.private@example.test"));

// ── Repeated / refused by the limit ──
claimReply = { allowed: false, reason: "duplicate", external: false };
r = await call({ shopId: SHOP, eventType: "wishlist" });
check("a duplicate → 200 skipped (the UI is unaffected), no notification, no e-mail, no WhatsApp", r.status === 200 && r.body?.skipped === true && r.body?.reason === "duplicate" && nothingSent());
claimReply = { allowed: false, reason: "user_shop_rate", external: false };
r = await call({ shopId: SHOP, eventType: "message", message: "again" });
check("over the hourly ceiling → skipped, nothing sent", r.body?.reason === "user_shop_rate" && nothingSent());
claimReply = { allowed: false, reason: "user_daily", external: false };
r = await call({ shopId: SHOP, eventType: "review", message: "x" });
check("over the daily ceiling → skipped, nothing sent", r.body?.reason === "user_daily" && nothingSent());

// ── Shop-wide external ceiling: in-app only ──
claimReply = { allowed: true, reason: "ok", external: false };
r = await call({ shopId: SHOP, eventType: "message", message: "hello" });
check("the shop's external budget spent → the in-app notification is created, NO e-mail and NO WhatsApp", r.status === 200 && seen.notifications.length === 1 && seen.emails === 0 && seen.whatsapp === 0);

// ── The claim cannot be made: fail closed ──
claimFails = true;
r = await call({ shopId: SHOP, eventType: "message", message: "hello" });
claimFails = false;
check("the limit function failing → 503 and nothing created or sent (fails closed)", r.status === 503 && nothingSent());

// ── Forged events ──
claimReply = { allowed: true, reason: "ok", external: true };
orderRow = null;
r = await call({ shopId: SHOP, eventType: "order_paid", message: "Order 1234 has been paid." });
check("order_paid from a user with no recent order at that shop → 403, nothing created or sent, no claim spent", r.status === 403 && nothingSent() && seen.claims.length === 0);
orderRow = { id: "11111111-1111-4111-8111-111111111111" };
r = await call({ shopId: SHOP, eventType: "order_paid", message: "Order 1234 has been paid." });
check("order_paid from the buyer of a recent order → delivered, and the claim carries the ORDER as its key (two orders are two events)", r.status === 200 && seen.notifications.length === 1 && seen.claims[0]._key === "11111111-1111-4111-8111-111111111111");
orderRow = null;
for (const ev of ["order_status", "low_stock"]) {
  r = await call({ shopId: SHOP, eventType: ev });
  check(`${ev} from a user → 403 (internal events only), nothing created or sent`, r.status === 403 && nothingSent());
}

// ── The platform itself (Stripe webhook): any event, unlimited, no claim ──
r = await call({ shopId: SHOP, eventType: "order_paid", message: "Cash order abcd1234 has been paid." }, "Bearer stub-service");
check("the platform (service role) → delivered with all three channels and NO claim", r.status === 200 && seen.notifications.length === 1 && seen.emails === 1 && seen.whatsapp === 1 && seen.claims.length === 0);
r = await call({ shopId: SHOP, eventType: "low_stock" }, "Bearer stub-service");
check("the platform may send low_stock, which a user may not", r.status === 200 && seen.notifications.length === 1);

// ── The seller's own actions and bad input ──
r = await call({ shopId: SHOP, eventType: "message", message: "hi" }, "Bearer owner-session");
check("the shop's own owner → skipped (owner_event), nothing sent", r.body?.reason === "owner_event" && nothingSent());
r = await call({ shopId: SHOP, eventType: "made_up" });
check("an unknown event type → 400", r.status === 400 && nothingSent());
r = await call({ eventType: "message" });
check("no shop id → 400", r.status === 400 && nothingSent());

// ── Text is bounded and cleaned ──
claimReply = { allowed: true, reason: "ok", external: true };
r = await call({ shopId: SHOP, eventType: "message", buyerName: "Visionex Security\n\nTEAM ".repeat(20), message: "A".repeat(5000) + "\u0000\u0007" });
const body = String(seen.notifications[0]?.body ?? "");
check("a 5,000-character message is cut to 600, a long buyer name to 60, and control characters are removed", r.status === 200 && body.length < 760 && !/[\u0000-\u001f]/.test(body));

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall passed");
Deno.exit(fail ? 1 : 0);
