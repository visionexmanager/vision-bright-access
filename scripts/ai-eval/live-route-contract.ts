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
  createEmbedding,
  EMBEDDING_DIM,
  pausedReason,
  type ProviderTarget,
  setProviderAttemptRecorder,
  setUsageSink,
  streamChatCompletion,
  streamChatCompletionWithFallback,
  structuredCompletion,
  structuredCompletionWithFallback,
} from "../../supabase/functions/_shared/aiProvider.ts";
import { ASSISTANTS } from "../../supabase/functions/_shared/assistants.ts";
import { answerIsInScript, expectedScriptForMessage, scriptOfLanguage, textOf } from "../../supabase/functions/_shared/answerLanguage.ts";
import { GENERATION_SCHEMA, generatorTargets, getGenerator } from "../../supabase/functions/_shared/generators.ts";
import { getVisionAnalyst, VISION_SCHEMA } from "../../supabase/functions/_shared/visionAnalysts.ts";
import { understandDocument, understandImage } from "../../supabase/functions/_shared/whatsappUnderstand.ts";
import { meteredFetch } from "../../supabase/functions/_shared/meteredFetch.ts";
import { synthesize } from "../../supabase/functions/_shared/voice/tts.ts";
import { transcribe } from "../../supabase/functions/_shared/voice/stt.ts";
import { defaultSpokenVoice } from "../../supabase/functions/_shared/whatsappVoiceReply.ts";
import { editWithOpenAI } from "../../supabase/functions/_shared/providers/openaiImageEdit.ts";
import type { UsageEvent } from "../../supabase/functions/_shared/metering.ts";

const T = {
  gpt41: { provider: "openai", model: "gpt-4.1" },
  gpt4o: { provider: "openai", model: "gpt-4o" },
  mini: { provider: "openai", model: "gpt-4o-mini" },
  luna: { provider: "openai", model: "gpt-5.6-luna" },
  groq20: { provider: "groq", model: "openai/gpt-oss-20b" },
  groq120: { provider: "groq", model: "openai/gpt-oss-120b" },
  mistral14: { provider: "mistral", model: "ministral-14b-latest" },
  lite: { provider: "gemini", model: "gemini-flash-lite-latest" },
  flash: { provider: "gemini", model: "gemini-flash-latest" },
} as const satisfies Record<string, ProviderTarget>;

// `rateLimited`: the provider answered 429. That says the account is busy, not
// that the model is broken — the 2026-09-28 run marked every Gemini and Groq
// model not ready on 51 such rows it caused itself — so a rate-limited row is
// reported but never counted in a model's verdict.
type Row = { route: string; target: string; pass: boolean; ms: number; checks: string; rateLimited?: boolean };
const rows: Row[] = [];
const ARABIC = /[؀-ۿ]/;

// Free-tier providers are paced so the probe does not rate-limit itself. The
// gaps fit their per-minute request limits with room to spare (section K
// prints the real limits).
const PACE_MS: Partial<Record<string, number>> = { groq: 2_500, gemini: 4_500, mistral: 1_200 };
const lastCallAt = new Map<string, number>();
async function pace(provider: string) {
  const gap = PACE_MS[provider];
  if (!gap) return;
  const wait = (lastCallAt.get(provider) ?? 0) + gap - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt.set(provider, Date.now());
}

async function run(route: string, target: ProviderTarget, fn: () => Promise<Record<string, boolean>>) {
  await pace(target.provider);
  const started = Date.now();
  let checks: Record<string, boolean> = {};
  let error = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // A route that neither answers nor fails is a failure too, not a hung run.
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject({ status: "timeout" }), 90_000); });
    checks = await Promise.race([fn(), timeout]);
  } catch (e) {
    // The status only. A provider's message can carry an account id.
    const status = (e as { status?: unknown })?.status;
    error = typeof status === "number" ? `http_${status}` : status === "timeout" ? "timeout" : "error";
  } finally {
    clearTimeout(timer);
  }
  const pass = !error && Object.values(checks).every(Boolean);
  const detail = error || Object.entries(checks).map(([k, v]) => `${k}:${v ? "y" : "N"}`).join(" ");
  const row: Row = { route, target: `${target.provider}/${target.model}`, pass, ms: Date.now() - started, checks: detail };
  if (error === "http_429") row.rateLimited = true;
  rows.push(row);
  console.log(`${verdictLabel(row)} ${row.route} ${row.target} ${row.ms}ms ${row.checks}`);
}

/** Routes that exercise a whole chain or the router, not the model in their target column. */
const CHAIN_ROUTE = /^(chain |router |fallback )/;

function verdictLabel(row: Row): string {
  return row.pass ? "PASS" : row.rateLimited ? "RATE-LIMITED" : "FAIL";
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
          // The same judgement production applies (answerLanguage.ts).
          language: answerIsInScript(text, lang === "ar" ? "arabic" : "latin"),
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
  return { schema: hasRequired(result, schema), language: answerIsInScript(textOf(result), scriptOfLanguage(lang)!) };
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

// ── F. Generators: which model should follow flash-lite / lead the default chain? ──
// Every generator, both languages, each candidate. Groq's 400s are classified
// from the response body without printing it: the body carries the model's
// own failed output, which is content.
const groqFailures: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await realFetch(input, init);
  if (String(input).includes("api.groq.com") && response.status === 400) {
    try {
      const err = (await response.clone().json())?.error ?? {};
      const message = String(err.message ?? "");
      const generation = String(err.failed_generation ?? "");
      let parses = false;
      try { JSON.parse(generation); parses = true; } catch { /* not JSON */ }
      const kind = /max.{0,20}token|length/i.test(message) ? "length"
        : /did not match schema|validation|missing propert|required/i.test(message) ? "schema"
        : /not in request\.tools|unknown tool|no tool/i.test(message) ? "wrong_tool"
        : /parse|json/i.test(message) ? "json"
        : "other";
      groqFailures.push(`${err.code ?? "?"}/${kind} gen_len=${generation.length} gen_json=${parses} ends_brace=${generation.trimEnd().endsWith("}")}`);
    } catch { groqFailures.push("unreadable"); }
  }
  return response;
};
for (const id of Object.keys(PARAMS)) {
  for (const lang of ["ar", "en"]) {
    for (const target of [T.groq20, T.groq120, T.mistral14, T.lite]) {
      await run(`gen-candidates ${id} (${lang})`, target, () => generate(id, target, lang));
    }
  }
}
globalThis.fetch = realFetch;
console.log(`groq 400 diagnostics (${groqFailures.length}):`);
for (const line of groqFailures) console.log(`  ${line}`);

// ── G. The real chains, end to end, with language enforcement on ──
// What a user gets: the production chain for each generator and for the site
// assistant, asked in Arabic. Which model answered, and every attempt's code.
{
  const attempts: string[] = [];
  setProviderAttemptRecorder((a) => attempts.push(`${a.model.split("/").pop()}:${a.success ? "ok" : a.error}`));
  for (const id of Object.keys(PARAMS)) {
    const generator = getGenerator(id)!;
    const schema = (generator.schema ?? GENERATION_SCHEMA) as { required?: readonly string[] };
    attempts.length = 0;
    const chain = generator.targets ?? generatorTargets(id);
    await run(`chain generator ${id} (ar)`, chain[0], async () => {
      const { result, provider, model } = await structuredCompletionWithFallback({
        targets: chain, system: generator.buildSystem(PARAMS[id], "ar"), userText: generator.buildUser(PARAMS[id], "ar"),
        schema: schema as unknown as Record<string, unknown>, toolName: generator.toolName ?? "generated_plan", maxTokens: 2000,
        expectScript: scriptOfLanguage("ar"),
      });
      console.log(`  answered by ${provider}/${model}; attempts ${attempts.join(" ")}`);
      return { schema: hasRequired(result, schema), language: answerIsInScript(textOf(result), "arabic") };
    });
  }
  const siteChain = [T.groq20, T.mistral14, T.gpt41, T.luna];
  for (const question of [ASK.ar, "اشرح لي باختصار ما هي منصة Visionex وكيف تساعد المكفوفين."]) {
    attempts.length = 0;
    await run("chain site assistant (ar)", siteChain[0], async () => {
      const { result, provider, model } = await streamChatCompletionWithFallback({
        targets: siteChain, system: ASSISTANTS["travel-agency"].systemPrompt, messages: [{ role: "user", content: question }],
        maxTokens: 800, expectScript: expectedScriptForMessage(question),
      });
      const { text } = await drain(result);
      console.log(`  answered by ${provider}/${model}; attempts ${attempts.join(" ")}`);
      return { text: text.trim().length > 20, language: answerIsInScript(text, "arabic") };
    });
  }
  setProviderAttemptRecorder(null);
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

// ── H. Every OpenAI model the adapter serves, through the adapter itself ──
// The 2026-09-28 audit made these callable (OPENAI_REASONING_MODELS) without
// routing them. Each must stream to the end and fill a tool schema through the
// production adapter, and its token usage must reach the attempt recorder.
{
  const usage: string[] = [];
  setProviderAttemptRecorder((a) => usage.push(a.usage?.total_tokens ? "usage" : "no-usage"));
  const REPLY = { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] };
  for (const model of ["gpt-6-astra", "gpt-6-sol", "gpt-6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna",
    "gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.2", "gpt-5.1", "gpt-4.1", "gpt-4.1-mini"]) {
    const target: ProviderTarget = { provider: "openai", model };
    await run("adapter stream", target, async () => {
      const { result } = await streamChatCompletionWithFallback({
        targets: [target], system: "Answer in one short sentence.", messages: [{ role: "user", content: "What colour is the sky on a clear day?" }], maxTokens: 200,
      });
      const { text, finish } = await drain(result);
      return { text: text.trim().length > 0, finished: finish === "stop" };
    });
    usage.length = 0;
    await run("adapter structured", target, async () => {
      const { result } = await structuredCompletionWithFallback({
        targets: [target], system: "Answer briefly.", userText: "Say hello.", schema: REPLY, toolName: "reply", maxTokens: 300,
      });
      return { schema: typeof (result as { reply?: unknown })?.reply === "string", usage: usage.includes("usage") };
    });
  }
  setProviderAttemptRecorder(null);
}

// A model the key lists but cannot call (gpt-5-codex: 404 in the audit) is
// recorded as a failure, and the chain answers from the next target.
{
  const attempts: string[] = [];
  setProviderAttemptRecorder((a) => attempts.push(`${a.model}:${a.success ? "ok" : a.error}`));
  const chain: ProviderTarget[] = [{ provider: "openai", model: "gpt-5-codex" }, { provider: "openai", model: "gpt-5.6-terra" }];
  await run("fallback past a refused model", chain[0], async () => {
    const { model } = await structuredCompletionWithFallback({
      targets: chain, system: "Answer briefly.", userText: "Say hello.",
      schema: { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] }, toolName: "reply", maxTokens: 300,
    });
    return {
      "failure-recorded": attempts[0]?.startsWith("gpt-5-codex:") && !attempts[0].endsWith(":ok"),
      "answered-by-terra": model === "gpt-5.6-terra",
    };
  });
  setProviderAttemptRecorder(null);
}

// ── I. Every live provider reports a stream's usage (metering) ──
// OpenAI and Groq only when asked (stream_options.include_usage), Mistral and
// our Gemini transform unprompted. "reported" is the provider's own count; an
// "estimated" here means the provider stopped sending it.
{
  for (const target of [T.mini, T.luna, T.groq120, T.mistral14, T.lite]) {
    await run("stream usage reported", target, async () => {
      let seen: { usage_source: string; usage?: { input_tokens?: number; output_tokens?: number } } | undefined;
      setUsageSink((e) => { if (e.operation === "stream") seen = e; });
      const raw = await streamChatCompletion({ ...target, system: "Answer in one short sentence.", messages: [{ role: "user", content: "Name a colour." }], maxTokens: 200 });
      const bytes = await new Response(raw).text();
      setUsageSink(null);
      return {
        reported: seen?.usage_source === "reported",
        tokens: (seen?.usage?.input_tokens ?? 0) > 0 && (seen?.usage?.output_tokens ?? 0) > 0,
        "no-usage-chunk": !bytes.includes("\"choices\":[]"),
      };
    });
  }
}

// ── J. meteredFetch against the real API: each call reports what it used ──
// The paths outside aiProvider (direct callers, speech, transcription,
// moderation). Image generation is left out: it costs money on every run.
{
  const key = Deno.env.get("OPENAI_API_KEY") ?? "";
  const auth = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const events: UsageEvent[] = [];
  const settle = () => new Promise((r) => setTimeout(r, 300));
  const last = () => events[events.length - 1];
  setUsageSink((e) => events.push(e));
  const target = { provider: "openai", model: "gpt-4o-mini" } as const;
  let speech: ArrayBuffer | null = null;

  await run("metered chat", target, async () => {
    const res = await meteredFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: auth, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: "Say OK." }], max_tokens: 5 }),
    });
    const body = await res.json();
    await settle();
    return { answer: typeof body?.choices?.[0]?.message?.content === "string", reported: last()?.operation === "chat" && last()?.usage_source === "reported" };
  });
  await run("metered stream", target, async () => {
    const res = await meteredFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: auth, body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: "Say OK." }], max_tokens: 5, stream: true }),
    });
    const text = await res.text();
    return { "no-usage-chunk": !text.includes("\"choices\":[]"), reported: last()?.operation === "stream" && last()?.usage_source === "reported" };
  });
  await run("metered moderation", { provider: "openai", model: "omni-moderation-latest" }, async () => {
    const res = await meteredFetch("https://api.openai.com/v1/moderations", {
      method: "POST", headers: auth, body: JSON.stringify({ model: "omni-moderation-latest", input: "hello" }),
    });
    await res.json();
    await settle();
    return { reported: last()?.operation === "moderation" && last()?.outcome === "ok" };
  });
  await run("metered speech", { provider: "openai", model: "tts-1" }, async () => {
    const res = await meteredFetch("https://api.openai.com/v1/audio/speech", {
      method: "POST", headers: auth, body: JSON.stringify({ model: "tts-1", voice: "alloy", input: "Hello, forty two.", response_format: "mp3" }),
    });
    speech = await res.arrayBuffer();
    await settle();
    return { audio: speech.byteLength > 1000, characters: last()?.operation === "tts" && last()?.usage?.characters === 17 };
  });
  await run("metered transcription", { provider: "openai", model: "whisper-1" }, async () => {
    const form = new FormData();
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("file", new Blob([speech ?? new ArrayBuffer(0)], { type: "audio/mpeg" }), "probe.mp3");
    const res = await meteredFetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    const body = await res.json();
    await settle();
    return { text: /hello/i.test(body?.text ?? ""), seconds: last()?.operation === "stt" && (last()?.usage?.seconds ?? 0) > 0 };
  });
  setUsageSink(null);
}

// ── K. Each free-tier provider's own limits: busy, or broken? ──
// One minimal call each, and only the limit figures are printed: requests and
// tokens per minute or per day, as the provider states them. A provider whose
// limit is a handful of requests a minute will answer 429 to real traffic too;
// one that answers a 1-token request is working. Figures only, never a key.
{
  const minimal = { messages: [{ role: "user", content: "hi" }], max_tokens: 1 };
  const limitHeaders = (h: Headers) => [...h.entries()]
    .filter(([k]) => /ratelimit|retry-after/i.test(k))
    .map(([k, v]) => `${k.replace(/^x-/, "")}=${v.replace(/[^0-9.a-z]/gi, "").slice(0, 16)}`)
    .join(" ") || "no limit headers";
  const probes: Array<[ProviderTarget, string, Record<string, string>, unknown]> = [
    [T.groq20, "https://api.groq.com/openai/v1/chat/completions", { Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY") ?? ""}` }, { model: T.groq20.model, ...minimal }],
    [T.groq120, "https://api.groq.com/openai/v1/chat/completions", { Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY") ?? ""}` }, { model: T.groq120.model, ...minimal }],
    [T.mistral14, "https://api.mistral.ai/v1/chat/completions", { Authorization: `Bearer ${Deno.env.get("MISTRAL_API_KEY") ?? ""}` }, { model: T.mistral14.model, ...minimal }],
  ];
  for (const [target, url, auth, body] of probes) {
    await pace(target.provider);
    const res = await fetch(url, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await res.body?.cancel();
    console.log(`  limits ${target.provider}/${target.model}: HTTP ${res.status} ${limitHeaders(res.headers)}`);
  }
  // Gemini states its limit in the 429 body instead: the quota id and its value.
  await pace("gemini");
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${T.lite.model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": Deno.env.get("GEMINI_API_KEY") ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }),
  });
  const gBody = await g.json().catch(() => null) as { error?: { details?: Array<{ violations?: Array<{ quotaId?: string; quotaValue?: string }>; retryDelay?: string }> } } | null;
  const quotas = (gBody?.error?.details ?? []).flatMap((d) => d.violations ?? []).map((v) => `${String(v.quotaId).replace(/[^A-Za-z]/g, "")}=${String(v.quotaValue).replace(/\D/g, "")}`);
  const retry = (gBody?.error?.details ?? []).find((d) => d.retryDelay)?.retryDelay?.replace(/[^0-9s.]/g, "");
  console.log(`  limits gemini/${T.lite.model}: HTTP ${g.status} ${quotas.join(" ") || "no quota in body"}${retry ? ` retry=${retry}` : ""}`);
}

// ── L. Every OpenAI capability a service relies on, through production code ──
// The reliability backend has to be proven per capability, not per catalog
// entry: text (stream, schema), vision in both languages, both speech
// directions in both languages, image generation and editing, embeddings,
// and a realtime session. Minimal payloads; image calls at the lowest quality.
{
  const key = Deno.env.get("OPENAI_API_KEY") ?? "";
  const DESCRIBE = { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false };
  const pngData = `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`;

  for (const target of [T.gpt4o, T.mini]) {
    await run("adapter stream", target, async () => {
      const { text, finish } = await drain(await streamChatCompletion({ ...target, system: "Answer in one short sentence.", messages: [{ role: "user", content: ASK.en }], maxTokens: 60 }));
      return { text: text.trim().length > 0, finished: finish === "stop" || finish === "length" };
    });
    for (const [lang, question] of [["en", "What number is written in this image? Answer with the number."], ["ar", "ما الرقم المكتوب في هذه الصورة؟ أجب بالرقم."]] as const) {
      await run(`vision ${lang}`, target, async () => {
        const result = await structuredCompletion({
          ...target, system: "You describe images for blind and low-vision users, clearly and accurately.", userText: question,
          image: pngData, schema: DESCRIBE, toolName: "describe_image", maxTokens: 200,
        }) as { answer?: string };
        const answer = result?.answer ?? "";
        return { digits: /42|٤٢/.test(answer), ...(lang === "ar" ? { arabic: ARABIC.test(answer) || /^\s*(42|٤٢)\s*$/.test(answer) } : {}) };
      });
    }
  }

  // Speech out, then back in: what the WhatsApp voice reply and the site voices
  // send, transcribed by both STT providers — each language a round trip.
  const spoken: Record<string, Uint8Array | null> = { en: null, ar: null };
  const SAY = { en: "Hello, this is Visionex. Forty two.", ar: "مرحبا، هذه منصة فيجن إكس." } as const;
  for (const lang of ["en", "ar"] as const) {
    const voice = defaultSpokenVoice();
    await run(`tts ${lang} (whatsapp voice)`, { provider: "openai", model: voice.model }, async () => {
      const out = await synthesize({ text: SAY[lang], provider: "openai", model: voice.model, voice: voice.voice, format: "mp3", instructions: voice.instructions });
      if (out.outcome === "audio") spoken[lang] = out.bytes;
      return { audio: out.outcome === "audio" && out.bytes.byteLength > 2000 };
    });
  }
  await run("tts en (speech-generate)", { provider: "openai", model: "tts-1" }, async () => {
    const out = await synthesize({ text: SAY.en, provider: "openai", model: "tts-1", voice: "alloy", format: "opus" });
    return { audio: out.outcome === "audio" && out.bytes.byteLength > 1000 };
  });
  for (const provider of ["openai", "groq"] as const) {
    for (const lang of ["en", "ar"] as const) {
      const model = provider === "openai" ? "whisper-1" : "whisper-large-v3-turbo";
      await run(`stt ${lang}`, { provider, model }, async (): Promise<Record<string, boolean>> => {
        const audio = spoken[lang];
        if (!audio) return { audio: false };
        const heard = await transcribe({ bytes: audio, mimeType: "audio/mpeg", providers: [provider] });
        const text = heard.outcome === "transcript" ? heard.text : "";
        return { text: lang === "en" ? /visionex|vision ex|forty.?two|42/i.test(text) : ARABIC.test(text) };
      });
    }
  }

  // Image generation, as image-generate asks for it, and an edit as the image
  // tools would. Lowest quality: these cost money on every run.
  // The first generated picture is the edit's source below: a real RGB image,
  // as an upload is — not the probe's 8-bit greyscale digits.
  let generated: Uint8Array | null = null;
  for (const model of ["gpt-image-1", "gpt-image-1-mini"]) {
    await run("image generation", { provider: "openai", model }, async () => {
      const res = await meteredFetch("https://api.openai.com/v1/images/generations", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: "A simple flat icon of a blue circle on a white background.", n: 1, size: "1024x1024", quality: "low" }),
      });
      if (!res.ok) throw { status: res.status };
      const body = await res.json() as { data?: Array<{ b64_json?: string }> };
      const b64 = body.data?.[0]?.b64_json ?? "";
      generated ??= b64 ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : null;
      return { image: b64.length > 1000 };
    });
  }
  await run("image edit (transparent background)", { provider: "openai", model: "gpt-image-1" }, async () => {
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("image", new Blob([(generated ?? PNG).slice()], { type: "image/png" }), "probe.png");
    form.append("prompt", "Remove the background completely. Keep the main subject exactly as it is.");
    form.append("background", "transparent");
    form.append("output_format", "png");
    form.append("quality", "low");
    form.append("size", "1024x1024");
    const res = await meteredFetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!res.ok) throw { status: res.status };
    const body = await res.json() as { data?: Array<{ b64_json?: string }> };
    const b64 = body.data?.[0]?.b64_json ?? "";
    // PNG colour type 6 (RGBA) is byte 25 of the file: an alpha channel came back.
    const bytes = Uint8Array.from(atob(b64.slice(0, 64)), (c) => c.charCodeAt(0));
    return { image: b64.length > 1000, alpha: bytes[25] === 6 };
  });

  // The Image Studio tools' own edit, as image-tools-generate calls it (only
  // the quality is lowered): the modes it serves while Replicate is parked.
  for (const mode of ["bg-remove", "restore"] as const) {
    await run(`image tool ${mode}`, { provider: "openai", model: "gpt-image-1" }, async () => {
      const out = await editWithOpenAI(mode, new Blob([(generated ?? PNG).slice()], { type: "image/png" }), undefined, { quality: "low" });
      if (!out.ok) throw { status: /d{3}/.test(out.error) ? Number(out.error.match(/d{3}/)![0]) : "error" };
      return { image: out.bytes.byteLength > 1000, png: out.bytes[1] === 0x50, ...(mode === "bg-remove" ? { alpha: out.bytes[25] === 6 } : {}) };
    });
  }

  await run("embeddings", { provider: "openai", model: "text-embedding-3-small" }, async () => {
    const [vector] = await createEmbedding(["Visionex accessible library search"]);
    return { dims: vector?.length === EMBEDDING_DIM };
  });

  await run("realtime session", { provider: "openai", model: "gpt-realtime-2" }, async () => {
    // What realtime-session asks for, minus the user and the voice config: an
    // ephemeral secret for a session. Nothing is spoken, so nothing is billed.
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: 60 }, session: { type: "realtime", model: "gpt-realtime-2" } }),
    });
    if (!res.ok) throw { status: res.status };
    const body = await res.json() as { value?: unknown };
    return { secret: typeof body.value === "string" && body.value.length > 10 };
  });
}

// ── Report ──────────────────────────────────────────────────────────────────
const lines = [
  "| route | target | verdict | ms | checks |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.route} | \`${r.target}\` | ${verdictLabel(r)} | ${r.ms} | ${r.checks} |`),
  "",
  `${rows.filter((r) => r.pass).length}/${rows.length} passed, ${rows.filter((r) => r.rateLimited).length} rate-limited (inconclusive)`,
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

// ── Model checks for the readiness gate (ai_model_readiness) ──
// One verdict per model: it passed only if every route it served here passed.
// Strict on purpose — a model that failed anything is not ready to be billed.
// Written only when the workflow asks (main, never a pull request).
const checksOut = Deno.env.get("MODEL_CHECKS_OUT");
if (checksOut) {
  const verdicts = new Map<string, boolean>();
  for (const r of rows) {
    // A rate-limited row is no evidence either way. A model whose every row was
    // rate-limited gets no verdict at all, so its last real one stands.
    if (r.rateLimited) continue;
    // A chain or router row names the chain's first target, but whichever model
    // answered is what passed (G's generators were answered by Mistral with
    // flash-latest in the column; H's fallback by terra with gpt-5-codex). It
    // proves the router, not the model it names.
    if (CHAIN_ROUTE.test(r.route)) continue;
    const [provider, ...rest] = r.target.split("/");
    const key = `${provider}\t${rest.join("/")}`;
    verdicts.set(key, (verdicts.get(key) ?? true) && r.pass);
  }
  const checks = [...verdicts].map(([key, passed]) => {
    const [provider, model_id] = key.split("\t");
    return { provider, model_id, check_name: "live_route_contract", passed };
  });
  await Deno.writeTextFile(checksOut, JSON.stringify(checks));
}
