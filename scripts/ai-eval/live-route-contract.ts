// Live route contract probe (Phase 1).
//
// Before a model joins or leads a production chain, it has to meet that chain's
// own contract — not a generic "say OK". This runs the production modules
// themselves (the same system prompts, schemas, adapter and router the Edge
// Functions use) against LIVE models only, and checks what each caller relies
// on: a valid stream that finishes, the schema's required fields, the answer in
// the user's language, no truncation.
//
// It is given only the four live providers' keys (see the workflow), so no
// parked provider can be called whatever this file says. It prints verdicts,
// latencies and booleans — never a prompt, an answer or a key: the repository
// is public and so are its logs.
//
// Run: deno run --allow-env --allow-net --allow-read --allow-sys scripts/ai-eval/live-route-contract.ts

import {
  pausedReason,
  type ProviderTarget,
  setProviderAttemptRecorder,
  streamChatCompletion,
  structuredCompletion,
  structuredCompletionWithFallback,
} from "../../supabase/functions/_shared/aiProvider.ts";
import { ASSISTANTS } from "../../supabase/functions/_shared/assistants.ts";
import { GENERATION_SCHEMA, getGenerator } from "../../supabase/functions/_shared/generators.ts";
import { getVisionAnalyst, VISION_SCHEMA } from "../../supabase/functions/_shared/visionAnalysts.ts";
import { understandDocument, understandImage } from "../../supabase/functions/_shared/whatsappUnderstand.ts";

const T = {
  gpt41: { provider: "openai", model: "gpt-4.1" },
  gpt4o: { provider: "openai", model: "gpt-4o" },
  mini: { provider: "openai", model: "gpt-4o-mini" },
  luna: { provider: "openai", model: "gpt-5.6-luna" },
  groq20: { provider: "groq", model: "openai/gpt-oss-20b" },
  mistral14: { provider: "mistral", model: "ministral-14b-latest" },
  lite: { provider: "gemini", model: "gemini-flash-lite-latest" },
  flash: { provider: "gemini", model: "gemini-flash-latest" },
} as const satisfies Record<string, ProviderTarget>;

type Row = { route: string; target: string; pass: boolean; ms: number; checks: string };
const rows: Row[] = [];
const ARABIC = /[؀-ۿ]/;

async function run(route: string, target: ProviderTarget, fn: () => Promise<Record<string, boolean>>) {
  const started = Date.now();
  let checks: Record<string, boolean> = {};
  let error = "";
  try {
    checks = await fn();
  } catch (e) {
    // The status only. A provider's message can carry an account id.
    const status = (e as { status?: unknown })?.status;
    error = typeof status === "number" ? `http_${status}` : "error";
  }
  const pass = !error && Object.values(checks).every(Boolean);
  const detail = error || Object.entries(checks).map(([k, v]) => `${k}:${v ? "y" : "N"}`).join(" ");
  rows.push({ route, target: `${target.provider}/${target.model}`, pass, ms: Date.now() - started, checks: detail });
}

/** Read an OpenAI-compatible SSE stream to the end: the text, and how it finished. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<{ text: string; finish: string | null }> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "", text = "", finish: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try {
        const choice = JSON.parse(line.slice(6)).choices?.[0];
        text += choice?.delta?.content ?? "";
        if (choice?.finish_reason) finish = choice.finish_reason;
      } catch { /* a keep-alive or partial line */ }
    }
  }
  return { text, finish };
}

const hasRequired = (value: unknown, schema: { required?: readonly string[] }) =>
  !!value && typeof value === "object" && (schema.required ?? []).every((k) => {
    const v = (value as Record<string, unknown>)[k];
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  });

// ── A. Gemini-first assistants: can flash-lite lead them? (Groq, today's leader, alongside) ──
const GEMINI_FIRST = ["travel-agency", "educational-empire", "music-conservatory", "tech-consulting", "professional-training", "simulation-mentor"];
const ASK = {
  ar: "أعطني ثلاث نصائح عملية قصيرة لتحسين مهاراتي في هذا المجال.",
  en: "Give me three short, practical tips to get better in this area.",
};
for (const id of GEMINI_FIRST) {
  const assistant = ASSISTANTS[id];
  for (const target of [T.lite, T.groq20]) {
    for (const [lang, question] of Object.entries(ASK)) {
      await run(`assistant ${id} (${lang})`, target, async () => {
        const { text, finish } = await drain(await streamChatCompletion({
          ...target, system: assistant.systemPrompt, messages: [{ role: "user", content: question }], maxTokens: 1200,
        }));
        return {
          text: text.trim().length > 40,
          finished: finish === null || finish === "stop",
          language: lang === "ar" ? ARABIC.test(text) : !ARABIC.test(text),
        };
      });
    }
  }
}

// ── B. Generators, called exactly as ai-generate calls them ──
const PARAMS: Record<string, Record<string, string>> = {
  "travel-itinerary": { destination: "Amman", days: "3", budget: "moderate", interests: "history, food", accessibility: "blind traveller" },
  "career-roadmap": { targetRole: "data analyst", experience: "beginner", skills: "Excel", accessibility: "screen reader user" },
  "tech-troubleshooting-plan": { problem: "Wi-Fi keeps dropping", system: "Windows 11", level: "beginner", assistiveTech: "NVDA" },
  "training-curriculum": { topic: "customer service", audience: "new staff", duration: "2 weeks", format: "online", accessibility: "captions" },
};
async function generate(id: string, target: ProviderTarget, lang: string) {
  const generator = getGenerator(id)!;
  const schema = (generator.schema ?? GENERATION_SCHEMA) as { required?: readonly string[] };
  const result = await structuredCompletion({
    ...target, system: generator.buildSystem(PARAMS[id], lang), userText: generator.buildUser(PARAMS[id], lang),
    schema: schema as unknown as Record<string, unknown>, toolName: generator.toolName ?? "generated_plan", maxTokens: 2000,
  });
  return { schema: hasRequired(result, schema), language: lang === "ar" ? ARABIC.test(JSON.stringify(result)) : true };
}
for (const id of Object.keys(PARAMS)) {
  for (const target of [T.lite, T.groq20]) await run(`generator ${id} (ar)`, target, () => generate(id, target, "ar"));
}
for (const id of ["travel-itinerary", "career-roadmap", "tech-troubleshooting-plan"]) {
  await run(`generator ${id} (en)`, T.luna, () => generate(id, T.luna, "en"));
}

// ── C. WhatsApp documents (PDF text layer, DOC/DOCX, TXT all arrive as text) ──
const DOC = new TextEncoder().encode(
  "فاتورة رقم 1187\nالتاريخ: 12 أيلول 2026\nالمبلغ المستحق: 245 دولاراً\nآخر موعد للدفع: 30 أيلول 2026\n" +
  "Invoice 1187 — amount due 245 USD, due 30 September 2026.",
);
for (const target of [T.mini, T.luna, T.lite, T.mistral14, T.groq20]) {
  await run("whatsapp document (text)", target, async () => {
    const out = await understandDocument({
      bytes: DOC, mimeType: "text/plain", filename: "invoice.txt",
      question: "ما هو المبلغ المستحق وما آخر موعد للدفع؟", languageName: "Arabic", targets: [target],
    });
    const answer = out.ok ? out.value.answer : "";
    return { ok: out.ok && out.value.readable, amount: /245|٢٤٥/.test(answer), language: ARABIC.test(answer) };
  });
}

// ── D. Vision: WhatsApp image understanding and the site analysts, flash-lite as fallback ──
const PNG = await textPng("42");
for (const target of [T.mini, T.lite]) {
  await run("whatsapp image", target, async () => {
    const out = await understandImage({
      bytes: PNG, mimeType: "image/png", question: "What number is in this picture?", languageName: "English", targets: [target],
    });
    return { readable: out?.readable === true, digits: /42/.test(out?.answer ?? "") };
  });
}
const analyst = getVisionAnalyst("skin-care")!;
for (const target of [T.gpt4o, T.lite]) {
  await run(`site image analysis (${analyst.id})`, target, async () => {
    const result = await structuredCompletion({
      ...target, system: analyst.systemPrompt, userText: "Describe what this image shows.",
      image: `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`,
      schema: VISION_SCHEMA as unknown as Record<string, unknown>, toolName: "vision_analysis", maxTokens: 1200,
    });
    return { schema: hasRequired(result, VISION_SCHEMA) };
  });
}

// ── E. The router itself: a parked model in a chain is never attempted ──
{
  const attempts: string[] = [];
  setProviderAttemptRecorder((a) => attempts.push(`${a.provider}/${a.model}`));
  await run("router skips parked flash-latest", T.lite, async () => {
    const { provider, model } = await structuredCompletionWithFallback({
      targets: [T.flash, T.lite], system: "Answer briefly.", userText: "Say hello.",
      schema: { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] }, toolName: "reply", maxTokens: 200,
    });
    return {
      parked: pausedReason(T.flash) !== null,
      "never-attempted": !attempts.includes("gemini/gemini-flash-latest"),
      "answered-by-lite": `${provider}/${model}` === "gemini/gemini-flash-lite-latest",
    };
  });
  setProviderAttemptRecorder(null);
}

// ── Report ──────────────────────────────────────────────────────────────────
const lines = [
  "| route | target | verdict | ms | checks |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.route} | \`${r.target}\` | ${r.pass ? "PASS" : "FAIL"} | ${r.ms} | ${r.checks} |`),
  "",
  `${rows.filter((r) => r.pass).length}/${rows.length} passed`,
];
console.log(lines.join("\n"));
const summary = Deno.env.get("GITHUB_STEP_SUMMARY");
if (summary) await Deno.writeTextFile(summary, `## Live route contracts\n\n${lines.join("\n")}\n`, { append: true });

// ── A greyscale PNG of digits, drawn here so no image fixture is needed ──
async function textPng(text: string, scale = 12, pad = 24): Promise<Uint8Array> {
  const GLYPHS: Record<string, string[]> = {
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  };
  const w = text.length * 6 * scale + pad * 2, h = 7 * scale + pad * 2;
  const raw = new Uint8Array((w + 1) * h).fill(0xff);
  for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
  [...text].forEach((ch, i) => GLYPHS[ch].forEach((row, gy) => [...row].forEach((bit, gx) => {
    if (bit !== "1") return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      raw[(pad + gy * scale + dy) * (w + 1) + 1 + pad + (i * 6 + gx) * scale + dx] = 0;
    }
  })));
  const zipped = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, w);
  new DataView(ihdr.buffer).setUint32(4, h);
  ihdr[8] = 8;
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zipped), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  body.set(new TextEncoder().encode(type));
  body.set(data, 4);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(8 + data.length, crc32(body));
  return out;
}

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
