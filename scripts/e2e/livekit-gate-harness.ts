// Runs the REAL livekit-token handler with Supabase and the network replaced, to prove
// who can be handed a LiveKit room token.
//
//   deno run --no-lock --node-modules-dir=none -A scripts/e2e/livekit-gate-harness.ts
//
// No network request is made; the LiveKit key and secret are fake values used to
// sign a token locally. Nothing is printed except statuses and booleans.

// @ts-nocheck — a harness that replaces Deno.serve and fetch.

Deno.env.set("SUPABASE_URL", "http://stub.supabase.test");
Deno.env.set("SUPABASE_ANON_KEY", "stub-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service");
Deno.env.set("LIVEKIT_API_KEY", "harness-key");
Deno.env.set("LIVEKIT_API_SECRET", "harness-secret-harness-secret-harness");
Deno.env.set("LIVEKIT_URL", "wss://livekit.stub.test");

let handler: ((req: Request) => Promise<Response>) | null = null;
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };

let entitled: boolean | "error" = false;
let rpcs: string[] = [];
let outside: string[] = [];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(req.url);
  if (url.hostname !== "stub.supabase.test") { outside.push(url.hostname); return json({ error: "blocked" }, 599); }
  if (url.pathname === "/auth/v1/user") return json({ id: "00000000-0000-4000-8000-0000000000b1", aud: "authenticated", role: "authenticated", email: "h@visionex.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const name = url.pathname.split("/").pop()!;
    rpcs.push(name);
    if (name === "ai_user_entitled") return entitled === "error" ? json({ code: "XX000", message: "down" }, 500) : json(entitled);
    return json(null);
  }
  return json({}, 404);
};

await import("../../supabase/functions/livekit-token/index.ts");
if (!handler) throw new Error("no handler registered");

let fail = 0;
const check = (label: string, ok: boolean) => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); };
async function call(auth = true) {
  rpcs = []; outside = [];
  const res = await handler!(new Request("http://localhost/functions/v1/livekit-token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://visionex.app", ...(auth ? { Authorization: "Bearer harness-user" } : {}) },
    body: JSON.stringify({ roomId: "room-1", userName: "Harness" }),
  }));
  let body: any = null; try { body = JSON.parse(await res.text()); } catch { /* not json */ }
  return { status: res.status, body };
}

entitled = false;
let r = await call();
check("signed in but not on a paid plan (trial, expired, free) → 403, no token", r.status === 403 && !r.body?.token && r.body?.error === "subscription_required");
check("…the plan was asked server-side", rpcs.includes("ai_user_entitled"));

entitled = "error";
r = await call();
check("the entitlement lookup failing → 503 and no token (fails closed)", r.status === 503 && !r.body?.token);

entitled = true;
r = await call();
check("an active paid plan (or an admin) → 200 with a token", r.status === 200 && typeof r.body?.token === "string" && r.body.token.split(".").length === 3);

r = await call(false);
check("no Authorization header → 401 before any plan lookup", r.status === 401 && rpcs.length === 0);
check("no request left the process", outside.length === 0);

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall passed");
Deno.exit(fail ? 1 : 0);
