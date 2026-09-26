// A real request through Visionex's own chat adapter to OpenRouter.
//
//   deno run --allow-env --allow-net scripts/ai-eval/openrouter-adapter-smoke.ts
//
// provider-smoke.mjs proves the key and the endpoint. This proves *our code*:
// aiProvider.ts's OpenAI-compatible path with OpenRouter's config and headers,
// the activation gate, the stream settlement (observeStream) and the fallback
// loop — against free models only, because the key's paid access is exhausted.
// A pass here says nothing about paid models.
//
// The registry is replaced by a fixed view that switches OpenRouter on for the
// run, exactly the answer an activated row would give. Nothing is written to
// any database. Printed: pass/fail, attempt codes, lengths — never the key,
// never the model's text.

import {
  type ProviderAttempt,
  setProviderAttemptRecorder,
  setProviderRegistryView,
  streamChatCompletionWithFallback,
  structuredCompletionWithFallback,
} from "../../supabase/functions/_shared/aiProvider.ts";

const TEXT_MODEL = Deno.env.get("OPENROUTER_SMOKE_TEXT_MODEL") ?? "google/gemma-4-26b-a4b-it:free";
const TOOL_MODEL = Deno.env.get("OPENROUTER_SMOKE_TOOL_MODEL") ?? "inclusionai/ling-3.0-flash-fin:free";
// A free model that answered 429 upstream in every run on 2026-09-26.
const BUSY_MODEL = Deno.env.get("OPENROUTER_SMOKE_BUSY_MODEL") ?? "qwen/qwen3.8-27b:free";

const attempts: ProviderAttempt[] = [];
setProviderAttemptRecorder((a) => attempts.push(a));
setProviderRegistryView({ verdict: () => "ready", extras: () => [] });

const rows: string[] = [];
const report = (name: string, ok: boolean, detail: string) => rows.push(`| ${name} | ${ok ? "PASS" : "FAIL"} | ${detail} |`);
const trail = (from: number) =>
  attempts.slice(from).map((a) => `${a.provider}/${a.model}#${a.attempt}:${a.success ? "ok" : a.error}`).join(" → ");

// 1. Stream: accepted, read to the end, settled as a success with text.
{
  const from = attempts.length;
  try {
    const out = await streamChatCompletionWithFallback({
      targets: [{ provider: "openrouter", model: TEXT_MODEL }],
      system: "You are terse.",
      messages: [{ role: "user", content: "Reply with exactly the word OK." }],
      maxTokens: 64,
    });
    const body = await new Response(out.result).text();
    const settled = attempts.slice(from).at(-1);
    report("stream", Boolean(settled?.success) && /"content"/.test(body), `${body.length} bytes; ${trail(from)}`);
  } catch (e) {
    report("stream", false, `${(e as Error).name}; ${trail(from)}`);
  }
}

// 2. Structured: a tool call parsed into an object.
{
  const from = attempts.length;
  try {
    const out = await structuredCompletionWithFallback({
      targets: [{ provider: "openrouter", model: TOOL_MODEL }],
      system: "Answer with the tool.",
      userText: "Call the tool with the word OK.",
      schema: { type: "object", properties: { word: { type: "string" } }, required: ["word"] },
      toolName: "answer",
      maxTokens: 256,
    });
    const word = (out.result as { word?: unknown })?.word;
    report("structured", typeof word === "string", `word=${typeof word === "string" ? word.length + " chars" : "missing"}; ${trail(from)}`);
  } catch (e) {
    report("structured", false, `${(e as Error).name}; ${trail(from)}`);
  }
}

// 3. Fallback: a model that is rate-limited upstream falls through to the next.
{
  const from = attempts.length;
  try {
    const out = await structuredCompletionWithFallback({
      targets: [{ provider: "openrouter", model: BUSY_MODEL }, { provider: "openrouter", model: TOOL_MODEL }],
      system: "Answer with the tool.",
      userText: "Call the tool with the word OK.",
      schema: { type: "object", properties: { word: { type: "string" } }, required: ["word"] },
      toolName: "answer",
      maxTokens: 256,
    });
    const first = attempts[from];
    const fellThrough = first && !first.success && out.model === TOOL_MODEL;
    const servedFirst = first?.success && out.model === BUSY_MODEL;
    report("fallback", Boolean(fellThrough || servedFirst),
      `${fellThrough ? "first refused, second served" : servedFirst ? "first answered this time (not a fallback test)" : "unexpected"}; ${trail(from)}`);
  } catch (e) {
    report("fallback", false, `${(e as Error).name}; ${trail(from)}`);
  }
}

console.log(["## OpenRouter through the Visionex adapter (free models only)", "", "| check | result | detail |", "| --- | --- | --- |", ...rows].join("\n"));
