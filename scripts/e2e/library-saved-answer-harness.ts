// Runs the REAL library-ai-assistant and library-librarian-daily-plan handlers with
// Supabase and the network replaced, and proves what a saved-answer request does and
// does not touch.
//
//   deno run --no-lock --node-modules-dir=none -A scripts/e2e/library-saved-answer-harness.ts
//
// Nothing here makes a network request: every fetch the handlers (and the supabase-js
// client they create) issue is answered by the table below, and anything not listed is
// recorded and answered 599. A request to any AI provider host fails the run, because
// the whole point is that a stored answer needs none. No key, prompt or answer is
// printed: only statuses and counts.
//
// It proves the code path. It does not prove production: production holds no stored
// answers yet (library_ai_summaries and library_ai_content_cache are empty).

// @ts-nocheck — a harness that replaces Deno.serve and fetch.

Deno.env.set("SUPABASE_URL", "http://stub.supabase.test");
Deno.env.set("SUPABASE_ANON_KEY", "stub-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service");
Deno.env.set("ALLOWED_ORIGINS", "https://visionex.app");

const USER_ID = "00000000-0000-4000-8000-0000000000a1";
const USER_TOKEN = "harness-user";
const PROVIDER_HOSTS = /api\.openai\.com|api\.groq\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|openrouter\.ai|elevenlabs\.io|api\.fal\.run|lumalabs\.ai/;

let handler: ((req: Request) => Promise<Response>) | null = null;
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };

type Seen = { providers: string[]; rpcs: string[]; tables: string[]; unknown: string[]; reads: { table: string; query: string; auth: string }[] };
let seen: Seen = { providers: [], rpcs: [], tables: [], unknown: [], reads: [] };
let tables: Record<string, unknown | null> = {};
let gateVerdict = "blocked_first_notice";
let signedIn = true;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(req.url);
  if (PROVIDER_HOSTS.test(url.hostname)) { seen.providers.push(url.hostname); return json({ error: "blocked by harness" }, 599); }
  if (url.hostname !== "stub.supabase.test") { seen.unknown.push(url.hostname); return json({ error: "unexpected host" }, 599); }
  if (url.pathname === "/auth/v1/user") {
    return signedIn
      ? json({ id: USER_ID, aud: "authenticated", role: "authenticated", email: "harness@visionex.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
      : json({ code: 401, msg: "invalid JWT" }, 401);
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const name = url.pathname.split("/").pop()!;
    seen.rpcs.push(name);
    if (name === "ai_subscription_gate") return json(gateVerdict);
    if (name === "check_ai_rate_limit") return json(true);
    return json(null);
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.split("/").pop()!;
    seen.tables.push(`${req.method} ${table}`);
    if (req.method === "GET") seen.reads.push({ table, query: url.search, auth: req.headers.get("authorization") ?? "" });
    if (req.method === "POST") return new Response(null, { status: 201 });
    const row = tables[table] ?? null;
    const single = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
    if (single) {
      return row
        ? json(row)
        : json({ code: "PGRST116", message: "The result contains 0 rows", details: "", hint: null }, 406);
    }
    return json(row ? [row] : []);
  }
  seen.unknown.push(url.pathname);
  return json({ error: "unexpected path" }, 599);
};

let fail = 0;
const check = (label: string, ok: boolean) => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); };

async function load(path: string) {
  handler = null;
  await import(path);
  if (!handler) throw new Error(`${path} did not register a handler`);
}
async function call(fn: string, body: unknown, auth = true) {
  seen = { providers: [], rpcs: [], tables: [], unknown: [], reads: [] };
  const res = await handler!(new Request(`http://localhost/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://visionex.app", ...(auth ? { Authorization: `Bearer ${USER_TOKEN}` } : {}) },
    body: JSON.stringify(body),
  }));
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: parsed };
}

// ═══ library-ai-assistant ═══════════════════════════════════════════════════
await load("../../supabase/functions/library-ai-assistant/index.ts");
const AI = "library-ai-assistant";

// 1. A stored summary: returned, and nothing that costs money was touched.
signedIn = true;
tables = { library_ai_summaries: { content: "STORED-SUMMARY", created_at: "2026-10-01T00:00:00Z" } };
let r = await call(AI, { mode: "smart-summary", book_id: "b1", scope: "book", length: "medium" });
check("stored summary → 200", r.status === 200);
check("…labelled as saved, with its date", r.body?.source === "saved" && r.body?.result?.cached === true && r.body?.result?.saved_at === "2026-10-01T00:00:00Z");
check("…and it is the stored text", r.body?.result?.summary === "STORED-SUMMARY");
check("…zero requests to any AI provider", seen.providers.length === 0);
check("…no subscription gate, no daily limit, no VX call (zero RPCs)", seen.rpcs.length === 0);
check("…only the summary table was read (and the history row written)", seen.tables.every((t) => /library_ai_summaries|library_ai_activity_log/.test(t)));
check("…the summary was read with the CALLER's session, so row-level security decides what they may see", seen.reads.filter((x) => x.table === "library_ai_summaries").every((x) => x.auth === `Bearer ${USER_TOKEN}`));
check("…no request to an unexpected host", seen.unknown.length === 0);

// 2. A stored translation from the shared content cache.
tables = { library_ai_content_cache: { result_text: "STORED-TRANSLATION", created_at: "2026-09-01T00:00:00Z" } };
r = await call(AI, { mode: "translate-paragraph", text: "Hello", targetLanguage: "French" });
check("stored translation → 200, saved, stored text", r.status === 200 && r.body?.source === "saved" && r.body?.result?.translated_text === "STORED-TRANSLATION");
check("…zero provider requests, zero RPCs", seen.providers.length === 0 && seen.rpcs.length === 0);
const cacheReads = seen.reads.filter((x) => x.table === "library_ai_content_cache");
check("…the cache is read by the exact hash and nothing broader (it cannot be listed)", cacheReads.length === 1 && /content_hash=eq\.[0-9a-f]{64}/.test(cacheReads[0].query));
check("…with the service role, because the table has no read policy (20261080)", cacheReads.every((x) => x.auth === "Bearer stub-service"));

// 3. No stored answer + not entitled: refused at the gate, before any provider.
tables = {};
gateVerdict = "blocked_first_notice";
r = await call(AI, { mode: "smart-summary", book_id: "b1", scope: "book", length: "medium" });
check("no stored answer, not entitled → 403 subscription_required", r.status === 403 && r.body?.error === "subscription_required");
check("…the gate was asked", seen.rpcs.includes("ai_subscription_gate"));
check("…no daily unit was spent and no provider was reached", !seen.rpcs.includes("check_ai_rate_limit") && seen.providers.length === 0);

gateVerdict = "blocked_silent";
r = await call(AI, { mode: "translate-paragraph", text: "Hello", targetLanguage: "French" });
check("no stored translation, not entitled (silent) → 403, zero provider requests", r.status === 403 && seen.providers.length === 0);

// 4. A mode that is never stored goes straight to the gate.
r = await call(AI, { mode: "answer-question", book_id: "b1", question: "Who?" });
check("a mode that is never stored goes straight to the gate (403), no provider", r.status === 403 && seen.providers.length === 0);

// 5. Anonymous.
r = await call(AI, { mode: "smart-summary", book_id: "b1" }, false);
check("no Authorization header → 401 before any lookup", r.status === 401 && seen.tables.length === 0 && seen.providers.length === 0);
signedIn = false;
tables = { library_ai_summaries: { content: "STORED-SUMMARY", created_at: "2026-10-01T00:00:00Z" } };
r = await call(AI, { mode: "smart-summary", book_id: "b1" }, true);
check("an invalid session → 401, no stored answer is returned", r.status === 401 && seen.providers.length === 0 && !JSON.stringify(r.body ?? {}).includes("STORED"));

// ═══ library-librarian-daily-plan ═══════════════════════════════════════════
await load("../../supabase/functions/library-librarian-daily-plan/index.ts");
const PLAN = "library-librarian-daily-plan";
signedIn = true;

// 6. Today's plan already stored: returned with nothing paid touched.
tables = { library_librarian_daily_plans: { id: "p1", user_id: USER_ID, motivational_summary: "STORED-PLAN" } };
gateVerdict = "blocked_first_notice"; // an unentitled caller
r = await call(PLAN, {});
check("daily plan: today's stored plan → 200 for an UNentitled caller, labelled saved", r.status === 200 && r.body?.source === "saved" && r.body?.plan?.motivational_summary === "STORED-PLAN");
check("…zero provider requests and zero RPCs (no gate, no daily limit)", seen.providers.length === 0 && seen.rpcs.length === 0);
const planRead = seen.reads.find((x) => x.table === "library_librarian_daily_plans");
check("…read with the caller's own session, filtered to the caller's user id and today", !!planRead && planRead.auth === `Bearer ${USER_TOKEN}` && planRead.query.includes(`user_id=eq.${USER_ID}`) && /plan_date=eq\.\d{4}-\d{2}-\d{2}/.test(planRead.query));

// 7. No stored plan, or force: refused at the gate, never a provider.
tables = {};
r = await call(PLAN, {});
check("daily plan: none stored, not entitled → 403 at the gate, zero provider requests", r.status === 403 && r.body?.error === "subscription_required" && seen.providers.length === 0 && !seen.rpcs.includes("check_ai_rate_limit"));
tables = { library_librarian_daily_plans: { id: "p1", user_id: USER_ID, motivational_summary: "STORED-PLAN" } };
r = await call(PLAN, { force: true });
check("daily plan: force=true ignores the stored plan and goes through the gate (regenerating is paid work)", r.status === 403 && seen.rpcs.includes("ai_subscription_gate") && seen.providers.length === 0);
r = await call(PLAN, {}, false);
check("daily plan: no Authorization header → 401", r.status === 401 && seen.tables.length === 0);

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall passed");
Deno.exit(fail ? 1 : 0);
