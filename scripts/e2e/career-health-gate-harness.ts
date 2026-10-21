// Runs the REAL career-system-health handler with Supabase and the network replaced, to
// prove who can make it probe the Gemini key and write history rows.
//
//   deno run --no-lock --node-modules-dir=none -A scripts/e2e/career-health-gate-harness.ts

// @ts-nocheck — a harness that replaces Deno.serve and fetch.

Deno.env.set("SUPABASE_URL", "http://stub.supabase.test");
Deno.env.set("SUPABASE_ANON_KEY", "stub-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service");
Deno.env.set("CRON_SECRET", "harness-cron-secret");
Deno.env.set("GEMINI_API_KEY", "harness-gemini");

let handler: ((req: Request) => Promise<Response>) | null = null;
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };

let gemini = 0, writes = 0;
let asAdmin = false;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(req.url);
  if (url.hostname === "generativelanguage.googleapis.com") { gemini++; return json({ models: [] }); }
  if (url.hostname !== "stub.supabase.test") return json({ error: "blocked" }, 599);
  if (url.pathname === "/auth/v1/user") {
    const auth = req.headers.get("authorization") ?? "";
    return auth === "Bearer stub-anon" || !auth.startsWith("Bearer user")
      ? json({ code: 401, msg: "invalid JWT" }, 401)
      : json({ id: "00000000-0000-4000-8000-0000000000c1", aud: "authenticated", role: "authenticated", email: "h@visionex.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  }
  if (url.pathname === "/rest/v1/rpc/has_role") return json(asAdmin);
  if (url.pathname.startsWith("/rest/v1/")) {
    if (req.method === "POST") { writes++; return new Response(null, { status: 201 }); }
    return json([]);
  }
  return json({}, 404);
};

await import("../../supabase/functions/career-system-health/index.ts");
if (!handler) throw new Error("no handler registered");

let fail = 0;
const check = (label: string, ok: boolean) => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); };
async function call(auth?: string) {
  gemini = 0; writes = 0;
  const res = await handler!(new Request("http://localhost/functions/v1/career-system-health", {
    method: "POST", headers: { Origin: "https://visionex.app", ...(auth ? { Authorization: auth } : {}) },
  }));
  await res.text();
  return res.status;
}

check("no Authorization header → 401, no Gemini probe, no history row", (await call()) === 401 && gemini === 0 && writes === 0);
check("the public anon key as bearer → 401, no probe, no write", (await call("Bearer stub-anon")) === 401 && gemini === 0 && writes === 0);
check("a wrong cron secret → 401, no probe, no write", (await call("Bearer wrong-secret")) === 401 && gemini === 0 && writes === 0);
asAdmin = false;
check("a signed-in non-admin → 401, no probe, no write", (await call("Bearer user-1")) === 401 && gemini === 0 && writes === 0);
check("the scheduler's CRON_SECRET → 200, probes once, writes the history", (await call("Bearer harness-cron-secret")) === 200 && gemini === 1 && writes === 1);
asAdmin = true;
check("an admin session → 200, probes once, writes the history", (await call("Bearer user-1")) === 200 && gemini === 1 && writes === 1);

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall passed");
Deno.exit(fail ? 1 : 0);
