#!/usr/bin/env node
//
// Every model our OPENAI_API_KEY can list, and what each one actually does.
//
//   node scripts/ai-eval/openai-inventory.mjs --out inventory.json [--media]
//
// GET /v1/models says which ids the key can see; it does not say which of them
// generate (list-models.mjs). So each listed id is sent one tiny request on the
// endpoint its family is served from — Responses and Chat Completions for text,
// /embeddings, /moderations, /audio/speech, /audio/transcriptions,
// /realtime/client_secrets — and the HTTP status, the usage counts and, for a
// failure, OpenAI's short error code are recorded. `--media` adds one
// low-quality image per current image model (a few US cents in all).
//
// Not probed, on purpose: models OpenAI has shut down or will shut down within
// the week, legacy completions models, video (Sora was retired 2026-09-24) and
// models that refuse to run without hosted tools (computer use, deep research).
// They are listed with the reason.
//
// Public-log rule: stdout carries counts only. The per-model report goes to
// --out, which the workflow encrypts before it leaves the runner. Nothing here
// prints a key, a response body or a model's answer.

import { writeFileSync } from "node:fs";
import { textPng } from "./fixtures.mjs";
import { providerErrorSummary } from "./providers.mjs";

const args = process.argv.slice(2);
const MEDIA = args.includes("--media");
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
const KEY = (process.env.OPENAI_API_KEY ?? "").trim();
const BASE = "https://api.openai.com/v1";
const CONCURRENCY = 6;

// OpenAI's deprecations page, read 2026-09-28
// (https://developers.openai.com/api/docs/deprecations). A base id covers its
// dated snapshots and its -preview variants, and an alias whose only snapshot
// is going goes with it (gpt-5 → gpt-5-2025-08-07).
export const DEPRECATIONS = {
  "gpt-5.4-cyber": ["2026-10-01", "gpt-5.6-cyber"],
  "whisper-1": ["2027-02-26", "gpt-transcribe"],
  "gpt-4o-transcribe": ["2027-02-26", "gpt-transcribe"],
  "gpt-4o-mini-transcribe": ["2027-02-26", "gpt-transcribe"],
  "gpt-4o-transcribe-diarize": ["2027-02-26", "gpt-transcribe"],
  "gpt-realtime": ["2027-01-20", "gpt-realtime-2.1"],
  "gpt-audio": ["2027-01-20", "gpt-audio-1.5"],
  "gpt-4o-audio": ["2027-01-20", "gpt-audio-1.5"],
  "gpt-4o-realtime": ["2027-01-20", "gpt-realtime-2.1"],
  "gpt-realtime-mini": ["2027-01-20", "gpt-realtime-2.1-mini"],
  "gpt-audio-mini": ["2027-01-20", "gpt-audio-1.5"],
  "gpt-4o-mini-realtime": ["2027-01-20", "gpt-realtime-2.1-mini"],
  "gpt-4o-mini-audio": ["2027-01-20", "gpt-audio-1.5"],
  "gpt-5": ["2026-12-11", "gpt-5.6-sol"],
  "gpt-5-mini": ["2026-12-11", "gpt-5.6-terra"],
  "gpt-5-nano": ["2026-12-11", "gpt-5.6-luna"],
  "gpt-5-pro": ["2026-12-11", "gpt-5.6-sol"],
  "o3": ["2026-12-11", "gpt-5.6-sol"],
  "o3-pro": ["2026-12-11", "gpt-5.6-sol"],
  "sora-2": ["2026-09-24", null],
  "sora-2-pro": ["2026-09-24", null],
  "gpt-image-1-mini": ["2026-12-01", "gpt-image-2"],
  "gpt-image-1.5": ["2026-12-01", "gpt-image-2"],
  "chatgpt-image-latest": ["2026-12-01", "gpt-image-2"],
  "dall-e-2": ["2026-05-12", "gpt-image-2"],
  "dall-e-3": ["2026-05-12", "gpt-image-2"],
  "gpt-3.5-turbo-instruct": ["2026-09-28", "gpt-5.6-terra"],
  "babbage-002": ["2026-09-28", "gpt-5.6-terra"],
  "davinci-002": ["2026-09-28", "gpt-5.6-terra"],
  "gpt-3.5-turbo-1106": ["2026-09-28", "gpt-5.6-terra"],
  "chatgpt-4o-latest": ["2026-02-17", "gpt-5.1-chat-latest"],
  "codex-mini-latest": ["2026-02-12", "gpt-5-codex-mini"],
  "o1-preview": ["2025-07-28", "o3"],
  "o1-mini": ["2025-10-27", "o4-mini"],
  "gpt-4.5-preview": ["2025-07-14", "gpt-4.1"],
};

const SNAPSHOT = /-(\d{4}-\d{2}-\d{2}|\d{4})$/;

export function deprecationOf(id) {
  for (const [base, [shutdown, replacement]] of Object.entries(DEPRECATIONS)) {
    // The rest of the id must be the date and nothing else: o3-mini-2025-01-31
    // is not a snapshot of o3.
    const snapshot = id.startsWith(base) && /^-(\d{4}-\d{2}-\d{2}|\d{4})$/.test(id.slice(base.length));
    const preview = id.startsWith(`${base}-preview`);
    if (id === base || snapshot || preview) return { shutdown, replacement };
  }
  return null;
}

/** Which endpoint family serves an id — by OpenAI's own naming, most specific first. */
export function familyOf(id) {
  const m = id.toLowerCase();
  if (/^(dall-e|gpt-image|chatgpt-image)/.test(m)) return "image";
  if (/^sora/.test(m)) return "video";
  if (/tts/.test(m)) return "tts";
  if (/realtime|^gpt-live/.test(m)) return "realtime";
  if (/transcribe|^whisper/.test(m)) return "stt";
  if (/audio/.test(m)) return "audio";
  if (/embedding/.test(m)) return "embedding";
  if (/moderation/.test(m)) return "moderation";
  if (/^(davinci|babbage)|instruct/.test(m)) return "legacy_completion";
  if (/computer-use/.test(m)) return "computer_use";
  if (/deep-research/.test(m)) return "deep_research";
  if (/^(gpt-|o\d|chat-latest|chatgpt-)/.test(m)) return "text";
  return "other";
}

const isReasoning = (id) => /^(gpt-5|gpt-6|o\d)/.test(id) && !/chat-latest/.test(id);

// ── HTTP ─────────────────────────────────────────────────────────────────────

const auth = { Authorization: `Bearer ${KEY}` };

async function call(path, init, timeoutMs = 60_000) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    const type = res.headers.get("content-type") ?? "";
    const raw = type.includes("json") ? await res.text() : Buffer.from(await res.arrayBuffer());
    const json = typeof raw === "string" ? safeJson(raw) : null;
    return {
      status: res.status,
      ms: Date.now() - started,
      json,
      bytes: Buffer.isBuffer(raw) ? raw : null,
      error: res.ok ? undefined : providerErrorSummary(typeof raw === "string" ? raw : ""),
    };
  } catch (e) {
    return { status: 0, ms: Date.now() - started, error: e?.name === "TimeoutError" ? "timeout" : "network" };
  }
}

const safeJson = (t) => { try { return JSON.parse(t); } catch { return null; } };
const post = (path, body, timeoutMs) =>
  call(path, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) }, timeoutMs);

function multipart(fields, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([file.bytes], { type: file.type }), file.name);
  return form;
}

/** The part of a result that may be written down: status, latency, code, usage numbers. */
function verdict(r, ok, extra = {}) {
  const u = r.json?.usage;
  const usage = u && typeof u === "object"
    ? Object.fromEntries(Object.entries(u).filter(([, v]) => typeof v === "number"))
    : undefined;
  return { ok: Boolean(ok), status: r.status, ms: r.ms, ...(r.error ? { error: r.error } : {}), ...(usage ? { usage } : {}), ...extra };
}

// ── Probes per family ────────────────────────────────────────────────────────

const OK = "Reply with exactly the word OK.";
// Only the number: "HELLO 42" asked for digits invites a letters-to-digits
// answer, and a loose /42/ check passed 411042 (see provider-smoke.mjs).
const IMAGE_URL = `data:image/png;base64,${textPng("42").toString("base64")}`;
const TOOL = { type: "function", function: { name: "answer", description: "Return the answer.", parameters: { type: "object", properties: { word: { type: "string" } }, required: ["word"] } } };

// The models this report must say something definite about: tools and vision
// are tested on these as well as plain text.
const DEEP = new Set(["gpt-6-astra", "gpt-6-sol", "gpt-6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna",
  "gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"]);

const outputText = (j) => (j?.output ?? []).flatMap((o) => o?.content ?? []).map((c) => c?.text ?? "").join("");

async function probeText(id) {
  const slow = /-pro\b|-pro-/.test(id) ? 180_000 : 90_000;
  const probes = {};
  const r = await post("/responses", { model: id, input: OK, max_output_tokens: 256 }, slow);
  probes.responses = verdict(r, r.status === 200, { text: Boolean(outputText(r.json)), incomplete: r.json?.status === "incomplete" || undefined });
  if (/-pro\b|-pro-|codex/.test(id)) return probes; // Responses-only families

  const budget = isReasoning(id) ? { max_completion_tokens: 256 } : { max_tokens: 64 };
  const c = await post("/chat/completions", { model: id, messages: [{ role: "user", content: OK }], ...budget }, slow);
  probes.chat = verdict(c, c.status === 200, { text: Boolean(c.json?.choices?.[0]?.message?.content) });

  // Our adapter sends max_completion_tokens + reasoning_effort to reasoning
  // models (aiProvider.ts OPENAI_REASONING_MODELS). Which effort does each take?
  if (isReasoning(id) && c.status === 200) {
    for (const effort of ["none", "minimal", "low"]) {
      const e = await post("/chat/completions", { model: id, messages: [{ role: "user", content: OK }], max_completion_tokens: 64, reasoning_effort: effort }, slow);
      if (e.status === 200) { probes.lowest_effort = { effort, text: Boolean(e.json?.choices?.[0]?.message?.content), ms: e.ms }; break; }
    }
    probes.lowest_effort ??= { effort: null };
  }

  if (DEEP.has(id) && c.status === 200) {
    const effort = probes.lowest_effort?.effort;
    const tune = isReasoning(id) ? { max_completion_tokens: 128, ...(effort ? { reasoning_effort: effort } : {}) } : { max_tokens: 64 };
    const t = await post("/chat/completions", { model: id, messages: [{ role: "user", content: "Call the answer tool with the word OK." }], tools: [TOOL], tool_choice: { type: "function", function: { name: "answer" } }, ...tune });
    probes.tools = verdict(t, t.status === 200 && t.json?.choices?.[0]?.message?.tool_calls?.length > 0);
    const v = await post("/chat/completions", { model: id, messages: [{ role: "user", content: [
      { type: "text", text: "What number is written in this image? Reply with the digits only." },
      { type: "image_url", image_url: { url: IMAGE_URL } },
    ] }], ...tune });
    probes.vision = verdict(v, v.status === 200 && /^\s*42\s*\.?\s*$/.test(v.json?.choices?.[0]?.message?.content ?? ""));
  }
  return probes;
}

let spoken = null;

const PROBES = {
  text: probeText,
  async embedding(id) {
    const r = await post("/embeddings", { model: id, input: ["hello"] });
    return { embeddings: verdict(r, Array.isArray(r.json?.data?.[0]?.embedding), { dimensions: r.json?.data?.[0]?.embedding?.length }) };
  },
  async moderation(id) {
    const r = await post("/moderations", { model: id, input: "hello" });
    return { moderations: verdict(r, typeof r.json?.results?.[0]?.flagged === "boolean") };
  },
  async tts(id) {
    const r = await post("/audio/speech", { model: id, voice: "alloy", input: "Hello, forty two.", response_format: "mp3" });
    if (r.bytes?.length > 1000 && !spoken) spoken = r.bytes;
    return { speech: verdict(r, r.bytes?.length > 1000, { bytes: r.bytes?.length }) };
  },
  async stt(id) {
    if (!spoken) return { transcriptions: { ok: false, skipped: "no synthesised audio to transcribe" } };
    const r = await call("/audio/transcriptions", { method: "POST", headers: auth, body: multipart({ model: id }, { bytes: spoken, type: "audio/mpeg", name: "probe.mp3" }) });
    return { transcriptions: verdict(r, /hello/i.test(r.json?.text ?? "")) };
  },
  async realtime(id) {
    // Minting a client secret validates the model for a session and costs nothing.
    const type = /transcribe|whisper/.test(id) ? "transcription" : "realtime";
    const session = type === "realtime" ? { type, model: id } : { type, audio: { input: { transcription: { model: id } } } };
    const r = await post("/realtime/client_secrets", { session });
    return { realtime_session: verdict(r, r.status === 200 && typeof r.json?.value === "string") };
  },
  async audio(id) {
    const r = await post("/chat/completions", { model: id, modalities: ["text", "audio"], audio: { voice: "alloy", format: "mp3" }, messages: [{ role: "user", content: OK }], max_completion_tokens: 256 });
    return { chat_audio: verdict(r, Boolean(r.json?.choices?.[0]?.message?.audio?.data)) };
  },
  async image(id) {
    if (!MEDIA) return { images: { ok: false, skipped: "run with --media to generate" } };
    const r = await post("/images/generations", { model: id, prompt: "A plain blue circle on white.", size: "1024x1024", quality: "low", n: 1 }, 180_000);
    return { images: verdict(r, typeof r.json?.data?.[0]?.b64_json === "string") };
  },
};

const NOT_PROBED = {
  video: "Sora video models were shut down 2026-09-24",
  legacy_completion: "legacy /v1/completions model, shut down 2026-09-28",
  computer_use: "runs only with the hosted computer-use tool",
  deep_research: "runs only with hosted web-search tools, minutes per call",
  other: "unknown family",
};

// ── Main ─────────────────────────────────────────────────────────────────────

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

async function main() {
  if (!KEY) { console.log("OPENAI_API_KEY is not set"); process.exit(1); }
  const listing = await call("/models", { headers: auth });
  if (listing.status !== 200) { console.log(`listing failed: HTTP ${listing.status} ${listing.error ?? ""}`); process.exit(1); }
  const models = (listing.json?.data ?? [])
    .map((m) => ({ id: m.id, owned_by: m.owned_by ?? null, created: m.created ? new Date(m.created * 1000).toISOString().slice(0, 10) : null }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const today = new Date().toISOString().slice(0, 10);
  const rows = models.map((m) => {
    const dep = deprecationOf(m.id);
    return { ...m, family: familyOf(m.id), snapshot: SNAPSHOT.test(m.id), deprecation: dep, shut_down: Boolean(dep && dep.shutdown <= today) };
  });

  // TTS first, so transcription has audio to work on.
  const order = [...rows].sort((a, b) => (a.family === "tts" ? -1 : 0) - (b.family === "tts" ? -1 : 0));
  await pool(order, CONCURRENCY, async (row) => {
    if (row.shut_down) { row.not_probed = `shut down ${row.deprecation.shutdown}`; return; }
    const probe = PROBES[row.family];
    if (!probe) { row.not_probed = NOT_PROBED[row.family] ?? "no probe"; return; }
    row.probes = await probe(row.id);
  });
  // A transcription model that ran before the first TTS finished gets a second chance.
  for (const row of rows.filter((r) => r.family === "stt" && r.probes?.transcriptions?.skipped)) row.probes = await PROBES.stt(row.id);

  const report = { generated_at: new Date().toISOString(), listed: rows.length, models: rows };
  if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2));

  // Public: counts only.
  const probed = rows.filter((r) => r.probes);
  const anyOk = (r) => Object.values(r.probes).some((p) => p?.ok);
  const byFamily = {};
  for (const r of rows) byFamily[r.family] = (byFamily[r.family] ?? 0) + 1;
  console.log(`listed=${rows.length} probed=${probed.length} answered=${probed.filter(anyOk).length} not_probed=${rows.length - probed.length} deprecated=${rows.filter((r) => r.deprecation).length}`);
  console.log(`families: ${Object.entries(byFamily).map(([k, v]) => `${k}=${v}`).join(" ")}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("openai-inventory.mjs")) {
  await main();
}
