#!/usr/bin/env node
//
// Real generation smoke tests for every AI provider key this runner holds.
//
//   node scripts/ai-eval/provider-smoke.mjs [--media] [--out smoke.json]
//
// A listing is not a health check (see list-models.mjs): this script *generates*
// — one tiny request per provider, model and capability — and checks that the
// answer has the shape our adapters parse. It answers "does this key, this
// endpoint and this model work right now", which is the question a key's mere
// existence never answers.
//
// Safe to run on a public repository:
//   - no key is printed, and no response body is printed — only the HTTP
//     status, latency, a pass/fail shape check, published rate-limit ceilings
//     and, for a failure, the provider's own short error *code* (never its text);
//   - inputs are fixed and synthetic: the word "OK", the drawing below, and a
//     short spoken phrase this script synthesises itself;
//   - cost is a few thousand tokens in total. `--media` adds one low-quality
//     image generation (about one US cent); nothing generates video.
//
// Exit status is 0 even when a provider fails: a failed probe is a finding to
// report, not a broken build.

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const MEDIA = args.includes("--media");
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
const TIMEOUT_MS = 45_000;

// ── A deterministic test image: "HELLO 42" in a 5×7 bitmap font ─────────────

const GLYPHS = {
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function textPng(text, scale = 12, pad = 24) {
  const w = text.length * 6 * scale + pad * 2, h = 7 * scale + pad * 2;
  const raw = Buffer.alloc((w + 1) * h, 0xff);
  for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0; // filter byte
  [...text].forEach((ch, i) => {
    GLYPHS[ch].forEach((row, gy) => [...row].forEach((bit, gx) => {
      if (bit !== "1") return;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const x = pad + (i * 6 + gx) * scale + dx, y = pad + gy * scale + dy;
        raw[y * (w + 1) + 1 + x] = 0;
      }
    }));
  });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; // 8-bit greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const IMAGE_URL = `data:image/png;base64,${textPng("HELLO 42").toString("base64")}`;
const ASK_OK = [{ role: "user", content: "Reply with exactly the word OK." }];
const ASK_IMAGE = [{ role: "user", content: [
  { type: "text", text: "What number is written in this image? Reply with the digits only." },
  { type: "image_url", image_url: { url: IMAGE_URL } },
] }];
const TOOL = {
  type: "function",
  function: {
    name: "answer",
    description: "Return the answer.",
    parameters: { type: "object", properties: { word: { type: "string" } }, required: ["word"] },
  },
};
const ASK_TOOL = [{ role: "user", content: "Call the answer tool with the word OK." }];

let spokenAudio = null; // filled by the first TTS probe that succeeds, used for STT

// ── Probe plumbing ───────────────────────────────────────────────────────────

const RATE_HEADERS = [
  "x-ratelimit-limit-requests", "x-ratelimit-limit-tokens",
  "x-ratelimit-limit-requests-day", "x-ratelimit-limit-tokens-minute",
  "ratelimit-limit", "x-ratelimit-limit", "x-ratelimitbysize-limit-minute", "x-ratelimitbysize-limit-month", "retry-after",
];

function rateOf(res) {
  const out = {};
  for (const h of RATE_HEADERS) { const v = res.headers.get(h); if (v && v.length < 40) out[h] = v; }
  return out;
}

/** The provider's own short error code, never its message: messages can echo input. */
function errorCodeOf(json) {
  const e = json?.error ?? json;
  const code = e?.code ?? e?.type ?? e?.status ?? json?.detail?.type;
  return typeof code === "string" && /^[\w.-]{1,48}$/.test(code) ? code : undefined;
}

// Minimum gap between requests to one host. Mistral's entry tier allows about
// one request per second; without this the probe measures its own burst.
const PACE_MS = { "api.mistral.ai": 1500 };
const lastCall = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(url, init) {
  const host = new URL(url).host;
  const gap = PACE_MS[host];
  if (gap && lastCall[host]) await sleep(Math.max(0, lastCall[host] + gap - Date.now()));
  lastCall[host] = Date.now();
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = res.headers.get("content-type") ?? "";
    const body = type.includes("json") ? await res.json().catch(() => null) : Buffer.from(await res.arrayBuffer());
    return { status: res.status, ms: Date.now() - start, body, rate: rateOf(res) };
  } catch (e) {
    return { status: 0, ms: Date.now() - start, body: null, rate: {}, net: e?.name === "TimeoutError" ? "timeout" : "network" };
  }
}

const results = [];

async function probe(provider, capability, model, run) {
  const r = await run();
  let ok = false, note;
  try { ok = r.status >= 200 && r.status < 300 && Boolean(r.check?.(r.body)); } catch { ok = false; }
  if (!ok) note = r.net ?? errorCodeOf(r.body) ?? (r.status >= 200 && r.status < 300 ? "unexpected_shape" : undefined);
  results.push({ provider, capability, model, ok, status: r.status, ms: r.ms, ...(note ? { note } : {}), ...(Object.keys(r.rate).length ? { rate: r.rate } : {}) });
  return { ...r, ok };
}

const bearer = (key, extra = {}) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra });
const post = (url, headers, body) => call(url, { method: "POST", headers, body: JSON.stringify(body) });
const textOf = (j) => j?.choices?.[0]?.message?.content ?? "";
const saysOk = (j) => /\bok\b/i.test(textOf(j));
const says42 = (j) => /42/.test(textOf(j));
const toolOk = (j) => {
  const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return typeof args === "string" && /ok/i.test(JSON.parse(args).word ?? "");
};

async function openAICompatible(provider, base, key, { chat = [], tool = [], vision = [], extra = {}, auth = bearer }) {
  for (const model of chat) {
    await probe(provider, "text", model, async () => ({ ...(await post(`${base}/chat/completions`, auth(key), { model, messages: ASK_OK, ...(extra[model] ?? { max_tokens: 16 }) })), check: saysOk }));
  }
  for (const model of tool) {
    await probe(provider, "tool_calling", model, async () => ({ ...(await post(`${base}/chat/completions`, auth(key), { model, messages: ASK_TOOL, tools: [TOOL], tool_choice: { type: "function", function: { name: "answer" } }, ...(extra[model] ?? { max_tokens: 64 }) })), check: toolOk }));
  }
  for (const model of vision) {
    await probe(provider, "vision", model, async () => ({ ...(await post(`${base}/chat/completions`, auth(key), { model, messages: ASK_IMAGE, ...(extra[model] ?? { max_tokens: 16 }) })), check: says42 }));
  }
  await probe(provider, "error_shape", "no-such-model-visionex", async () => {
    const r = await post(`${base}/chat/completions`, auth(key), { model: "no-such-model-visionex", messages: ASK_OK, max_tokens: 4 });
    // Passing means: an unknown model is a clean 4xx, not a 5xx or a hang.
    return { ...r, status: r.status >= 400 && r.status < 500 ? 200 : r.status || 599, check: () => true };
  });
}

async function listIds(url, headers, pick = (j) => (j?.data ?? []).map((m) => m.id)) {
  const r = await call(url, { headers });
  return { status: r.status, ids: r.status === 200 ? pick(r.body) ?? [] : [] };
}

function multipart(fields, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([file.bytes], { type: file.type }), file.name);
  return form;
}

// ── Providers ────────────────────────────────────────────────────────────────

const env = (name) => (process.env[name] ?? "").trim();
const inventory = {};

async function openai(key) {
  const base = "https://api.openai.com/v1";
  const listing = await listIds(`${base}/models`, bearer(key));
  inventory.openai = { list_status: listing.status, model_count: listing.ids.length };
  const reasoning = { max_completion_tokens: 64, reasoning_effort: "none" };
  await openAICompatible("openai", base, key, {
    chat: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-5.6-luna"],
    tool: ["gpt-4o-mini", "gpt-4.1"],
    vision: ["gpt-4o-mini", "gpt-4o"],
    extra: { "gpt-5.6-luna": reasoning },
  });
  await probe("openai", "embeddings", "text-embedding-3-small", async () => ({
    ...(await post(`${base}/embeddings`, bearer(key), { model: "text-embedding-3-small", input: ["hello"] })),
    check: (j) => j?.data?.[0]?.embedding?.length === 1536,
  }));
  await probe("openai", "moderation", "omni-moderation-latest", async () => ({
    ...(await post(`${base}/moderations`, bearer(key), { model: "omni-moderation-latest", input: "hello" })),
    check: (j) => typeof j?.results?.[0]?.flagged === "boolean",
  }));
  const tts = await probe("openai", "tts", "gpt-4o-mini-tts", async () => ({
    ...(await post(`${base}/audio/speech`, bearer(key), { model: "gpt-4o-mini-tts", voice: "alloy", input: "Hello, forty two.", response_format: "mp3" })),
    check: (b) => Buffer.isBuffer(b) && b.length > 1000,
  }));
  if (tts.ok) spokenAudio = tts.body;
  for (const model of ["gpt-4o-mini-transcribe", "whisper-1"]) {
    if (!spokenAudio) break;
    await probe("openai", "stt", model, async () => ({
      ...(await call(`${base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: multipart({ model }, { bytes: spokenAudio, type: "audio/mpeg", name: "probe.mp3" }) })),
      check: (j) => /hello/i.test(j?.text ?? ""),
    }));
  }
  if (MEDIA) {
    await probe("openai", "image_generation", "gpt-image-1", async () => ({
      ...(await post(`${base}/images/generations`, bearer(key), { model: "gpt-image-1", prompt: "A plain blue circle on white.", size: "1024x1024", quality: "low", n: 1 })),
      check: (j) => typeof j?.data?.[0]?.b64_json === "string",
    }));
  }
}

async function anthropic(key) {
  const headers = { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
  const listing = await listIds("https://api.anthropic.com/v1/models", headers);
  inventory.anthropic = { list_status: listing.status, model_count: listing.ids.length, sample: listing.ids.slice(0, 8) };
  for (const model of ["claude-haiku-4-5-20251001"]) {
    await probe("anthropic", "text", model, async () => ({
      ...(await post("https://api.anthropic.com/v1/messages", headers, { model, max_tokens: 16, messages: ASK_OK })),
      check: (j) => /\bok\b/i.test(j?.content?.[0]?.text ?? ""),
    }));
  }
}

async function gemini(key) {
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const headers = { "x-goog-api-key": key, "Content-Type": "application/json" };
  const listing = await listIds(`${base}/models?pageSize=200`, headers, (j) => (j?.models ?? []).map((m) => m.name.replace(/^models\//, "")));
  inventory.gemini = { list_status: listing.status, model_count: listing.ids.length };
  for (const model of ["gemini-flash-latest", "gemini-flash-lite-latest"]) {
    await probe("gemini", "text", model, async () => ({
      ...(await post(`${base}/models/${model}:generateContent`, headers, { contents: [{ role: "user", parts: [{ text: "Reply with exactly the word OK." }] }], generationConfig: { maxOutputTokens: 512 } })),
      check: (j) => /\bok\b/i.test(geminiText(j)),
    }));
    await probe("gemini", "vision", model, async () => ({
      ...(await post(`${base}/models/${model}:generateContent`, headers, { contents: [{ role: "user", parts: [
        { text: "What number is written in this image? Reply with the digits only." },
        { inline_data: { mime_type: "image/png", data: IMAGE_URL.split(",")[1] } },
      ] }], generationConfig: { maxOutputTokens: 512 } })),
      check: (j) => /42/.test(geminiText(j)),
    }));
    // Structured output the way geminiProvider.ts asks for it: JSON mode with a schema.
    await probe("gemini", "structured_output", model, async () => ({
      ...(await post(`${base}/models/${model}:generateContent`, headers, { contents: [{ role: "user", parts: [{ text: "Return the word OK in the field word." }] }], generationConfig: {
        maxOutputTokens: 512, responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { word: { type: "STRING" } }, required: ["word"] },
      } })),
      check: (j) => /ok/i.test(JSON.parse(geminiText(j)).word ?? ""),
    }));
  }
}
// A thinking model spends its budget before it writes; 16 tokens read as empty.
const geminiText = (j) => j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

async function groq(key) {
  const base = "https://api.groq.com/openai/v1";
  const listing = await listIds(`${base}/models`, bearer(key));
  const ids = listing.ids;
  inventory.groq = { list_status: listing.status, model_count: ids.length, ids, speech: ids.filter((i) => /whisper|tts|orpheus|playai/i.test(i)), vision: ids.filter((i) => /llama-4|vision|scout|maverick/i.test(i)) };
  const vision = ids.filter((i) => /llama-4-scout/i.test(i)).slice(0, 1);
  await openAICompatible("groq", base, key, {
    chat: ["openai/gpt-oss-20b", "openai/gpt-oss-120b"],
    tool: ["openai/gpt-oss-20b"],
    vision,
    extra: { "openai/gpt-oss-20b": { max_tokens: 256 }, "openai/gpt-oss-120b": { max_tokens: 256 } },
  });
  for (const model of ["whisper-large-v3-turbo"]) {
    if (!spokenAudio) break;
    await probe("groq", "stt", model, async () => ({
      ...(await call(`${base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: multipart({ model }, { bytes: spokenAudio, type: "audio/mpeg", name: "probe.mp3" }) })),
      check: (j) => /hello/i.test(j?.text ?? ""),
    }));
  }
}

async function mistral(key) {
  const base = "https://api.mistral.ai/v1";
  const listing = await listIds(`${base}/models`, bearer(key));
  inventory.mistral = { list_status: listing.status, model_count: listing.ids.length, ocr: listing.ids.filter((i) => /ocr/i.test(i)), voxtral: listing.ids.filter((i) => /voxtral/i.test(i)) };
  await openAICompatible("mistral", base, key, {
    chat: ["mistral-small-latest", "mistral-small-2506", "mistral-medium-latest", "mistral-large-latest", "ministral-8b-latest", "ministral-14b-latest", "open-mistral-nemo"],
    tool: ["mistral-small-latest", "ministral-8b-latest", "ministral-14b-latest", "open-mistral-nemo"],
    vision: ["mistral-small-latest", "pixtral-12b-latest", "ministral-14b-latest"],
  });
  await probe("mistral", "embeddings", "mistral-embed", async () => ({
    ...(await post(`${base}/embeddings`, bearer(key), { model: "mistral-embed", input: ["hello"] })),
    check: (j) => (j?.data?.[0]?.embedding?.length ?? 0) > 0,
  }));
  for (const ocr of ["mistral-ocr-latest", "mistral-ocr-2512"]) await probe("mistral", "ocr", ocr, async () => ({
    ...(await post(`${base}/ocr`, bearer(key), { model: ocr, document: { type: "image_url", image_url: IMAGE_URL } })),
    check: (j) => /42/.test((j?.pages ?? []).map((p) => p.markdown).join(" ")),
  }));
  if (spokenAudio) {
    await probe("mistral", "stt", "voxtral-mini-latest", async () => ({
      ...(await call(`${base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: multipart({ model: "voxtral-mini-latest" }, { bytes: spokenAudio, type: "audio/mpeg", name: "probe.mp3" }) })),
      check: (j) => /hello/i.test(j?.text ?? ""),
    }));
  }
}

async function nvidiaNim(key) {
  const base = "https://integrate.api.nvidia.com/v1";
  const listing = await listIds(`${base}/models`, bearer(key));
  const ids = listing.ids;
  const instruct = ids.filter((i) => /instruct|chat/i.test(i) && !/vision|embed|guard|reward|safety/i.test(i));
  inventory.nvidia_nim = {
    list_status: listing.status,
    model_count: ids.length,
    instruct_sample: instruct.slice(0, 40),
    vision: ids.filter((i) => /vision|-vl/i.test(i)).slice(0, 10),
    embedding: ids.filter((i) => /embed/i.test(i)).slice(0, 10),
  };
  // The listing is not reliable here: listed ids answered 404 on 2026-09-26.
  // Probe current catalogue ids directly and let generation decide.
  const chat = ["meta/llama-3.3-70b-instruct", "meta/llama-3.1-8b-instruct", "nvidia/llama-3.3-nemotron-super-49b-v1.5", "openai/gpt-oss-20b", "qwen/qwen3-next-80b-a3b-instruct", "mistralai/mistral-nemotron"];
  const vision = ["meta/llama-3.2-11b-vision-instruct", "meta/llama-4-maverick-17b-128e-instruct"];
  await openAICompatible("nvidia_nim", base, key, { chat, tool: chat.slice(0, 1), vision, extra: Object.fromEntries(chat.map((m) => [m, { max_tokens: 256 }])) });
  for (const embed of ["nvidia/nv-embedqa-e5-v5", "nvidia/llama-3.2-nv-embedqa-1b-v2", "snowflake/arctic-embed-l"]) {
    await probe("nvidia_nim", "embeddings", embed, async () => ({
      ...(await post(`${base}/embeddings`, bearer(key), { model: embed, input: ["hello"], input_type: "query" })),
      check: (j) => (j?.data?.[0]?.embedding?.length ?? 0) > 0,
    }));
  }
}

async function openrouter(key) {
  const base = "https://openrouter.ai/api/v1";
  const k = await call(`${base}/key`, { headers: bearer(key) });
  // Whether the key is a free-tier key and has a hard limit — never its spend.
  inventory.openrouter = { key_status: k.status, is_free_tier: k.body?.data?.is_free_tier, has_limit: k.body?.data?.limit != null };
  const listing = await listIds(`${base}/models`, bearer(key));
  const free = listing.ids.filter((i) => i.endsWith(":free"));
  Object.assign(inventory.openrouter, { model_count: listing.ids.length, free });
  // A free-tier key is refused on paid models, so one paid model records that.
  const chat = [...free.filter((m) => /llama|qwen|mistral|gemma|deepseek|gpt-oss/i.test(m)).slice(0, 2), "openai/gpt-4o-mini"];
  await openAICompatible("openrouter", base, key, { chat, tool: chat.slice(0, 1), extra: Object.fromEntries(chat.map((m) => [m, { max_tokens: 256 }])) });
}

async function bytez(key) {
  // Bytez takes a bare `Authorization: <key>`; OpenAI-compatible chat lives
  // under https://api.bytez.com/models/v2/openai/v1.
  const auth = (k) => ({ Authorization: k, "Content-Type": "application/json" });
  const listing = await call("https://api.bytez.com/models/v2/list/models?task=chat", { headers: auth(key) });
  const rows = Array.isArray(listing.body?.output) ? listing.body.output : [];
  // Key names of the body only: 200 with no rows needs explaining, not guessing.
  inventory.bytez = { list_status: listing.status, body_keys: Object.keys(listing.body ?? {}).slice(0, 10), output_type: Array.isArray(listing.body?.output) ? "array" : typeof listing.body?.output, model_count: rows.length, sample: rows.slice(0, 15).map((r) => r.modelId) };
  const chat = ["Qwen/Qwen3-1.7B", "microsoft/Phi-3-mini-4k-instruct", "openai/gpt-4o-mini"];
  await openAICompatible("bytez", "https://api.bytez.com/models/v2/openai/v1", key, {
    chat, auth, extra: Object.fromEntries(chat.map((m) => [m, { max_completion_tokens: 256 }])),
  });
  // The native run endpoint, in case only that one serves this key.
  await probe("bytez", "text_native", chat[0], async () => ({
    ...(await post(`https://api.bytez.com/models/v2/${chat[0]}`, auth(key), { messages: ASK_OK, params: { max_new_tokens: 256 } })),
    check: (j) => /\bok\b/i.test(JSON.stringify(j?.output ?? "")),
  }));
}

const PROVIDERS = [
  ["openai", "OPENAI_API_KEY", openai],
  ["anthropic", "ANTHROPIC_API_KEY", anthropic],
  ["gemini", "GEMINI_API_KEY", gemini],
  ["groq", "GROQ_API_KEY", groq],
  ["mistral", "MISTRAL_API_KEY", mistral],
  ["nvidia_nim", "NVIDIA_NIM_API_KEY", nvidiaNim],
  ["openrouter", "OPENROUTER_API_KEY", openrouter],
  ["bytez", "BYTEZ_API_KEY", bytez],
  ["runpod", "RUNPOD_API_KEY", null],
  ["luma", "LUMA_API_KEY", null],
  ["elevenlabs", "ELEVENLABS_API_KEY", null],
];

const keys = {};
for (const [name, envName, run] of PROVIDERS) {
  const key = env(envName);
  keys[name] = key ? "present" : "absent";
  if (!key || !run) continue;
  try { await run(key); } catch (e) { results.push({ provider: name, capability: "probe", model: "-", ok: false, status: 0, ms: 0, note: `script_error:${e?.name ?? "Error"}` }); }
}

// ── Report ───────────────────────────────────────────────────────────────────

const lines = ["## Provider smoke test", "", "| provider | key in runner |", "| --- | --- |", ...Object.entries(keys).map(([p, k]) => `| ${p} | ${k} |`), "",
  "| provider | capability | model | result | HTTP | ms | note |", "| --- | --- | --- | --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.provider} | ${r.capability} | \`${r.model}\` | ${r.ok ? "PASS" : "FAIL"} | ${r.status} | ${r.ms} | ${r.note ?? ""}${r.rate ? ` ${Object.entries(r.rate).map(([h, v]) => `${h.replace("x-ratelimit-", "")}=${v}`).join(" ")}` : ""} |`),
  "", "### Inventory", "", "```json", JSON.stringify(inventory, null, 2), "```"];
console.log(lines.join("\n"));
if (OUT) writeFileSync(OUT, JSON.stringify({ keys, results, inventory }, null, 2));
