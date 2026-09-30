// Does an unsubscribed caller reach a provider, a tool or the VX meter?
//
// Runs each function's REAL handler (the router, the fallback chain, the
// metering) with only Supabase replaced by a stub on localhost. Every outbound
// request that is not the stub or Meta's Graph API is a provider call: it is
// COUNTED and answered 503, never sent. So no provider, key or account is
// touched, and a request that gets past the gate shows up as a number.
//
// The stub's `ai_subscription_gate*` RPCs return whatever verdict the case sets.
// Entitlement itself (the SQL) is proven by
// scripts/sql/ai-subscription-gate-scenarios.mjs and, against production data,
// by .github/workflows/subscription-gate-inspect.yml.
//
// The repository is public: this prints names, statuses and counts only.
//
// Run: deno run --no-lock --node-modules-dir=none --import-map=scripts/e2e/import-map.json -A scripts/e2e/subscription-gate-harness.ts

const STUB = "http://127.0.0.1:54322";
const FN_DIR = new URL("../../supabase/functions/", import.meta.url);
Deno.env.set("SUPABASE_URL", STUB);
Deno.env.set("SUPABASE_ANON_KEY", "stub-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service");
Deno.env.set("ALLOWED_ORIGINS", "https://visionex.app");
for (const k of ["OPENAI_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY", "ELEVENLABS_API_KEY", "FAL_KEY", "LUMA_API_KEY", "BYTEZ_API_KEY"]) {
  Deno.env.set(k, "stub-never-sent");
}
Deno.env.set("WHATSAPP_APP_SECRET", "stub-app-secret");
Deno.env.set("WHATSAPP_PHONE_NUMBER_ID", "000000000000000");
Deno.env.set("WHATSAPP_TOKEN", "stub-token-never-sent");
Deno.env.set("WHATSAPP_VERIFY_TOKEN", "stub-verify");
Deno.env.set("META_APP_SECRET", "stub-meta-secret");
Deno.env.set("FACEBOOK_PAGE_ACCESS_TOKEN", "stub-page-token-never-sent");

const USER_TOKEN = "gate-user-token";
const USER_ID = "00000000-0000-4000-8000-0000000000a1";

type Mode = "authorized" | "blocked_first_notice" | "blocked_silent" | "error";
let mode: Mode = "blocked_silent";
let firstNoticeTaken = new Set<string>();
let atomicNotices = false; // emulate the primary-key claim: only the first caller per subject wins
let rpcCalls: string[] = [];
let tableWrites: string[] = [];
let providerCalls: string[] = [];
let graphSends = 0;
let gateAsked = 0;
const providerPaths: string[] = [];

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });
// The gate, and identity/authorization questions that spend nothing.
const GATE_ONLY = new Set(["ai_subscription_gate", "ai_subscription_gate_whatsapp", "has_role", "is_organization_admin"]);

// Bodies for the functions that validate their input before they authenticate.
const BODIES: Record<string, unknown> = {
  "career-ai": { action: "coach", message: "hello", prompt: "hello" },
  "organization-ai-admin": { organization_id: "00000000-0000-4000-8000-0000000000b1", mode: "training_plan" },
  // YouTube search is a mode of this function; the refusal must come before any googleapis call.
  "library-research-assistant": { mode: "youtube_search", query: "photosynthesis", youtube: { type: "video" } },
};

async function stub(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  if (path === "/auth/v1/user") {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    return token === USER_TOKEN
      ? json({ id: USER_ID, aud: "authenticated", role: "authenticated", email: "gate@visionex.test", app_metadata: {}, user_metadata: {} })
      : json({ code: 401, msg: "invalid JWT" }, 401);
  }
  const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
  if (rpc) {
    const name = rpc[1];
    rpcCalls.push(name);
    if (name.startsWith("ai_subscription_gate")) {
      gateAsked++;
      if (mode === "error") return json({ message: "boom" }, 500);
      if (mode === "blocked_first_notice" && atomicNotices) {
        const args = await req.json().catch(() => ({}));
        const subject = String(args._subject ?? args._wa_phone ?? "");
        if (firstNoticeTaken.has(subject)) return json("blocked_silent");
        firstNoticeTaken.add(subject);
      }
      return json(mode);
    }
    if (name === "has_role") return json(false);
    // Meta inbox: switched on, with a sending credential, so a message reaches the gate.
    if (name === "meta_messaging_allowed") return json({ ok: true, account_id: "00000000-0000-4000-8000-0000000000c1" });
    if (name === "resolve_social_account_token") return json({ ok: true, access_token: "stub-token-never-sent" });
    return json(true); // limits, budgets and meters answer "allowed", so a request that passes the gate goes on to spend
  }
  const table = path.match(/^\/rest\/v1\/([a-z0-9_]+)$/);
  if (table) {
    const single = (req.headers.get("Accept") ?? "").includes("vnd.pgrst.object");
    if (req.method === "GET" || req.method === "HEAD") return single ? json(null) : json([]);
    tableWrites.push(`${req.method.toLowerCase()}:${table[1]}`);
    const text = await req.text();
    let body: unknown = {};
    try { body = text ? JSON.parse(text) : {}; } catch { /* keep {} */ }
    const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ id: crypto.randomUUID(), ...(r as object) }));
    return single ? json(rows[0] ?? null) : json(rows);
  }
  return json({});
}
const originalServe = Deno.serve;
originalServe({ port: 54322, hostname: "127.0.0.1", onListen() {} }, stub);

const pending: Promise<unknown>[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith(STUB)) return stub(new Request(url, init));
  if (url.includes("graph.facebook.com") || url.includes("graph.instagram.com")) {
    if (new URL(url).pathname.endsWith("/messages")) graphSends++;
    return json({ messages: [{ id: "wamid.stub" }] });
  }
  providerCalls.push(new URL(url).hostname);
  providerPaths.push(new URL(url).pathname);
  return json({ error: "stubbed: this harness never reaches a provider" }, 503);
}) as typeof fetch;
(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = { waitUntil: (p: Promise<unknown>) => { pending.push(p.catch(() => undefined)); } };

type Handler = (req: Request) => Response | Promise<Response>;
const handlers = new Map<string, Handler>();
async function load(name: string): Promise<Handler> {
  const cached = handlers.get(name);
  if (cached) return cached;
  let captured: Handler | undefined;
  (globalThis as { __e2eServe?: (h: Handler) => void }).__e2eServe = (h) => { captured = h; };
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (...args: unknown[]) => {
    captured = args.find((a) => typeof a === "function") as Handler ?? (args[0] as { handler?: Handler })?.handler;
    return { finished: Promise.resolve(), shutdown: async () => {}, addr: { hostname: "", port: 0 } };
  };
  await import(new URL(`${name}/index.ts`, FN_DIR).href);
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = originalServe;
  if (!captured) throw new Error(`${name}: no handler captured`);
  handlers.set(name, captured);
  return captured;
}

function reset(m: Mode) {
  providerPaths.length = 0;
  mode = m; rpcCalls = []; tableWrites = []; providerCalls = []; graphSends = 0; gateAsked = 0; pending.length = 0;
}

async function post(fn: string, opts: { anon?: boolean; body?: unknown; raw?: string; headers?: Record<string, string> } = {}) {
  const handler = await load(fn);
  const headers: Record<string, string> = {
    apikey: "stub-anon", "Content-Type": "application/json", Origin: "https://visionex.app", ...(opts.headers ?? {}),
  };
  if (!opts.anon) headers.Authorization = `Bearer ${USER_TOKEN}`;
  const body = opts.raw ?? JSON.stringify(opts.body ?? {
    action: "generate", prompt: "hello", text: "hello", query: "hello", message: "hello", input: "hello", question: "hello",
    messages: [{ role: "user", content: "hello" }], assistant: "visionex", stream: false,
  });
  const res = await Promise.race([
    Promise.resolve(handler(new Request(`https://x.supabase.co/functions/v1/${fn}`, { method: "POST", headers, body }))),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 20_000)),
  ]);
  const text = await res.text().catch(() => "");
  await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 1_500))]);
  let code = "";
  try { code = String(JSON.parse(text).error ?? ""); } catch { /* not JSON */ }
  return { status: res.status, code };
}

// The one deliberate exception, reported on its own below.
const MODERATION = "moderate-content";

// Every function that asks the gate, found by reading the code.
const gated: string[] = [];
for (const d of Deno.readDirSync(FN_DIR)) {
  if (!d.isDirectory || d.name.startsWith("_") || d.name === "whatsapp-webhook" || d.name === "meta-messaging-webhook" || d.name === MODERATION) continue;
  let src = "";
  try { src = Deno.readTextFileSync(new URL(`${d.name}/index.ts`, FN_DIR)); } catch { continue; }
  if (/subscriptionGate|guardVoiceRequest|handleStructuredCareerAiRequest/.test(src)) gated.push(d.name);
}
gated.sort();

let failures = 0;
const fail = (line: string) => { failures++; console.log(`FAIL ${line}`); };

console.log(`## HTTP functions that ask the gate: ${gated.length}`);
let refusedCases = 0;
for (const fn of gated) {
  for (const [label, m, anon] of [
    ["signed-in, first notice", "blocked_first_notice", false],
    ["signed-in, silent", "blocked_silent", false],
    ["anonymous (no session)", "blocked_silent", true],
    ["gate unreachable", "error", false],
  ] as const) {
    reset(m);
    let res: { status: number; code: string };
    try { res = await post(fn, { anon, body: BODIES[fn] }); } catch (e) { res = { status: -1, code: e instanceof Error ? e.message.slice(0, 40) : "threw" }; }
    refusedCases++;
    const extra = rpcCalls.filter((r) => !GATE_ONLY.has(r));
    const problems: string[] = [];
    if (providerCalls.length) problems.push(`provider calls=${providerCalls.length} (${[...new Set(providerCalls)].join(",")})`);
    if (extra.length) problems.push(`limit/VX RPCs=${[...new Set(extra)].join(",")}`);
    if (tableWrites.length) problems.push(`writes=${[...new Set(tableWrites)].join(",")}`);
    if (!(m === "error" ? [503] : anon ? [401, 403] : [403]).includes(res.status)) problems.push(`http=${res.status} ${res.code}`);
    if (problems.length) fail(`${fn} [${label}] ${problems.join("; ")}`);
  }
}
console.log(`${gated.length} functions x 4 refused cases = ${refusedCases} requests; problems: ${failures}`);

console.log("## moderate-content: documented exemption (free moderation endpoint, no VX)");
for (const [label, m] of [["unsubscribed signed-in", "blocked_silent"]] as const) {
  reset(m);
  const r = await post(MODERATION, { body: { text: "hello" } });
  const vx = rpcCalls.filter((x) => !GATE_ONLY.has(x));
  console.log(`INFO  ${label}: http=${r.status}, gate asked=${gateAsked}, provider calls=${providerCalls.length} (${[...new Set(providerCalls)].join(",")}), limit/VX RPCs=${vx.join(",") || "none"}, writes=${[...new Set(tableWrites)].join(",") || "none"}`);
  const onlyModeration = providerCalls.length === 1 && providerCalls[0] === "api.openai.com" && providerPaths.every((x) => x === "/v1/moderations");
  const noSpend = vx.length === 0 && [...new Set(tableWrites)].every((w) => w === "post:ai_usage_events");
  const okMod = onlyModeration && noSpend;
  console.log(`${okMod ? "PASS" : "FAIL"} moderate-content: exactly one call, to /v1/moderations only; no limit, VX or agent RPC; the only write is the usage log`);
  if (!okMod) failures++;
}

console.log("## Authorized caller goes past the gate, and is still metered");
for (const fn of ["ai-chat", "ai-generate", "academy-chat"]) {
  reset("authorized");
  let res: { status: number; code: string };
  try { res = await post(fn); } catch { res = { status: -1, code: "threw" }; }
  const past = res.code !== "subscription_required" && res.code !== "entitlement_unavailable";
  const spent = rpcCalls.filter((r) => !GATE_ONLY.has(r));
  const reached = providerCalls.length > 0 || spent.length > 0;
  const ok = past && reached;
  console.log(`${ok ? "PASS" : "FAIL"} ${fn}: http=${res.status} gate asked=${gateAsked} provider attempts=${providerCalls.length} limit/meter RPCs=${[...new Set(spent)].join(",") || "none"}`);
  if (!ok) failures++;
}

console.log("## Spoofed plan, role and status");
reset("blocked_silent");
{
  const r = await post("ai-chat", {
    headers: { "x-plan": "business", "x-subscription-status": "active", "x-role": "admin" },
    body: { messages: [{ role: "user", content: "hi" }], plan: "business", role: "admin", is_subscribed: true, subscription_status: "active" },
  });
  const ok = r.status === 403 && providerCalls.length === 0;
  console.log(`${ok ? "PASS" : "FAIL"} spoofed headers and body: http=${r.status}, provider calls=${providerCalls.length}`);
  if (!ok) failures++;
}

console.log("## A free-week account calling a service the trial does not include (direct API)");
// The SQL decides that a trial-only account is not entitled (trial-entitlement-scenarios.mjs, and the
// real-PostgreSQL race in ai-subscription-gate-concurrency.mjs); here the handler is given exactly that
// refusal and must stop before any provider, limit, VX charge or write - whatever the caller claims.
for (const fn of ["ai-chat", "ai-generate", "academy-chat", "image-generate", "realtime-session", "text-to-speech", "video-studio", "library-ai-assistant"]) {
  reset("blocked_silent");
  let res: { status: number; code: string };
  try {
    res = await post(fn, {
      headers: { "x-plan": "free_trial", "x-trial": "true", "x-subscription-status": "trialing" },
      body: { action: "generate", prompt: "hello", text: "hello", messages: [{ role: "user", content: "hello" }], plan: "free_trial", is_trial: true, trial_active: true },
    });
  } catch { res = { status: -1, code: "threw" }; }
  const extra = rpcCalls.filter((r) => !GATE_ONLY.has(r));
  const ok = res.status === 403 && providerCalls.length === 0 && extra.length === 0 && tableWrites.length === 0;
  console.log(`${ok ? "PASS" : "FAIL"} trial account -> ${fn}: http=${res.status}, provider calls=${providerCalls.length}, limit/VX RPCs=${extra.length}, writes=${tableWrites.length}`);
  if (!ok) failures++;
}

console.log("## YouTube search and details need the Library, like every other Library mode");
for (const body of [
  { mode: "youtube_search", query: "photosynthesis", youtube: { type: "video" } },
  { mode: "youtube_resource", resource_type: "video", resource_id: "dQw4w9WgXcQ" },
]) {
  reset("blocked_silent");
  let res: { status: number; code: string };
  try { res = await post("library-research-assistant", { headers: { "x-plan": "free_trial", "x-trial": "true" }, body }); } catch { res = { status: -1, code: "threw" }; }
  const extra = rpcCalls.filter((r) => !GATE_ONLY.has(r));
  const google = providerCalls.filter((h) => /google|youtube|ytimg/.test(h));
  const ok = res.status === 403 && google.length === 0 && providerCalls.length === 0 && extra.length === 0 && tableWrites.length === 0;
  console.log(`${ok ? "PASS" : "FAIL"} unentitled caller -> ${body.mode}: http=${res.status}, googleapis calls=${google.length}, limit/VX RPCs=${extra.length}, writes=${tableWrites.length}`);
  if (!ok) failures++;
}

async function signed(body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("stub-app-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `sha256=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
async function whatsapp(from: string, text: string) {
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "gate", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "10000000000", phone_number_id: "000000000000000" },
      contacts: [{ profile: { name: "Gate" }, wa_id: from }],
      messages: [{ from, id: `wamid.gate.${crypto.randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
    } }] }],
  });
  return await post("whatsapp-webhook", { raw: payload, headers: { "x-hub-signature-256": await signed(payload) } });
}

console.log("## WhatsApp (the real webhook, signed inbound messages)");
{
  atomicNotices = true;
  firstNoticeTaken = new Set();
  reset("blocked_first_notice");
  const a = await whatsapp("10000000101", "what is the capital of Jordan?");
  const aOk = a.status === 200 && graphSends === 1 && providerCalls.length === 0;
  console.log(`${aOk ? "PASS" : "FAIL"} first message, unsubscribed sender: http=${a.status}, notices sent=${graphSends}, provider calls=${providerCalls.length}`);
  console.log(`INFO  other RPCs on that message: ${[...new Set(rpcCalls.filter((r) => !GATE_ONLY.has(r)))].join(",") || "none"}`);
  if (!aOk) failures++;

  reset("blocked_first_notice"); // same sender: the stub now answers blocked_silent
  const b = await whatsapp("10000000101", "and another question");
  const bOk = b.status === 200 && graphSends === 0 && providerCalls.length === 0;
  console.log(`${bOk ? "PASS" : "FAIL"} second message, same sender: http=${b.status}, replies sent=${graphSends}, provider calls=${providerCalls.length}`);
  console.log(`INFO  other RPCs on that message: ${[...new Set(rpcCalls.filter((r) => !GATE_ONLY.has(r)))].join(",") || "none"}`);
  if (!bOk) failures++;

  reset("blocked_first_notice");
  const burst = await Promise.all(Array.from({ length: 10 }, () => whatsapp("10000000202", "hello")));
  const cOk = burst.every((r) => r.status === 200) && graphSends === 1 && providerCalls.length === 0;
  console.log(`${cOk ? "PASS" : "FAIL"} 10 concurrent messages, one new sender: notices sent=${graphSends}, provider calls=${providerCalls.length}`);
  if (!cOk) failures++;

  atomicNotices = false;
  reset("authorized");
  const d = await whatsapp("10000000303", "what is the capital of Jordan?");
  const spent = rpcCalls.filter((r) => !GATE_ONLY.has(r));
  const dOk = d.status === 200 && (providerCalls.length > 0 || spent.length > 0);
  console.log(`${dOk ? "PASS" : "FAIL"} subscribed sender goes on to the assistant: http=${d.status}, provider attempts=${providerCalls.length}, other RPCs=${[...new Set(spent)].join(",") || "none"}`);
  if (!dOk) failures++;

  reset("error");
  await whatsapp("10000000404", "hello");
  const eOk = providerCalls.length === 0 && graphSends === 0;
  console.log(`${eOk ? "PASS" : "FAIL"} gate unreachable: silence, provider calls=${providerCalls.length}, replies=${graphSends}`);
  if (!eOk) failures++;
}

async function signedWith(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `sha256=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
async function messenger(sender: string, text: string, secret = "stub-meta-secret") {
  const payload = JSON.stringify({
    object: "page",
    entry: [{ id: "page1", time: Date.now(), messaging: [{
      sender: { id: sender }, recipient: { id: "page1" }, timestamp: Date.now(),
      message: { mid: `m_gate_${crypto.randomUUID()}`, text },
    }] }],
  });
  return await post("meta-messaging-webhook", { raw: payload, headers: { "x-hub-signature-256": await signedWith(secret, payload) } });
}

console.log("## Messenger / Instagram (the real meta-messaging-webhook, signed inbound messages)");
{
  atomicNotices = true;
  firstNoticeTaken = new Set();
  reset("blocked_first_notice");
  const bad = await messenger("5001", "hello", "wrong-secret");
  const badOk = bad.status === 403 && gateAsked === 0 && providerCalls.length === 0;
  console.log(`${badOk ? "PASS" : "FAIL"} forged delivery (bad signature): http=${bad.status}, gate asked=${gateAsked}, provider calls=${providerCalls.length}`);
  if (!badOk) failures++;

  reset("blocked_first_notice");
  const a = await messenger("5001", "what are your opening hours?");
  const aOk = a.status === 200 && gateAsked === 1 && graphSends === 1 && providerCalls.length === 0;
  console.log(`${aOk ? "PASS" : "FAIL"} first message, unsubscribed sender: http=${a.status}, gate asked=${gateAsked}, notices sent=${graphSends}, provider calls=${providerCalls.length}`);
  if (!aOk) failures++;

  reset("blocked_first_notice");
  const b = await messenger("5001", "hello?");
  const bOk = b.status === 200 && graphSends === 0 && providerCalls.length === 0;
  console.log(`${bOk ? "PASS" : "FAIL"} second message, same sender: http=${b.status}, replies sent=${graphSends}, provider calls=${providerCalls.length}`);
  if (!bOk) failures++;

  reset("blocked_first_notice");
  const burst = await Promise.all(Array.from({ length: 10 }, () => messenger("5002", "hello")));
  const cOk = burst.every((r) => r.status === 200) && graphSends === 1 && providerCalls.length === 0;
  console.log(`${cOk ? "PASS" : "FAIL"} 10 concurrent messages, one new sender: notices sent=${graphSends}, provider calls=${providerCalls.length}`);
  if (!cOk) failures++;

  reset("error");
  await messenger("5003", "hello");
  const eOk = providerCalls.length === 0 && graphSends === 0;
  console.log(`${eOk ? "PASS" : "FAIL"} gate unreachable: silence, provider calls=${providerCalls.length}, replies=${graphSends}`);
  if (!eOk) failures++;

  atomicNotices = false;
  reset("authorized");
  await messenger("5004", "what are your opening hours?");
  const dOk = providerCalls.length > 0;
  console.log(`${dOk ? "PASS" : "FAIL"} authorized sender reaches the assistant, so the gate is the only thing stopping the others: provider attempts=${providerCalls.length}`);
  if (!dOk) failures++;
}


console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
Deno.exit(failures === 0 ? 0 : 1);
