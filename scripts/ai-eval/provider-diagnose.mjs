#!/usr/bin/env node
//
// Root-cause diagnosis for the providers the smoke test found unusable:
// Bytez, OpenRouter, NVIDIA NIM — and FAL, which no code calls yet.
//
//   node scripts/ai-eval/provider-diagnose.mjs [--media]
//
// Where provider-smoke.mjs answers "does it work", this answers "why not":
// it prints each failure's provider-side error *message*, sanitised — cut to
// 160 characters, with anything shaped like a key, token, e-mail address or URL
// query replaced — because a bare 404 or 429 cannot tell a retired model from
// an unfunded account. It prints no response body beyond that sentence, and no
// header but the published rate-limit ceilings.
//
// Cost: text probes use a handful of tokens each. `--media` adds one FAL
// image (flux/schnell, one small image) and one short FAL video submission on
// the cheapest current text-to-video endpoint, polled for at most 4 minutes.

import { deflateSync } from "node:zlib";

const args = process.argv.slice(2);
const MEDIA = args.includes("--media");
const TIMEOUT_MS = 45_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = (n) => (process.env[n] ?? "").trim();

const SECRETS = ["OPENAI_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "NVIDIA_NIM_API_KEY", "OPENROUTER_API_KEY", "BYTEZ_API_KEY", "FAL_KEY"]
  .map(env).filter((v) => v.length >= 8);

/** A provider's sentence, safe to print on a public log. */
function sanitize(text) {
  if (typeof text !== "string") return undefined;
  let s = text;
  for (const secret of SECRETS) s = s.split(secret).join("[key]");
  s = s
    .replace(/\b(sk|nvapi|pk|rk|key|bearer)[-_][A-Za-z0-9_-]{8,}/gi, "[key]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[id]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(https?:\/\/[^\s?"']+)\?[^\s"']*/g, "$1?[query]")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, 160);
}

function messageOf(body) {
  if (!body || typeof body !== "object") return typeof body === "string" ? body : undefined;
  const e = body.error ?? body.detail ?? body;
  if (typeof e === "string") return e;
  if (Array.isArray(e)) return e.map((x) => x?.msg ?? x?.message ?? "").join("; ");
  return e?.message ?? e?.msg ?? e?.detail ?? body.message ?? body.title;
}

const RATE = ["x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"];

async function call(url, init = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeout ?? TIMEOUT_MS) });
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    const rate = {};
    for (const h of RATE) { const v = res.headers.get(h); if (v && v.length < 40) rate[h] = v; }
    return { status: res.status, ms: Date.now() - start, body, rate };
  } catch (e) {
    return { status: 0, ms: Date.now() - start, body: null, rate: {}, net: e?.name === "TimeoutError" ? "timeout" : "network" };
  }
}

const rows = [];
const facts = {};
function row(provider, probe, model, r, ok, extra = "") {
  const why = ok ? "" : (r.net ?? sanitize(messageOf(r.body)) ?? "");
  const rate = Object.entries(r.rate ?? {}).map(([k, v]) => `${k.replace("x-ratelimit-", "")}=${v}`).join(" ");
  rows.push({ provider, probe, model, ok, status: r.status, ms: r.ms, why, rate, extra });
}

const json = (h) => ({ "Content-Type": "application/json", ...h });
const ASK = [{ role: "user", content: "Reply with exactly the word OK." }];
const TOOL = { type: "function", function: { name: "answer", description: "Return the answer.", parameters: { type: "object", properties: { word: { type: "string" } }, required: ["word"] } } };
// A valid 64×32 PNG: a red square left, a blue square right.
function png() {
  const w = 64, h = 32, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3;
    raw[o] = x < 32 ? 220 : 20; raw[o + 1] = 20; raw[o + 2] = x < 32 ? 20 : 220;
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const IMG = `data:image/png;base64,${png().toString("base64")}`;
const textOf = (j) => j?.choices?.[0]?.message?.content ?? "";

async function chatProbe(provider, base, headers, model, kind, extra = {}) {
  const body = kind === "tools"
    ? { model, messages: [{ role: "user", content: "Call the answer tool with the word OK." }], tools: [TOOL], tool_choice: "auto", max_tokens: 256, ...extra }
    : kind === "json"
      ? { model, messages: [{ role: "user", content: 'Return {"word":"OK"} as JSON.' }], response_format: { type: "json_object" }, max_tokens: 256, ...extra }
      : kind === "vision"
        ? { model, messages: [{ role: "user", content: [{ type: "text", text: "Describe this image in three words." }, { type: "image_url", image_url: { url: IMG } }] }], max_tokens: 256, ...extra }
        : { model, messages: ASK, max_tokens: 256, ...extra };
  const r = await call(`${base}/chat/completions`, { method: "POST", headers: json(headers), body: JSON.stringify(body) });
  const msg = r.body?.choices?.[0]?.message;
  const ok = r.status === 200 && (
    kind === "tools" ? Boolean(msg?.tool_calls?.length) :
    kind === "json" ? (() => { try { return /ok/i.test(JSON.parse(textOf(r.body)).word); } catch { return false; } })() :
    kind === "vision" ? textOf(r.body).trim().length > 0 :
    /\bok\b/i.test(textOf(r.body)));
  row(provider, kind, model, r, ok, r.status === 200 && !ok ? "answered, wrong shape" : "");
  return ok;
}

// ── Bytez ────────────────────────────────────────────────────────────────────

async function bytez(key) {
  facts.bytez = { key_length_class: key.length > 40 ? "long" : "short" };
  const base = "https://api.bytez.com/models/v2";
  // Both header forms the docs have shown, so the auth failure mode is visible.
  for (const [label, auth] of [["bare", key], ["Key-prefix", `Key ${key}`], ["Bearer", `Bearer ${key}`]]) {
    const r = await call(`${base}/list/models`, { headers: { Authorization: auth } });
    const list = Array.isArray(r.body?.output) ? r.body.output : [];
    row("bytez", `list(${label})`, "-", r, r.status === 200 && list.length > 0, `rows=${list.length}`);
    if (list.length) {
      facts.bytez.auth_form = label;
      facts.bytez.tasks = [...new Set(list.map((m) => m.task))].slice(0, 30);
      facts.bytez.chat_sample = list.filter((m) => m.task === "chat").map((m) => m.modelId).slice(0, 15);
      facts.bytez.meters = [...new Set(list.map((m) => m.meter))].slice(0, 10);
      break;
    }
  }
  const auth = facts.bytez.auth_form === "Key-prefix" ? `Key ${key}` : facts.bytez.auth_form === "Bearer" ? `Bearer ${key}` : key;
  // Is the empty listing ours alone? The same listing with no key, per task.
  for (const task of ["chat", "text-generation"]) {
    const pub = await call(`${base}/list/models?task=${task}`, {});
    const mine = await call(`${base}/list/models?task=${task}`, { headers: { Authorization: key } });
    const n = (r) => (Array.isArray(r.body?.output) ? r.body.output.length : 0);
    row("bytez", `list?task=${task}(no-key)`, "-", pub, n(pub) > 0, `rows=${n(pub)}`);
    row("bytez", `list?task=${task}(our key)`, "-", mine, n(mine) > 0, `rows=${n(mine)}`);
    if (n(pub) && !facts.bytez.public_sample) {
      facts.bytez.public_sample = pub.body.output.filter((m) => (m.params ?? 99) <= 7).slice(0, 8).map((m) => `${m.modelId} (${m.params}B, ${m.meter})`);
    }
  }
  const r2 = await call(`${base}/list/tasks`, { headers: { Authorization: auth } });
  row("bytez", "list/tasks", "-", r2, r2.status === 200);
  // Whose side is a "model does not exist"? The documented example model,
  // asked with no key and with a Bearer key: if a request without any key gets
  // the same answer, Bytez is not reading the key at all on this route.
  for (const [label, h] of [["no-key", {}], ["Bearer", { Authorization: `Bearer ${key}` }], ["wrong-key", { Authorization: "not-a-real-key" }]]) {
    const r = await call(`${base}/openai/v1/chat/completions`, { method: "POST", headers: json(h), body: JSON.stringify({ model: "Qwen/Qwen3-4B", messages: ASK, max_tokens: 16 }) });
    row("bytez", `text(${label})`, "Qwen/Qwen3-4B", r, r.status === 200);
  }
  const publicSmall = (facts.bytez.public_sample ?? []).map((x) => x.split(" ")[0]).slice(0, 2);
  const candidates = [...new Set([...publicSmall, ...(facts.bytez.chat_sample ?? []).slice(0, 3), "Qwen/Qwen3-4B", "openai/gpt-4o-mini", "google/gemma-3-1b-it"])];
  for (const model of candidates.slice(0, 5)) {
    await chatProbe("bytez", `${base}/openai/v1`, { Authorization: auth }, model, "text");
    const n = await call(`${base}/${model}`, { method: "POST", headers: json({ Authorization: auth }), body: JSON.stringify({ messages: ASK, params: { max_new_tokens: 32 } }) });
    row("bytez", "native", model, n, n.status === 200 && /ok/i.test(JSON.stringify(n.body?.output ?? "")));
  }
}

// ── OpenRouter ───────────────────────────────────────────────────────────────

async function openrouter(key) {
  const base = "https://openrouter.ai/api/v1";
  // OpenRouter asks callers to identify the app; neither header is auth.
  const headers = { Authorization: `Bearer ${key}`, "HTTP-Referer": "https://visionex.app", "X-Title": "Visionex" };
  const k = await call(`${base}/key`, { headers });
  const d = k.body?.data ?? {};
  facts.openrouter = {
    key_status: k.status,
    is_free_tier: d.is_free_tier,
    has_key_limit: d.limit != null,
    key_limit_remaining_positive: d.limit_remaining == null ? null : d.limit_remaining > 0,
    usage_positive: typeof d.usage === "number" ? d.usage > 0 : null,
    rate_limit: d.rate_limit ?? null,
  };
  const c = await call(`${base}/credits`, { headers });
  facts.openrouter.credits_status = c.status;
  if (c.status === 200) facts.openrouter.credits_remaining_positive = (c.body?.data?.total_credits ?? 0) - (c.body?.data?.total_usage ?? 0) > 0;
  const m = await call(`${base}/models`, { headers });
  const models = Array.isArray(m.body?.data) ? m.body.data : [];
  const free = models.filter((x) => x.id.endsWith(":free"));
  facts.openrouter.free_models = free.map((x) => x.id);
  const withTools = free.filter((x) => (x.supported_parameters ?? []).includes("tools")).map((x) => x.id);
  const withVision = free.filter((x) => (x.architecture?.input_modalities ?? []).includes("image")).map((x) => x.id);
  facts.openrouter.free_tools = withTools;
  facts.openrouter.free_vision = withVision;
  // Every free model once, paced: which answer at all, and why the rest do not.
  for (const x of free.slice(0, 20)) {
    await chatProbe("openrouter", base, headers, x.id, "text");
    await sleep(3500); // free models: 20 requests a minute
  }
  for (const id of withTools.slice(0, 2)) { await chatProbe("openrouter", base, headers, id, "tools"); await sleep(3500); }
  for (const id of withVision.slice(0, 2)) { await chatProbe("openrouter", base, headers, id, "vision"); await sleep(3500); }
  for (const id of ["google/gemma-4-26b-a4b-it:free", "inclusionai/ling-3.0-flash-fin:free"]) { await chatProbe("openrouter", base, headers, id, "json"); await sleep(3500); }
  const e = await call(`${base}/embeddings`, { method: "POST", headers: json(headers), body: JSON.stringify({ model: "openai/text-embedding-3-small", input: ["hello"] }) });
  row("openrouter", "embeddings", "openai/text-embedding-3-small", e, e.status === 200 && (e.body?.data?.[0]?.embedding?.length ?? 0) > 0);
  await chatProbe("openrouter", base, headers, "openai/gpt-4o-mini", "text");
  await chatProbe("openrouter", base, headers, "openrouter/auto", "text");
}

// ── NVIDIA NIM ───────────────────────────────────────────────────────────────

async function nim(key) {
  const base = "https://integrate.api.nvidia.com/v1";
  facts.nim = { key_form: key.startsWith("nvapi-") ? "nvapi- (build.nvidia.com API key)" : "other" };
  const headers = { Authorization: `Bearer ${key}` };
  const l = await call(`${base}/models`, { headers });
  const ids = Array.isArray(l.body?.data) ? l.body.data.map((x) => x.id) : [];
  facts.nim.listed = ids.length;
  // The listing proved stale on 2026-09-26, so try every listed chat-shaped id
  // plus current catalogue ids, and let generation decide.
  const current = ["deepseek-ai/deepseek-v4-flash", "meta/llama-3.1-70b-instruct", "mistralai/mixtral-8x22b-instruct", "nvidia/llama-3.3-nemotron-super-49b-v1", "qwen/qwen3-next-80b-a3b-instruct", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "meta/llama-3.2-11b-vision-instruct", "meta/llama-3.2-90b-vision-instruct", "google/gemma-3-27b-it", "microsoft/phi-4-mini-instruct", "moonshotai/kimi-k2-instruct"];
  const chatty = ids.filter((i) => !/embed|rerank|guard|reward|safety|nemoretriever|parse|ocr|clip|detector|vlm-embed|translate|sdxl|flux|stable/i.test(i));
  const all = [...new Set([...current, ...chatty])];
  const working = [];
  const byStatus = {};
  for (const model of all) {
    const r = await call(`${base}/chat/completions`, { method: "POST", headers: json(headers), body: JSON.stringify({ model, messages: ASK, max_tokens: 64 }), timeout: 20_000 });
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const ok = r.status === 200 && textOf(r.body).length > 0;
    if (ok) working.push(model);
    // Print each distinct failure reason once, not 80 times.
    if (!ok && !rows.some((x) => x.provider === "nim" && x.status === r.status && x.why === (r.net ?? sanitize(messageOf(r.body)) ?? ""))) row("nim", "text", model, r, false);
    await sleep(1600); // 40 requests a minute on the trial tier
  }
  facts.nim.tried = all.length;
  facts.nim.status_counts = byStatus;
  facts.nim.working_text = working;
  for (const model of working.slice(0, 3)) {
    await chatProbe("nim", base, headers, model, "text"); await sleep(1600);
    await chatProbe("nim", base, headers, model, "tools"); await sleep(1600);
    await chatProbe("nim", base, headers, model, "json"); await sleep(1600);
  }
  for (const model of ["meta/llama-3.2-11b-vision-instruct", "meta/llama-3.2-90b-vision-instruct"]) { await chatProbe("nim", base, headers, model, "vision"); await sleep(1600); }
}

// ── FAL ──────────────────────────────────────────────────────────────────────

async function fal(key) {
  const headers = { Authorization: `Key ${key}` };
  facts.fal = {};
  // Auth without spending: an unknown request id on a real app is 404 with a
  // valid key, 401/403 with a bad one.
  const a = await call("https://queue.fal.run/fal-ai/flux/requests/00000000-0000-0000-0000-000000000000/status", { headers });
  row("fal", "auth(no-spend)", "fal-ai/flux", a, a.status !== 401 && a.status !== 403);
  const ids = ["fal-ai/flux/schnell", "fal-ai/flux/dev", "fal-ai/flux-pro/v1.1", "fal-ai/ltx-video", "fal-ai/wan/v2.2-5b/text-to-video", "fal-ai/kling-video/v2.1/standard/text-to-video"];
  const p = await call(`https://api.fal.ai/v1/models/pricing?${ids.map((i) => `endpoint_id=${encodeURIComponent(i)}`).join("&")}`, { headers });
  row("fal", "pricing(no-spend)", "-", p, p.status === 200);
  const prices = Array.isArray(p.body?.prices) ? p.body.prices : [];
  facts.fal.pricing_body_keys = p.body && typeof p.body === "object" ? Object.keys(p.body).slice(0, 10) : typeof p.body;
  facts.fal.prices = prices.map((x) => `${x.endpoint_id}: ${x.unit_price} ${x.currency ?? "USD"} per ${x.unit}`);
  if (!MEDIA) return;
  const queued = async (app, input, maxMs) => {
    const s = await call(`https://queue.fal.run/${app}`, { method: "POST", headers: json(headers), body: JSON.stringify(input) });
    row("fal", "submit", app, s, s.status === 200 && Boolean(s.body?.request_id));
    if (!s.body?.request_id) return null;
    const statusUrl = s.body.status_url, resultUrl = s.body.response_url;
    const t0 = Date.now();
    let st;
    do {
      await sleep(3000);
      st = await call(statusUrl, { headers });
    } while (st.status === 200 && ["IN_QUEUE", "IN_PROGRESS"].includes(st.body?.status) && Date.now() - t0 < maxMs);
    const done = st.body?.status === "COMPLETED";
    const r = done ? await call(resultUrl, { headers }) : st;
    r.ms = Date.now() - t0;
    return { r, done };
  };
  const img = await queued("fal-ai/flux/schnell", { prompt: "A plain blue circle on white.", image_size: "square", num_images: 1, num_inference_steps: 2 }, 90_000);
  if (img) row("fal", "image", "fal-ai/flux/schnell", img.r, img.done && Boolean(img.r.body?.images?.[0]?.url), img.done ? `images=${img.r.body?.images?.length ?? 0}` : "not completed");
  const vid = await queued("fal-ai/ltx-video", { prompt: "A slow pan across a calm blue sea.", num_inference_steps: 8 }, 240_000);
  if (vid) row("fal", "video", "fal-ai/ltx-video", vid.r, vid.done && Boolean(vid.r.body?.video?.url), vid.done ? "video url returned" : "not completed");
}

const PROVIDERS = [["bytez", "BYTEZ_API_KEY", bytez], ["openrouter", "OPENROUTER_API_KEY", openrouter], ["nim", "NVIDIA_NIM_API_KEY", nim], ["fal", "FAL_KEY", fal]];
for (const [name, envName, run] of PROVIDERS) {
  const key = env(envName);
  if (!key) { rows.push({ provider: name, probe: "key", model: "-", ok: false, status: 0, ms: 0, why: "no key in runner", rate: "", extra: "" }); continue; }
  try { await run(key); } catch (e) { rows.push({ provider: name, probe: "script", model: "-", ok: false, status: 0, ms: 0, why: `script_error:${e?.name}`, rate: "", extra: "" }); }
}

console.log(["## Provider diagnosis", "", "| provider | probe | model | result | HTTP | ms | provider's reason (sanitised) | rate | note |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.provider} | ${r.probe} | \`${r.model}\` | ${r.ok ? "PASS" : "FAIL"} | ${r.status} | ${r.ms} | ${(r.why ?? "").replace(/\|/g, "/")} | ${r.rate} | ${r.extra} |`),
  "", "### Facts", "", "```json", JSON.stringify(facts, null, 2), "```"].join("\n"));
