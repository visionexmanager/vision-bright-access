#!/usr/bin/env node
//
// Deep Bytez capability audit: can Bytez, on the key we already hold, run
// video generation, true image upscaling and voice cloning — and what else?
//
//   node scripts/ai-eval/bytez-capability-audit.mjs
//
// Real calls only. Every output that comes back is downloaded and validated by
// its bytes (container signature, dimensions, duration) — a 200 is not proof.
// The repository is public, so this prints statuses, model ids, sizes and
// sanitised provider sentences only: never a key, a body or a signed URL.
//
// Cost: Bytez's free plan is $1 of credit; open models bill per GPU-second.
// Closed models (Veo, OpenAI via Bytez) are asked only if the account can run
// anything at all, and video only once, at the shortest duration offered.
// OPENAI_API_KEY is used for one thing: a 4-second TTS clip as the reference
// voice for the cloning test (a fixture, never a person's voice).

import { inflateSync, deflateSync } from "node:zlib";

const KEY = (process.env.BYTEZ_API_KEY ?? "").trim();
const OPENAI = (process.env.OPENAI_API_KEY ?? "").trim();
const BASE = "https://api.bytez.com/models/v2";
const rows = [];
const facts = {};

// ── Output safety ───────────────────────────────────────────────────────────
function sanitize(text) {
  if (typeof text !== "string") return "";
  let s = text;
  for (const secret of [KEY, OPENAI].filter((v) => v.length >= 8)) s = s.split(secret).join("[key]");
  return s.replace(/https?:\/\/\S+/g, "[url]").replace(/[A-Za-z0-9_-]{32,}/g, "[id]").replace(/\s+/g, " ").slice(0, 170);
}
function row(area, probe, model, status, ok, note = "", ms = 0) {
  rows.push({ area, probe, model, status, ok, note: sanitize(String(note)), ms });
  console.log(`${ok ? "PASS" : "FAIL"} ${area} ${probe} ${model} ${status} ${ms}ms ${sanitize(String(note))}`);
}

async function call(path, { method = "GET", headers = {}, body, timeoutMs = 120_000 } = {}) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path.startsWith("http") ? path : `${BASE}${path}`, {
      method, signal: controller.signal,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, json, text, ms: Date.now() - started };
  } catch (e) {
    return { status: 0, json: null, text: e?.name === "AbortError" ? "timeout" : `network:${e?.name}`, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
const auth = (form = "bare") => ({ Authorization: form === "Key" ? `Key ${KEY}` : KEY });
const why = (r) => r.json?.error ?? (r.status >= 400 ? r.text : "");

// ── Byte-level validation of what comes back ───────────────────────────────
async function fetchOutput(output) {
  // Bytez returns a URL, a data URL, base64, or an object holding one of them.
  const pick = (o) => typeof o === "string" ? o
    : Array.isArray(o) ? pick(o[0])
    : o && typeof o === "object" ? pick(o.url ?? o.video ?? o.image ?? o.audio ?? o.output ?? o.data ?? o.b64_json ?? Object.values(o)[0])
    : null;
  const v = pick(output);
  if (!v) return null;
  if (/^https?:\/\//.test(v)) {
    const res = await fetch(v).catch(() => null);
    if (!res?.ok) return { bytes: null, source: `url(${res?.status ?? "net"})` };
    return { bytes: new Uint8Array(await res.arrayBuffer()), source: "url" };
  }
  const b64 = v.startsWith("data:") ? v.slice(v.indexOf(",") + 1) : v;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64.slice(0, 200))) return { bytes: null, source: "text" };
  return { bytes: Uint8Array.from(Buffer.from(b64, "base64")), source: "base64" };
}
const ascii = (b, from, to) => String.fromCharCode(...b.slice(from, to));
function kindOf(b) {
  if (!b || b.length < 12) return "none";
  if (ascii(b, 4, 8) === "ftyp") return "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  if (ascii(b, 0, 4) === "GIF8") return "gif";
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE") return "wav";
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "mp3";
  if (ascii(b, 0, 4) === "OggS") return "ogg";
  if (ascii(b, 0, 4) === "fLaC") return "flac";
  return "unknown";
}
// MP4: duration from mvhd; width/height from the first tkhd with a size.
function mp4Info(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let duration = null, width = null, height = null, audio = false;
  const walk = (start, end) => {
    for (let at = start; at + 8 <= end;) {
      let size = dv.getUint32(at); const type = ascii(b, at + 4, at + 8);
      if (size === 1) size = Number(dv.getBigUint64(at + 8)); if (size < 8) break;
      if (["moov", "trak", "mdia", "minf", "stbl"].includes(type)) walk(at + 8, at + size);
      if (type === "mvhd") {
        const v = b[at + 8];
        const scale = dv.getUint32(at + (v === 1 ? 28 : 20));
        const dur = v === 1 ? Number(dv.getBigUint64(at + 32)) : dv.getUint32(at + 24);
        duration = scale ? Math.round((dur / scale) * 100) / 100 : null;
      }
      if (type === "tkhd") {
        const v = b[at + 8]; const off = at + (v === 1 ? 96 : 84);
        const w = dv.getUint32(off) >>> 16, h = dv.getUint32(off + 4) >>> 16;
        if (w && h && !width) { width = w; height = h; }
      }
      if (type === "hdlr" && ascii(b, at + 16, at + 20) === "soun") audio = true;
      at += size;
    }
  };
  try { walk(0, b.length); } catch { /* truncated */ }
  return { duration, width, height, audio };
}
function pngDims(b) { const dv = new DataView(b.buffer, b.byteOffset); return { w: dv.getUint32(16), h: dv.getUint32(20), colour: b[25] }; }
function jpegDims(b) {
  for (let i = 2; i + 9 < b.length; i++) if (b[i] === 0xff && (b[i + 1] === 0xc0 || b[i + 1] === 0xc2)) return { w: (b[i + 7] << 8) | b[i + 8], h: (b[i + 5] << 8) | b[i + 6] };
  return { w: 0, h: 0 };
}
function wavSeconds(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let rate = 0, bytesPerSec = 0;
  for (let at = 12; at + 8 <= b.length;) {
    const id = ascii(b, at, at + 4), size = dv.getUint32(at + 4, true);
    if (id === "fmt ") { rate = dv.getUint32(at + 12, true); bytesPerSec = dv.getUint32(at + 16, true); }
    if (id === "data") return bytesPerSec ? Math.round((size / bytesPerSec) * 100) / 100 : null;
    at += 8 + size + (size % 2);
  }
  return rate ? null : null;
}

// ── A PNG we can compare against: 64×48 RGB with shapes and a gradient ─────
function makePng(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) { const [r, g, bl] = pixel(x, y); const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = bl; }
  }
  const crc = (buf) => { let c = ~0; for (const x of buf) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
const SRC_W = 64, SRC_H = 48;
const srcPixel = (x, y) => {
  const inCircle = (x - 20) ** 2 + (y - 24) ** 2 < 144;
  const inSquare = x > 38 && x < 58 && y > 10 && y < 30;
  return inCircle ? [220, 40, 40] : inSquare ? [30, 90, 220] : [Math.round(x * 3.5), Math.round(y * 4.5), 120];
};
const SOURCE_PNG = makePng(SRC_W, SRC_H, srcPixel);
// Decode an 8-bit RGB/RGBA/grey PNG to RGB, for the "is it the same picture" test.
function decodePng(b) {
  const { w, h, colour } = pngDims(b);
  const dv = new DataView(b.buffer, b.byteOffset);
  const parts = [];
  for (let at = 8; at + 8 <= b.length;) { const len = dv.getUint32(at); if (ascii(b, at + 4, at + 8) === "IDAT") parts.push(b.slice(at + 8, at + 8 + len)); at += 12 + len; }
  const data = inflateSync(Buffer.concat(parts.map((p) => Buffer.from(p))));
  const ch = colour === 6 ? 4 : colour === 2 ? 3 : colour === 0 ? 1 : colour === 4 ? 2 : 0;
  if (!ch || b[24] !== 8) return null;
  const stride = w * ch, out = new Uint8Array(w * h * 3), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = data[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = data[y * (stride + 1) + 1 + i], a = i >= ch ? cur[i - ch] : 0, up = prev[i], c = i >= ch ? prev[i - ch] : 0;
      const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
      cur[i] = (x + (f === 1 ? a : f === 2 ? up : f === 3 ? (a + up) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? up : c) : 0)) & 255;
    }
    for (let xx = 0; xx < w; xx++) for (let k = 0; k < 3; k++) out[(y * w + xx) * 3 + k] = cur[xx * ch + (ch >= 3 ? k : 0)];
    prev.set(cur);
  }
  return { w, h, rgb: out };
}
/** Mean absolute difference (0–255) between the source and the output shrunk back to the source size. */
function sameImageScore(outPng) {
  const d = decodePng(outPng);
  if (!d) return null;
  let total = 0, n = 0;
  for (let y = 0; y < SRC_H; y++) for (let x = 0; x < SRC_W; x++) {
    const sx = Math.min(d.w - 1, Math.floor(((x + 0.5) * d.w) / SRC_W)), sy = Math.min(d.h - 1, Math.floor(((y + 0.5) * d.h) / SRC_H));
    const src = srcPixel(x, y);
    for (let k = 0; k < 3; k++) { total += Math.abs(d.rgb[(sy * d.w + sx) * 3 + k] - src[k]); n++; }
  }
  return Math.round((total / n) * 10) / 10;
}

// ── Phase 1–2: key, account, catalog ────────────────────────────────────────
async function account() {
  const none = await call("/list/tasks");
  const tasks = await call("/list/tasks", { headers: auth() });
  facts.key = !KEY ? "MISSING" : none.status === 401 && tasks.status !== 401 ? "PRESENT (authenticates: 401 without it, accepted with it)" : tasks.status === 401 ? "INVALID (401 with it)" : `UNCLEAR (${tasks.status})`;
  const taskList = Array.isArray(tasks.json?.output) ? tasks.json.output : [];
  facts.tasks = taskList.length;
  row("account", "list/tasks", "-", tasks.status, tasks.status === 200 && taskList.length > 0, `tasks=${taskList.length} ${why(tasks)}`, tasks.ms);
  for (const form of ["bare", "Key"]) {
    const all = await call("/list/models", { headers: auth(form) });
    const n = Array.isArray(all.json?.output) ? all.json.output.length : 0;
    row("account", `list/models (${form} auth)`, "-", all.status, all.status === 200 && n > 0, `models=${n} ${why(all)}`, all.ms);
    if (n) facts.catalogSize = n;
  }
  const wanted = ["text-to-video", "image-to-video", "text-to-speech", "text-to-audio", "audio-to-audio", "image-to-image", "super-resolution",
    "automatic-speech-recognition", "image-text-to-text", "video-text-to-text", "text-to-image", "chat", "feature-extraction", "document-question-answering", "image-to-text"];
  facts.byTask = {};
  for (const task of wanted.filter((t) => !taskList.length || taskList.includes(t) || ["super-resolution"].includes(t))) {
    const r = await call(`/list/models?task=${task}`, { headers: auth() });
    const list = Array.isArray(r.json?.output) ? r.json.output : [];
    facts.byTask[task] = { status: r.status, count: list.length, sample: list.slice(0, 6).map((m) => `${m.modelId}${m.params ? ` ${m.params}B` : ""}${m.meter ? ` ${m.meter}` : ""}`) };
    row("catalog", `list?task=${task}`, "-", r.status, r.status === 200 && list.length > 0, `models=${list.length} ${why(r)}`, r.ms);
  }
  if (taskList.length) facts.taskNames = taskList.slice(0, 80);
}

// ── Model runs ──────────────────────────────────────────────────────────────
async function run(area, model, body, validate, timeoutMs = 300_000) {
  const r = await call(`/${model}`, { method: "POST", headers: auth(), body, timeoutMs });
  if (r.status !== 200 || r.json?.error) {
    row(area, "run", model, r.status, false, why(r) || "no output", r.ms);
    return null;
  }
  const verdict = await validate(r.json?.output, r);
  row(area, "run", model, r.status, verdict.ok, verdict.note, r.ms);
  return verdict;
}

async function sanity() {
  // The doc's own example models: if these fail the catalog is not reachable at all.
  await run("sanity", "Qwen/Qwen3-4B", { messages: [{ role: "user", content: "Reply with the word OK." }], params: { max_new_tokens: 8 } },
    async (o) => ({ ok: /ok/i.test(JSON.stringify(o ?? "")), note: `output_type=${Array.isArray(o) ? "array" : typeof o}` }));
  await run("sanity", "openai-community/gpt2", { text: "Hello", params: { max_new_tokens: 5 } },
    async (o) => ({ ok: !!o, note: `output_type=${typeof o}` }));
  await run("sanity", "openai/gpt-4o-mini", { messages: [{ role: "user", content: "Reply with the word OK." }], params: { max_tokens: 5 } },
    async (o) => ({ ok: /ok/i.test(JSON.stringify(o ?? "")), note: "closed model via Bytez credits" }));
}

async function video() {
  const listed = (facts.byTask["text-to-video"]?.sample ?? []).map((s) => s.split(" ")[0]);
  const candidates = [...new Set([
    // Closed: Google Veo, as Bytez names closed models "provider/model".
    "google/veo-3.0-fast-generate-001", "google/veo-3.0-generate-001", "google/veo-2.0-generate-001",
    // Open: the doc's example, then what the catalog lists.
    "ali-vilab/text-to-video-ms-1.7b", ...listed,
  ])].slice(0, 7);
  const prompt = "A red ball rolling slowly across a wooden table, soft daylight.";
  for (const model of candidates) {
    const closed = model.startsWith("google/");
    const v = await run("video", model, closed ? { text: prompt, params: { durationSeconds: 4 } } : { text: prompt }, async (o) => {
      const got = await fetchOutput(o);
      const kind = kindOf(got?.bytes);
      const info = kind === "mp4" ? mp4Info(got.bytes) : {};
      const ok = ["mp4", "webm", "gif"].includes(kind) && (got?.bytes?.length ?? 0) > 5000;
      return { ok, note: `source=${got?.source ?? "none"} container=${kind} bytes=${got?.bytes?.length ?? 0}${info.duration ? ` duration=${info.duration}s` : ""}${info.width ? ` ${info.width}x${info.height}` : ""}${kind === "mp4" ? ` audio=${info.audio}` : ""}` };
    }, 600_000);
    if (v?.ok) break; // one working video model is the answer; do not spend on more
  }
}

async function upscale() {
  const listed = [...(facts.byTask["image-to-image"]?.sample ?? []), ...(facts.byTask["super-resolution"]?.sample ?? [])].map((s) => s.split(" ")[0]);
  const candidates = [...new Set([
    ...listed.filter((m) => /sr|super|resol|upscal|esrgan|swin2|edsr|hat|real/i.test(m)),
    "caidas/swin2SR-classical-sr-x2-64", "caidas/swin2SR-classical-sr-x4-64", "caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr",
    "eugenesiow/edsr-base", "ai-forever/Real-ESRGAN",
  ])].slice(0, 6);
  const base64 = Buffer.from(SOURCE_PNG).toString("base64");
  for (const model of candidates) {
    const v = await run("upscale", model, { base64: `data:image/png;base64,${base64}` }, async (o) => {
      const got = await fetchOutput(o);
      const kind = kindOf(got?.bytes);
      const dims = kind === "png" ? pngDims(got.bytes) : kind === "jpeg" ? jpegDims(got.bytes) : { w: 0, h: 0 };
      const scale = dims.w ? Math.round((dims.w / SRC_W) * 100) / 100 : 0;
      const aspect = dims.w && dims.h ? Math.abs(dims.w / dims.h - SRC_W / SRC_H) < 0.02 : false;
      const score = kind === "png" ? sameImageScore(got.bytes) : null;
      // An enlargement of the same picture: ≥2× wider, same aspect, and shrunk back it matches the source closely.
      const same = score === null ? null : score < 20;
      return { ok: scale >= 2 && aspect && same !== false, note: `container=${kind} in=${SRC_W}x${SRC_H} out=${dims.w}x${dims.h} scale=${scale} aspect_kept=${aspect}${score !== null ? ` mean_abs_diff_vs_source=${score}/255 same_picture=${same}` : ""}` };
    });
    if (v?.ok) break;
  }
}

async function speech() {
  // A 4-second reference voice from OpenAI TTS (a fixture, not a person).
  let reference = null;
  if (OPENAI) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice: "onyx", input: "This is a short reference recording for a voice test.", response_format: "wav" }),
    }).catch(() => null);
    if (res?.ok) reference = new Uint8Array(await res.arrayBuffer());
  }
  facts.referenceAudio = reference ? `wav ${reference.length} bytes, ${wavSeconds(reference)}s` : "none";
  const refB64 = reference ? `data:audio/wav;base64,${Buffer.from(reference).toString("base64")}` : null;
  const audioCheck = async (o) => {
    const got = await fetchOutput(o);
    const kind = kindOf(got?.bytes);
    const secs = kind === "wav" ? wavSeconds(got.bytes) : null;
    return { ok: ["wav", "mp3", "ogg", "flac"].includes(kind) && (got?.bytes?.length ?? 0) > 2000, note: `source=${got?.source ?? "none"} container=${kind} bytes=${got?.bytes?.length ?? 0}${secs ? ` duration=${secs}s` : ""}` };
  };
  // Plain TTS (not cloning), to know whether audio output works at all.
  const tts = [...new Set([...(facts.byTask["text-to-speech"]?.sample ?? []).map((s) => s.split(" ")[0]), "suno/bark-small", "facebook/mms-tts-eng", "microsoft/speecht5_tts"])].slice(0, 4);
  for (const model of tts) { const v = await run("tts", model, { text: "Hello from Visionex." }, audioCheck); if (v?.ok) break; }
  // Cloning: a reference clip in, speech in that voice out.
  const cloners = ["coqui/XTTS-v2", "SWivid/F5-TTS", "fishaudio/fish-speech-1.5", "myshell-ai/OpenVoiceV2", "ResembleAI/chatterbox"];
  for (const model of cloners) {
    if (!refB64) { row("clone", "run", model, 0, false, "no reference audio fixture"); break; }
    const v = await run("clone", model, { text: "Hello from Visionex, in the reference voice.", params: { speaker_wav: refB64, reference_audio: refB64 } }, audioCheck);
    if (v?.ok) break;
  }
}

async function extras() {
  const png = `data:image/png;base64,${Buffer.from(SOURCE_PNG).toString("base64")}`;
  await run("extra:image-to-text", "Salesforce/blip-image-captioning-base", { base64: png }, async (o) => ({ ok: typeof JSON.stringify(o) === "string" && JSON.stringify(o).length > 5, note: "caption" }));
  await run("extra:asr", "openai/whisper-tiny", { url: "https://huggingface.co/datasets/Narsil/asr_dummy/resolve/main/mlk.flac" }, async (o) => ({ ok: /dream/i.test(JSON.stringify(o ?? "")), note: "whisper-tiny on a public sample" }));
  await run("extra:text-to-image", "stabilityai/stable-diffusion-xl-base-1.0", { text: "A blue circle on white" }, async (o) => {
    const got = await fetchOutput(o); const kind = kindOf(got?.bytes);
    return { ok: ["png", "jpeg", "webp"].includes(kind), note: `container=${kind} bytes=${got?.bytes?.length ?? 0}` };
  });
  await run("extra:embeddings", "sentence-transformers/all-MiniLM-L6-v2", { text: "accessible library search" }, async (o) => ({ ok: Array.isArray(o) && o.length > 100, note: `dims=${Array.isArray(o) ? o.length : 0}` }));
}

// ── Run ─────────────────────────────────────────────────────────────────────
// The comparison must itself be proven: an exact 2× enlargement of the source
// scores ~0, a different picture of the same size scores high.
{
  const doubled = makePng(SRC_W * 2, SRC_H * 2, (x, y) => srcPixel(Math.floor(x / 2), Math.floor(y / 2)));
  const other = makePng(SRC_W * 2, SRC_H * 2, (x, y) => [(x * 7) % 256, (y * 13) % 256, (x * y) % 256]);
  const same = sameImageScore(doubled), different = sameImageScore(other);
  facts.comparatorSelfTest = { enlargedSource: same, differentPicture: different, ok: same !== null && same < 5 && different > 20 };
  console.log(`self-test: enlarged source ${same}/255, different picture ${different}/255 -> ${facts.comparatorSelfTest.ok ? "ok" : "BROKEN"}`);
  if (process.argv.includes("--selftest")) process.exit(facts.comparatorSelfTest.ok ? 0 : 1);
}
if (!KEY) {
  console.log("BYTEZ_API_KEY: MISSING — nothing to test.");
  process.exit(0);
}
await account();
await sanity();
const anything = rows.some((r) => r.area === "sanity" && r.ok) || (facts.catalogSize ?? 0) > 0;
facts.accountCanRunAnything = anything;
// Every capability is still asked even if the catalog looks empty: an empty
// list is not proof a model will not run. A 404 on a run is the proof.
await video();
await upscale();
await speech();
await extras();

const table = [
  "| area | probe | model | result | HTTP | ms | provider's reason / validation (sanitised) |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.area} | ${r.probe} | \`${r.model}\` | ${r.ok ? "PASS" : "FAIL"} | ${r.status} | ${r.ms} | ${r.note.replace(/\|/g, "/")} |`),
  "", "### Facts", "", "```json", JSON.stringify(facts, null, 2), "```",
].join("\n");
console.log(`\n## Bytez capability audit\n\n${table}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Bytez capability audit\n\n${table}\n`);
}
