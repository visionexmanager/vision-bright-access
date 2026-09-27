// End-to-end harness for the Edge Functions a user reaches.
//
// Runs each function's own code — its handler, the router, the real providers,
// the real media processor — with only two things replaced:
//   1. Supabase (auth, database, storage) is a stub on localhost. It signs in a
//      test user, answers the limit and entitlement RPCs "allowed", stores what
//      is written, and records every RPC, so a charge or a quota check shows up.
//   2. Meta's Graph API is intercepted: WhatsApp messages and uploads are
//      recorded here and never sent. Nobody is messaged.
//
// Why a stub and not production: every one of these functions needs a signed-in
// user, and a test account on production is not something this harness creates.
// Why real providers: that is the part that fails in ways a unit test cannot see.
//
// The repository is public: this prints statuses, shapes, sizes and booleans —
// never a key, a prompt, an answer or a media URL.
//
// Run (CI): deno run --no-lock --node-modules-dir=none -A scripts/e2e/function-harness.ts

import { answerIsInScript } from "../../supabase/functions/_shared/answerLanguage.ts";

// ── Environment ───────────────────────────────────────────────────────────────
const STUB = "http://127.0.0.1:54321";
Deno.env.set("SUPABASE_URL", STUB);
Deno.env.set("SUPABASE_ANON_KEY", "stub-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service");
Deno.env.set("ALLOWED_ORIGINS", "https://visionex.app");
const USER_TOKEN = "e2e-user-token";
const USER_ID = "00000000-0000-4000-8000-00000000e2e0";

// ── What each case saw ────────────────────────────────────────────────────────
let rpcCalls: string[] = [];
let tableWrites: string[] = [];
let graphCalls: string[] = [];
let isAdmin = false;
const storage = new Map<string, Uint8Array>();

// ── Supabase stub ─────────────────────────────────────────────────────────────
const ALLOW = new Set([
  "check_ai_rate_limit", "check_ai_budget", "check_ai_anon_rate_limit", "user_has_section",
  "can_access_library_book_content", "whatsapp_entitlements",
]);
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

async function stub(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === "/auth/v1/user") {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    return token === USER_TOKEN
      ? json({ id: USER_ID, aud: "authenticated", role: "authenticated", email: "e2e@visionex.test", app_metadata: {}, user_metadata: {} })
      : json({ code: 401, msg: "invalid JWT" }, 401);
  }
  const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
  if (rpc) {
    rpcCalls.push(rpc[1]);
    if (rpc[1] === "has_role") return json(isAdmin);
    if (ALLOW.has(rpc[1])) return json(true);
    return json(null);
  }
  const table = path.match(/^\/rest\/v1\/([a-z0-9_]+)$/);
  if (table) {
    const single = (req.headers.get("Accept") ?? "").includes("vnd.pgrst.object");
    if (req.method === "GET" || req.method === "HEAD") return single ? json(null) : json([]);
    tableWrites.push(`${req.method.toLowerCase()}:${table[1]}`);
    const text = await req.text();
    let body: unknown = {};
    try { body = text ? JSON.parse(text) : {}; } catch { /* keep {} */ }
    const rows = (Array.isArray(body) ? body : [body]).map((row) => ({ id: crypto.randomUUID(), ...(row as object) }));
    return single ? json(rows[0] ?? null) : json(rows);
  }
  const object = path.match(/^\/storage\/v1\/object\/(?:public\/|authenticated\/)?([^/]+)\/(.+)$/);
  if (object && (req.method === "POST" || req.method === "PUT")) {
    storage.set(`${object[1]}/${object[2]}`, new Uint8Array(await req.arrayBuffer()));
    return json({ Key: `${object[1]}/${object[2]}` });
  }
  if (object && req.method === "GET") {
    const bytes = storage.get(`${object[1]}/${object[2]}`);
    return bytes ? new Response(bytes as BodyInit) : json({ error: "not found" }, 404);
  }
  if (path.startsWith("/storage/v1/object/sign/")) {
    return json({ signedURL: `${path.replace("/storage/v1", "")}?token=stub` });
  }
  return json({});
}
const originalServe = Deno.serve;
originalServe({ port: 54321, hostname: "127.0.0.1", onListen() {} }, stub);

// ── Graph API interception ────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes("graph.facebook.com")) {
    const u = new URL(url);
    let kind = "";
    if (typeof init?.body === "string") {
      try { kind = (JSON.parse(init.body) as { type?: string }).type ?? ""; } catch { /* not JSON */ }
    } else if (init?.body instanceof FormData) {
      kind = `upload:${String(init.body.get("type") ?? "")}`;
    }
    const last = u.pathname.split("/").pop();
    graphCalls.push(`${init?.method ?? "GET"} ${last}${kind ? ` ${kind}` : ""}`);
    if (last === "media") return json({ id: "stub-media-id" });
    if (last === "messages") return json({ messages: [{ id: "wamid.stub" }] });
    return json({});
  }
  return realFetch(input, init);
}) as typeof fetch;

// Work a function hands to EdgeRuntime.waitUntil is awaited before judging it.
const pending: Promise<unknown>[] = [];
(globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = { waitUntil: (p: Promise<unknown>) => { pending.push(p.catch(() => undefined)); } };

// ── Loading a function's handler ──────────────────────────────────────────────
type Handler = (req: Request) => Response | Promise<Response>;
const handlers = new Map<string, Handler>();
async function load(name: string): Promise<Handler> {
  const cached = handlers.get(name);
  if (cached) return cached;
  let captured: Handler | undefined;
  // std's http/server.ts serve (six functions use it) is mapped to a shim that calls this.
  (globalThis as { __e2eServe?: (h: Handler) => void }).__e2eServe = (h) => { captured = h; };
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (...args: unknown[]) => {
    captured = args.find((a) => typeof a === "function") as Handler
      ?? (args[0] as { handler?: Handler })?.handler;
    return { finished: Promise.resolve(), shutdown: async () => {}, addr: { hostname: "", port: 0 } };
  };
  await import(`../../supabase/functions/${name}/index.ts`);
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = originalServe;
  if (!captured) throw new Error(`${name}: no handler captured`);
  handlers.set(name, captured);
  return captured;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
async function digitsPng(text: string): Promise<string> {
  const GLYPHS: Record<string, string[]> = {
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  };
  const scale = 12, pad = 24, w = text.length * 6 * scale + pad * 2, h = 7 * scale + pad * 2;
  const raw = new Uint8Array((w + 1) * h).fill(0xff);
  for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
  [...text].forEach((ch, i) => GLYPHS[ch].forEach((row, gy) => [...row].forEach((bit, gx) => {
    if (bit !== "1") return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) raw[(pad + gy * scale + dy) * (w + 1) + 1 + pad + (i * 6 + gx) * scale + dx] = 0;
  })));
  const zipped = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  const crc = (b: Uint8Array) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array(4 + data.length); body.set(new TextEncoder().encode(type)); body.set(data, 4);
    const out = new Uint8Array(12 + data.length); const v = new DataView(out.buffer);
    v.setUint32(0, data.length); out.set(body, 4); v.setUint32(8 + data.length, crc(body)); return out;
  };
  const ihdr = new Uint8Array(13); new DataView(ihdr.buffer).setUint32(0, w); new DataView(ihdr.buffer).setUint32(4, h); ihdr[8] = 8;
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zipped), chunk("IEND", new Uint8Array())];
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { bytes.set(p, at); at += p.length; }
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return `data:image/png;base64,${btoa(bin)}`;
}
const IMAGE = await digitsPng("42");
let SPOKEN: string | null = null; // base64 mp3, filled by the first TTS that works

// ── Running a case ────────────────────────────────────────────────────────────
type Result = { fn: string; label: string; http: number; ms: number; verdict: string; detail: string; rpcs: string; graph: string };
const results: Result[] = [];

async function readBody(res: Response): Promise<{ kind: string; json?: Record<string, unknown>; text?: string; bytes?: number }> {
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) {
    const raw = await res.text();
    let text = "";
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try { text += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? ""; } catch { /* keep-alive */ }
    }
    return { kind: "sse", text };
  }
  if (type.includes("json")) {
    try { return { kind: "json", json: await res.json() }; } catch { return { kind: "json-invalid" }; }
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return { kind: type || "bytes", bytes: buf.length };
}

async function run(
  fn: string,
  label: string,
  body: unknown,
  judge: (r: { http: number; body: Awaited<ReturnType<typeof readBody>> }) => { ok: boolean; detail: string },
  opts: { admin?: boolean; headers?: Record<string, string>; raw?: string } = {},
) {
  rpcCalls = []; tableWrites = []; graphCalls = []; isAdmin = !!opts.admin; pending.length = 0;
  const started = Date.now();
  let http = 0, verdict = "ERROR", detail = "";
  try {
    const handler = await load(fn);
    const req = new Request(`https://nnyxtaftwispowolajpl.supabase.co/functions/v1/${fn}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER_TOKEN}`, apikey: "stub-anon", "Content-Type": "application/json", Origin: "https://visionex.app", ...(opts.headers ?? {}) },
      body: opts.raw ?? JSON.stringify(body),
    });
    const res = await Promise.race([
      Promise.resolve(handler(req)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 150_000)),
    ]);
    http = res.status;
    const parsed = await readBody(res);
    await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, 60_000))]);
    const judged = judge({ http, body: parsed });
    verdict = judged.ok ? "PASS" : "FAIL";
    detail = judged.detail;
  } catch (e) {
    detail = e instanceof Error ? e.message.slice(0, 80) : "threw";
  }
  const unique = (xs: string[]) => [...new Set(xs)].join(" ");
  const row = { fn, label, http, ms: Date.now() - started, verdict, detail, rpcs: unique(rpcCalls), graph: graphCalls.join(" | ") };
  results.push(row);
  console.log(`${row.verdict} ${fn} [${label}] http=${row.http} ${row.ms}ms :: ${row.detail} :: rpc(${row.rpcs}) ${row.graph ? `:: graph(${row.graph})` : ""}`);
}

const keysOf = (j?: Record<string, unknown>) => Object.keys(j ?? {}).slice(0, 8).join(",");
const okJson = (need: string[]) => ({ http, body }: { http: number; body: Awaited<ReturnType<typeof readBody>> }) => {
  const j = body.json ?? {};
  const missing = need.filter((k) => j[k] === undefined || j[k] === null || j[k] === "");
  return { ok: http === 200 && missing.length === 0, detail: `keys=${keysOf(j)}${missing.length ? ` missing=${missing.join(",")}` : ""}${j.error ? ` error=${String(j.error).slice(0, 70)}` : ""}` };
};
const okStream = (script: "arabic" | "latin") => ({ http, body }: { http: number; body: Awaited<ReturnType<typeof readBody>> }) => {
  const text = body.text ?? "";
  const lang = answerIsInScript(text, script);
  return { ok: http === 200 && body.kind === "sse" && text.trim().length > 10 && lang, detail: `kind=${body.kind} chars=${text.length} in_${script}=${lang}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` };
};
const expectStatus = (status: number) => ({ http, body }: { http: number; body: Awaited<ReturnType<typeof readBody>> }) =>
  ({ ok: http === status, detail: `expected ${status}; keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}${body.json?.code ? ` code=${body.json.code}` : ""}` });

const AR = "كيف أبدأ بتعلم البرمجة؟ أجب باختصار.";

// ── The cases: what the site sends, function by function ─────────────────────
await run("ai-chat", "default assistant, Arabic", { messages: [{ role: "user", content: AR }] }, okStream("arabic"));
await run("ai-chat", "legal assistant, Arabic", { messages: [{ role: "user", content: "ما هي حقوقي إذا تأخر راتبي؟" }], assistantId: "legal-advisor" }, okStream("arabic"));
await run("academy-chat", "tutor, Arabic", { messages: [{ role: "user", content: AR }], studentProfile: { name: "Test", level: "beginner", interests: ["coding"] }, language: "ar" }, okStream("arabic"));
await run("ai-voice-chat", "voice chat, Arabic", { messages: [{ role: "user", content: AR }], assistant: "visionex", language: "ar" }, ({ http, body }) => ({ ok: http === 200, detail: `kind=${body.kind} keys=${keysOf(body.json)} chars=${body.text?.length ?? 0} bytes=${body.bytes ?? 0}` }));
await run("realtime-session", "session token", { assistant: "visionex" }, ({ http, body }) => ({ ok: http === 200 && !!body.json, detail: `keys=${keysOf(body.json)}` }));
await run("radar-ai", "scene description", { image: IMAGE, lang: "en" }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("analyze-meal", "meal photo", { image: IMAGE, lang: "en" }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("generate-diet-plan", "diet plan", { name: "Test", weight: "70", height: "175", goal: "maintain", lang: "ar" }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("ocr-scan", "read digits", { image: IMAGE, lang: "en" }, ({ http, body }) => ({ ok: http === 200 && JSON.stringify(body.json ?? {}).includes("42"), detail: `keys=${keysOf(body.json)} has_42=${JSON.stringify(body.json ?? {}).includes("42")}` }));
await run("analyze-image", "skin analyst", { analystId: "skin-care", image: IMAGE, lang: "en" }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}` }));
await run("ai-generate", "travel plan, Arabic", { generatorId: "travel-itinerary", params: { destination: "Amman", days: "2", budget: "moderate", interests: "food", accessibility: "blind traveller" }, lang: "ar" }, okJson(["result"]));
await run("ai-search", "semantic search", { query: "white cane", limit: 3 }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("document-generate", "summarize, Arabic", { mode: "summarize", input_text: "Visionex is an accessible platform for blind and low-vision people. It offers AI assistants, a library, courses and a marketplace. It works in twenty languages.", language: "ar" }, okJson(["result"]));
await run("text-tools-generate", "writing tool", { tool: "writing", prompt: "A short welcome note for new users.", language: "en" }, okJson(["result"]));
await run("image-generate", "image, low cost", { prompt: "A plain blue circle on a white background.", size: "1024x1024", quality: "standard" }, ({ http, body }) => ({ ok: http === 200 && !!body.json?.image_url, detail: `keys=${keysOf(body.json)} stored=${[...storage.keys()].some((k) => k.startsWith("image"))}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("kids-story-generate", "story", { prompt: "A cat who learns to read.", ageGroup: "6-8", language: "en" }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("kids-ai-teacher", "question", { question: "Why is the sky blue?", subject: "science", ageGroup: "6-8", language: "en", history: [] }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("kids-course-generate", "admin: course", { topic: "Colours", subjectSlug: "art", ageRange: "6-8", language: "en" }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }), { admin: true });
await run("kids-drawing-to-art", "drawing to art", { image: IMAGE }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("text-to-speech", "speech", { text: "Hello from Visionex, forty two.", voice: "alloy" }, ({ http, body }) => {
  const b64 = typeof body.json?.audio === "string" ? body.json.audio as string : typeof body.json?.audioContent === "string" ? body.json.audioContent as string : "";
  if (b64 && !SPOKEN) SPOKEN = b64;
  return { ok: http === 200 && (body.bytes ?? 0) + b64.length > 1000, detail: `kind=${body.kind} bytes=${body.bytes ?? 0} b64=${b64.length} keys=${keysOf(body.json)}` };
});
await run("speech-generate", "studio TTS", { text: "Hello from Visionex, forty two.", voice_id: "alloy", provider_voice_id: "alloy", provider: "openai", output_format: "mp3" }, ({ http, body }) => {
  const b64 = typeof body.json?.audio_base64 === "string" ? body.json.audio_base64 as string : "";
  if (b64) SPOKEN = b64;
  return { ok: http === 200 && b64.length > 1000, detail: `keys=${keysOf(body.json)} b64=${b64.length}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` };
});
await run("speech-transcribe", "transcribe the TTS", { audio_base64: SPOKEN ?? "", mime_type: "audio/mpeg", filename: "hello.mp3" }, ({ http, body }) => {
  const text = String(body.json?.transcript_text ?? "");
  return { ok: http === 200 && /hello|visionex|42|forty/i.test(text), detail: `keys=${keysOf(body.json)} heard=${/hello|visionex|42|forty/i.test(text)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` };
});
await run("file-convert", "mp3 → m4a", { file: SPOKEN ?? "", target: "m4a" }, ({ http, body }) => ({ ok: http === 200, detail: `kind=${body.kind} keys=${keysOf(body.json)} bytes=${body.bytes ?? 0}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("library-translate-comment", "translate", { text: "This book is wonderful.", target_language: "ar" }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }));
await run("moderate-content", "moderation", { text: "Have a nice day." }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}` }));
// Parked providers: a controlled refusal is the correct result.
await run("image-tools-generate", "parked: Replicate", { action: "generate", mode: "upscale", image_url: `${STUB}/storage/v1/object/public/image-tool-inputs/${USER_ID}/a.png` }, expectStatus(503));
await run("video-studio", "parked: Luma", { action: "generate", prompt: "A calm sea at sunset.", duration_sec: 5 }, expectStatus(503));
// Admin tools.
await run("enrich-product", "admin: enrich product", { name: "White cane", description: "Folding cane" }, ({ http, body }) => ({ ok: http === 200, detail: `keys=${keysOf(body.json)}${body.json?.error ? ` error=${String(body.json.error).slice(0, 70)}` : ""}` }), { admin: true });

// ── WhatsApp: a signed inbound message through the real webhook; replies are intercepted ──
async function signed(body: string): Promise<string> {
  const secret = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `sha256=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
async function whatsapp(label: string, text: string) {
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "e2e", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "10000000000", phone_number_id: Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "0" },
      contacts: [{ profile: { name: "E2E" }, wa_id: "10000000001" }],
      messages: [{ from: "10000000001", id: `wamid.e2e.${crypto.randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
    } }] }],
  });
  await run("whatsapp-webhook", label, null, ({ http }) => ({
    ok: http === 200 && graphCalls.some((c) => c.includes("messages")),
    detail: `replies=${graphCalls.filter((c) => c.includes("messages")).length} uploads=${graphCalls.filter((c) => c.includes("upload")).length}`,
  }), { raw: payload, headers: { "x-hub-signature-256": await signed(payload) } });
}
await whatsapp("text question, Arabic", "ما هي عاصمة الأردن؟");
await whatsapp("menu", "القائمة");

// ── Report ────────────────────────────────────────────────────────────────────
const table = [
  "| function | case | verdict | http | ms | detail | rpc | graph |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.fn} | ${r.label} | ${r.verdict} | ${r.http} | ${r.ms} | ${r.detail} | ${r.rpcs} | ${r.graph} |`),
  "",
  `${results.filter((r) => r.verdict === "PASS").length}/${results.length} passed`,
].join("\n");
console.log(`\n${table}`);
const summary = Deno.env.get("GITHUB_STEP_SUMMARY");
if (summary) await Deno.writeTextFile(summary, `## Edge Function end-to-end\n\n${table}\n`, { append: true });
Deno.exit(0);
