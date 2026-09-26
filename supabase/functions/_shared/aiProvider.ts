// Unified AI provider layer for VisionEx edge functions.
//
// One entry point — streamChatCompletion() — that talks to any supported
// provider and ALWAYS returns an OpenAI-shaped SSE stream
// (`data: {"choices":[{"delta":{"content":"..."}}]}\n\n` … `data: [DONE]`).
//
// This lets the entire frontend (useSSEStream / AIChat) stay unchanged while
// each assistant can be switched between providers via the registry config.
//
// Groq and Mistral serve the OpenAI `/v1/chat/completions` dialect verbatim —
// same request body, same SSE frames, same tool-calling shape — so they share
// the OpenAI code path and need no stream transformation. Anthropic and Gemini
// each speak their own dialect and are translated back into OpenAI frames.

import {
  GeminiProviderError,
  geminiStreamChatCompletion,
  geminiStructuredCompletion,
} from "./geminiProvider.ts";

export type AIProvider = "openai" | "anthropic" | "gemini" | "groq" | "mistral" | "openrouter";

/**
 * Providers that serve nothing until the registry switches them on. A target
 * for one of these is used only when the installed registry view says its row
 * is active or degraded AND production-eligible (see orderTargets); with no
 * view installed, or a view that cannot say, it is never tried. They are never
 * named in the static chains: their targets come from the registry row.
 */
export const ACTIVATION_GATED: ReadonlySet<AIProvider> = new Set<AIProvider>(["openrouter"]);

export interface ProviderChatParams {
  provider: AIProvider;
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

export interface ProviderTarget {
  provider: AIProvider;
  model: string;
}

export interface ProviderResult<T> extends ProviderTarget {
  result: T;
}

/** Thrown on an upstream provider error so callers can map status codes. */
export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

// ── OpenAI-compatible providers ─────────────────────────────────────────────
//
// Each entry differs only by endpoint and secret name. Adding another
// OpenAI-compatible vendor means adding a row here and a union member above.

interface OpenAICompatibleConfig {
  /** Human-readable name, used only in error logs. */
  label: string;
  /** Supabase Edge Function secret holding the key. Never inlined anywhere. */
  envKey: string;
  chatUrl: string;
  /** Extra request headers the vendor asks for. Never auth; never a secret. */
  headers?: Record<string, string>;
}

const OPENAI_COMPATIBLE: Record<"openai" | "groq" | "mistral" | "openrouter", OpenAICompatibleConfig> = {
  openai: {
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    chatUrl: "https://api.openai.com/v1/chat/completions",
  },
  groq: {
    label: "Groq",
    envKey: "GROQ_API_KEY",
    chatUrl: "https://api.groq.com/openai/v1/chat/completions",
  },
  mistral: {
    label: "Mistral",
    envKey: "MISTRAL_API_KEY",
    chatUrl: "https://api.mistral.ai/v1/chat/completions",
  },
  // OpenAI's dialect verbatim. The two headers identify the app to OpenRouter
  // (its docs recommend them); neither is authentication. Activation-gated.
  openrouter: {
    label: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    chatUrl: "https://openrouter.ai/api/v1/chat/completions",
    headers: { "HTTP-Referer": "https://visionex.app", "X-Title": "Visionex" },
  },
};

type OpenAICompatibleProvider = keyof typeof OPENAI_COMPATIBLE;

/**
 * OpenAI reasoning models this adapter serves, by exact model id.
 *
 * On Chat Completions OpenAI refuses `max_tokens` for its reasoning family
 * ("Use 'max_completion_tokens' instead"), and reasoning tokens are spent from
 * that same completion budget. Every model the adapter served before
 * gpt-5.6-luna was a non-reasoning model, so neither rule had come up.
 *
 * `effort: "none"` keeps each caller's existing budget (2048, 1500, 1200 …)
 * meaning visible output, which is what it was sized for — at the default
 * ("medium") a short budget can be spent thinking and return nothing.
 *
 * Exact ids, never a prefix: a model is added here deliberately, and nothing a
 * caller sends can match its way in. Only the `openai` provider reads it.
 */
const OPENAI_REASONING_MODELS: Readonly<Record<string, { effort: "none" | "low" | "medium" | "high" }>> = {
  "gpt-5.6-luna": { effort: "none" },
};

/**
 * Groq's gpt-oss models reason before they answer, and `max_tokens` counts the
 * reasoning. Measured 2026-09-26 (provider-smoke.yml): asked for two sentences
 * with max_tokens 200 at the default effort, gpt-oss-20b returned HTTP 200 and
 * *no text* — every token went on reasoning. An empty stream is a success to
 * the fallback loop, so the user got silence. At effort "low" the same request
 * answered. Low effort, plus headroom for the reasoning on top of the caller's
 * budget for the answer.
 */
const GROQ_REASONING_MODELS: ReadonlySet<string> = new Set(["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);
export const GROQ_REASONING_HEADROOM = 512;

/** The completion-budget fields a request carries, for this provider and model. */
export function completionBudget(provider: AIProvider, model: string, limit: number): Record<string, unknown> {
  const reasoning = provider === "openai" && Object.prototype.hasOwnProperty.call(OPENAI_REASONING_MODELS, model)
    ? OPENAI_REASONING_MODELS[model]
    : undefined;
  if (reasoning) return { max_completion_tokens: limit, reasoning_effort: reasoning.effort };
  if (provider === "groq" && GROQ_REASONING_MODELS.has(model)) {
    return { max_tokens: limit + GROQ_REASONING_HEADROOM, reasoning_effort: "low" };
  }
  return { max_tokens: limit };
}

/**
 * Token counts from a Chat Completions `usage` object — numbers only, never
 * content. Undefined when the provider sent none, so a missing count is never
 * recorded as a zero.
 */
function usageOf(data: unknown): AttemptUsage | undefined {
  const usage = (data as { usage?: Record<string, unknown> } | null)?.usage;
  if (!usage || typeof usage !== "object") return undefined;
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined);
  const prompt = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  const completion = usage.completion_tokens_details as Record<string, unknown> | undefined;
  const out: AttemptUsage = {};
  const input = count(usage.prompt_tokens);
  const cached = count(prompt?.cached_tokens);
  const output = count(usage.completion_tokens);
  const reasoning = count(completion?.reasoning_tokens);
  const total = count(usage.total_tokens);
  if (input !== undefined) out.input_tokens = input;
  if (cached !== undefined) out.cached_input_tokens = cached;
  if (output !== undefined) out.output_tokens = output;
  if (reasoning !== undefined) out.reasoning_tokens = reasoning;
  if (total !== undefined) out.total_tokens = total;
  return Object.keys(out).length > 0 ? out : undefined;
}

function openAICompatibleConfig(provider: AIProvider): OpenAICompatibleConfig {
  const cfg = OPENAI_COMPATIBLE[provider as OpenAICompatibleProvider];
  // Anthropic and Gemini are dispatched before reaching here. A miss means an
  // unrouted provider slipped through — fail loudly instead of on `undefined`.
  if (!cfg) throw new ProviderError(500, `Unsupported AI provider: ${provider}`);
  return cfg;
}

/** Read a provider's key or fail with the same 500 shape every caller maps. */
function requireKey(cfg: OpenAICompatibleConfig): string {
  const key = Deno.env.get(cfg.envKey);
  if (!key) throw new ProviderError(500, `${cfg.envKey} is not configured`);
  return key;
}

/** Gemini has its own error class; callers only ever map ProviderError. */
function asProviderError(e: unknown): never {
  if (e instanceof GeminiProviderError) throw new ProviderError(e.status, e.message);
  throw e;
}

/**
 * Stream a chat completion from the configured provider.
 * Returns a ReadableStream of OpenAI-compatible SSE bytes.
 */
export async function streamChatCompletion(
  params: ProviderChatParams,
): Promise<ReadableStream<Uint8Array>> {
  if (params.provider === "anthropic") return streamAnthropic(params);
  if (params.provider === "gemini") {
    return geminiStreamChatCompletion({
      model: params.model,
      system: params.system,
      messages: params.messages,
      maxTokens: params.maxTokens,
    }).catch(asProviderError);
  }
  return streamOpenAICompatible(params);
}

// ── Attempt recording (Phase 2K-4) ──────────────────────────────────────────
//
// The two fallback loops below report each provider attempt — every one that
// failed and the one that answered — to a recorder the entry point installs
// (`chatRecorder.ts`). Recording only: the loops try `targets` in exactly the
// order they are given, and nothing here reads the registry to choose one.
//
// An attempt carries the provider and model it was sent to, its position in
// the chain, whether it succeeded, how long it took, and on failure one code
// from ATTEMPT_ERROR_CODES. Never the prompt, the answer, the image, a secret
// or a provider's error text.
//
// `kind` is decided by the request: a structured request carrying an image is
// "vision"; everything else — including a text document sent down a
// vision-capable chain — is "chat". A stream is always "chat": its messages
// are text.
//
// Streaming: a stream attempt succeeds when the provider accepts the request
// (a 2xx response with a body). A stream that breaks after that is not
// visible at this layer, and is not recorded as a failure.

export type AttemptKind = "chat" | "vision";

export const ATTEMPT_ERROR_CODES = [
  "not_configured",
  "http_400", "http_401", "http_403", "http_404", "http_408", "http_413", "http_422", "http_429",
  "http_4xx", "http_5xx",
  "invalid_response", "timeout", "network", "unknown",
  // A stream the provider accepted that then broke, or ended with no text.
  "stream_interrupted", "empty_response",
] as const;
export type AttemptErrorCode = typeof ATTEMPT_ERROR_CODES[number];

export interface ProviderAttempt {
  kind: AttemptKind;
  mode: "stream" | "structured";
  provider: AIProvider;
  model: string;
  /** 1 for the chain's first target, 2 for the first fallback, … */
  attempt: number;
  success: boolean;
  ms: number;
  error?: AttemptErrorCode;
  /** Token counts from the provider's response, when it sent them. */
  usage?: AttemptUsage;
}

/** Token counts only — never text, never a prompt. */
export interface AttemptUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
}

export type AttemptRecorder = (attempt: ProviderAttempt) => void;

/** Longer than any request an edge function can hold open. */
export const MAX_RECORDED_ATTEMPT_MS = 600_000;

let attemptRecorder: AttemptRecorder | null = null;

/** Installed once per function by `installChatAttemptRecording()`; null removes it. */
export function setProviderAttemptRecorder(recorder: AttemptRecorder | null): void {
  attemptRecorder = recorder;
}

const SPECIFIC_4XX = new Set([400, 401, 403, 404, 408, 413, 422, 429]);
const UNREADABLE_ANSWER = new Set([
  "No structured response from AI",
  "No structured response from Gemini",
  "Gemini returned non-JSON output despite responseSchema",
]);

/** The one code an attempt's error is recorded as. Reads the error's type and status, never records its text. */
export function attemptErrorCode(error: unknown): AttemptErrorCode {
  if (error instanceof ProviderError) {
    if (/ is not configured$/.test(error.message)) return "not_configured";
    // Gemini's two parse failures arrive with status 500; they are an answer we
    // could not read, not an outage, and must not cool Gemini down.
    if (UNREADABLE_ANSWER.has(error.message)) return "invalid_response";
    if (SPECIFIC_4XX.has(error.status)) return `http_${error.status}` as AttemptErrorCode;
    if (error.status >= 400 && error.status < 500) return "http_4xx";
    if (error.status >= 500 && error.status < 600) return "http_5xx";
    return "unknown";
  }
  if (error instanceof SyntaxError) return "invalid_response";
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  if (error instanceof TypeError) return "network";
  return "unknown";
}

function reportAttempt(attempt: ProviderAttempt): void {
  const recorder = attemptRecorder;
  if (!recorder) return;
  try {
    recorder(attempt);
  } catch {
    // Recording never reaches the request.
  }
}

function elapsedMs(start: number): number {
  return Math.min(MAX_RECORDED_ATTEMPT_MS, Math.max(0, Math.round(Date.now() - start)));
}

// ── Health-aware ordering ────────────────────────────────────────────────────
//
// A chain's order is quality policy (assistants.ts, generators.ts, …) and it
// stays the order of first choice. Two things may move a target *later* in
// its chain, so an unhealthy provider remains a last resort and an outage of
// the others does not leave a request with nothing to try. Only an explicit
// switch removes one: a row an admin set inactive or error, or an
// activation-gated provider (ACTIVATION_GATED) whose row is not switched on.
//
//   1. A short, per-isolate cooldown after a failure that will repeat if we
//      ask again at once: a 429, a 5xx, a timeout, a dropped connection, a
//      refused or missing key, a vanished model. Keyed by provider *and*
//      model — on 2026-09-26 Mistral answered ministral-14b and refused
//      mistral-small on the same key. It expires by itself, so a recovered
//      provider is first again within minutes, with no admin step. A request
//      that was itself malformed (400/413/422, unparseable answer) sets no
//      cooldown: the next request is a different request.
//
//   2. The registry (ph_providers), when an entry point installs a view:
//      a row whose health the recorded attempts have driven down is demoted;
//      a row an admin marked inactive or error is excluded; and the view
//      contributes the targets of switched-on gated providers (RegistryView).
//      See installChatAttemptRecording().
//
// This is the in-memory half of the health system, not a second one: the
// durable half is ph_providers, fed by the same attempts via the recorder.
// It exists because a registry read costs a round trip and a cooldown must
// act on the very next request.

/** How long a target sits at the back of its chain after each kind of failure. */
export const COOLDOWN_MS: Readonly<Partial<Record<AttemptErrorCode, number>>> = {
  http_429: 60_000,
  http_5xx: 30_000,
  http_408: 30_000,
  timeout: 30_000,
  network: 30_000,
  http_401: 300_000,
  http_403: 300_000,
  not_configured: 300_000,
  http_404: 300_000,
  stream_interrupted: 30_000,
};

const cooldownUntil = new Map<string, number>();
const targetKey = (t: ProviderTarget) => `${t.provider}/${t.model}`;

/** Tests only: forget every cooldown. */
export function resetProviderCooldowns(): void {
  cooldownUntil.clear();
}

function noteOutcome(target: ProviderTarget, error: AttemptErrorCode | undefined): void {
  const key = targetKey(target);
  if (!error) { cooldownUntil.delete(key); return; }
  const ms = COOLDOWN_MS[error];
  if (ms) cooldownUntil.set(key, Date.now() + ms);
}

/**
 * What the registry says about one target. Must not throw or block.
 *   "ready"    — use it in policy order.
 *   "demoted"  — unhealthy: try it after the healthy ones.
 *   "excluded" — an admin switched its row off (inactive/error), or it is an
 *                activation-gated provider whose row is not switched on. Never
 *                tried: an inactive provider receives no traffic at all.
 */
export type RegistryVerdict = "ready" | "demoted" | "excluded";

export interface RegistryView {
  verdict(target: ProviderTarget, kind: AttemptKind): RegistryVerdict;
  /**
   * Targets the registry itself contributes — activation-gated providers whose
   * rows are switched on, with the model an admin chose and verified for what
   * this request needs (tools for structured output). Appended after the
   * policy chain; empty until such a row exists.
   */
  extras(kind: AttemptKind, mode: "stream" | "structured"): ProviderTarget[];
}
let registryView: RegistryView | null = null;

/** Installed once per function, beside the recorder; null removes it. */
export function setProviderRegistryView(view: RegistryView | null): void {
  registryView = view;
}

/**
 * The chain in the order it will be tried: targets in good standing first, in
 * policy order; then the registry's own targets; then registry-demoted ones;
 * then cooling ones, soonest to recover first. Excluded targets — rows an
 * admin switched off, and gated providers not switched on — are dropped;
 * nothing else is.
 */
export function orderTargets(
  targets: ProviderTarget[],
  kind: AttemptKind,
  mode: "stream" | "structured" = "structured",
  now = Date.now(),
): ProviderTarget[] {
  const ready: ProviderTarget[] = [];
  const demoted: ProviderTarget[] = [];
  const cooling: Array<[ProviderTarget, number]> = [];
  let extras: ProviderTarget[] = [];
  try { extras = registryView?.extras(kind, mode) ?? []; } catch { extras = []; }
  const seen = new Set(targets.map(targetKey));
  const all = [...targets, ...extras.filter((t) => !seen.has(targetKey(t)))];
  for (const t of all) {
    let verdict: RegistryVerdict = ACTIVATION_GATED.has(t.provider) ? "excluded" : "ready";
    try {
      const said = registryView?.verdict(t, kind);
      if (said) verdict = said;
    } catch { /* a view that throws says nothing: gated stays excluded, the rest ready */ }
    if (ACTIVATION_GATED.has(t.provider) && !registryView) verdict = "excluded";
    if (verdict === "excluded") continue;
    const until = cooldownUntil.get(targetKey(t)) ?? 0;
    if (until > now) { cooling.push([t, until]); continue; }
    (verdict === "demoted" ? demoted : ready).push(t);
  }
  cooling.sort((a, b) => a[1] - b[1]);
  return [...ready, ...demoted, ...cooling.map(([t]) => t)];
}

/** Try providers in order until one accepts the streaming request. */
export async function streamChatCompletionWithFallback(
  params: Omit<ProviderChatParams, "provider" | "model"> & { targets: ProviderTarget[] },
): Promise<ProviderResult<ReadableStream<Uint8Array>>> {
  if (params.targets.length === 0) throw new ProviderError(500, "No AI providers configured");

  let lastError: unknown;
  for (const [index, target] of orderTargets(params.targets, "chat", "stream").entries()) {
    const start = Date.now();
    const base = { kind: "chat", mode: "stream", provider: target.provider, model: target.model, attempt: index + 1 } as const;
    try {
      const accepted = await streamChatCompletion({ ...params, ...target });
      const ms = elapsedMs(start);
      // Accepted is not delivered. The attempt is settled when the stream
      // ends: complete with text is a success; a body that breaks, or ends
      // without a word, is a failure — recorded, and held against the target's
      // health and cooldown like any other. Bytes already sent cannot be taken
      // back, so there is no fallback after this point; the next request is
      // what benefits.
      const result = observeStream(accepted, (error) => {
        noteOutcome(target, error);
        reportAttempt({ ...base, success: !error, ms, ...(error ? { error } : {}) });
      });
      return { ...target, result };
    } catch (error) {
      const code = attemptErrorCode(error);
      noteOutcome(target, code);
      reportAttempt({ ...base, success: false, ms: elapsedMs(start), error: code });
      lastError = error;
      console.warn(`[ai-provider] ${target.provider}/${target.model} unavailable; trying fallback`);
    }
  }

  if (lastError instanceof ProviderError) throw lastError;
  throw new ProviderError(500, "All AI providers failed");
}

/**
 * The same bytes, observed. `settle` runs exactly once: with no code when the
 * stream completes having carried text (or the reader cancels it — a client
 * that leaves is not the provider's failure), with "empty_response" when it
 * completes without any, and with "stream_interrupted" when reading it throws.
 */
export function observeStream(
  stream: ReadableStream<Uint8Array>,
  settle: (error: AttemptErrorCode | undefined) => void,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let tail = "";
  let sawText = false;
  let settled = false;
  const done = (error: AttemptErrorCode | undefined) => {
    if (settled) return;
    settled = true;
    try { settle(error); } catch { /* recording never reaches the stream */ }
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        done("stream_interrupted");
        controller.error(error);
        return;
      }
      if (chunk.done) {
        done(sawText ? undefined : "empty_response");
        controller.close();
        return;
      }
      if (!sawText) {
        // A frame may split across chunks; keep a short tail so a split
        // `"content":"x` is still seen.
        const text = tail + decoder.decode(chunk.value, { stream: true });
        sawText = /"content":\s*"(?:[^"\\]|\\.)/.test(text);
        tail = text.slice(-64);
      }
      controller.enqueue(chunk.value);
    },
    cancel(reason) {
      done(undefined);
      return reader.cancel(reason);
    },
  });
}

async function streamOpenAICompatible(
  p: ProviderChatParams,
): Promise<ReadableStream<Uint8Array>> {
  const cfg = openAICompatibleConfig(p.provider);
  const key = requireKey(cfg);

  const res = await fetch(cfg.chatUrl, {
    method: "POST",
    headers: {
      ...cfg.headers,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: p.model,
      messages: [{ role: "system", content: p.system }, ...p.messages],
      ...completionBudget(p.provider, p.model, p.maxTokens ?? 2048),
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    console.error(`${cfg.label} API error:`, res.status, errText);
    throw new ProviderError(res.status || 500, `${cfg.label} request failed`);
  }

  // Body is already in the OpenAI SSE shape — pass through.
  return res.body;
}

// ── Anthropic (Claude) ───────────────────────────────────────────────────────

async function streamAnthropic(p: ProviderChatParams): Promise<ReadableStream<Uint8Array>> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new ProviderError(500, "ANTHROPIC_API_KEY is not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: p.maxTokens ?? 2048,
      // Anthropic takes the system prompt as a top-level field, not a message.
      system: p.system,
      messages: p.messages,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    console.error("Anthropic API error:", res.status, errText);
    throw new ProviderError(res.status || 500, "Anthropic request failed");
  }

  return transformAnthropicToOpenAI(res.body);
}

/**
 * Convert an Anthropic Messages SSE stream into OpenAI-shaped SSE chunks.
 * Anthropic emits `content_block_delta` events with `delta.text`; we re-emit
 * each as an OpenAI `choices[].delta.content` chunk, then a final `[DONE]`.
 */
function transformAnthropicToOpenAI(
  src: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = src.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const evt = JSON.parse(payload);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            const chunk = { choices: [{ delta: { content: evt.delta.text } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch {
          // Partial JSON across chunk boundary — wait for the rest.
          buffer = line + "\n" + buffer;
          break;
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

// ── Structured (non-streaming) completions ──────────────────────────────────
//
// Forces the model to return an object matching `schema` via tool/function
// calling. Supports an optional image (vision). Works for OpenAI and Anthropic
// and returns the parsed object.

export interface StructuredParams {
  provider: AIProvider;
  model: string;
  system: string;
  userText: string;
  /** Optional image: a `data:<mime>;base64,…` URL or an https URL. */
  image?: string;
  /** JSON Schema for the result object. */
  schema: Record<string, unknown>;
  /** Tool/function name the model must call. */
  toolName: string;
  maxTokens?: number;
}

export async function structuredCompletion(p: StructuredParams): Promise<unknown> {
  return (await structuredCompletionDetailed(p)).result;
}

/** The structured result, plus the provider's token usage where it reports one. */
async function structuredCompletionDetailed(p: StructuredParams): Promise<{ result: unknown; usage?: AttemptUsage }> {
  if (p.provider === "anthropic") return { result: await structuredAnthropic(p) };
  if (p.provider === "gemini") {
    const { data } = await geminiStructuredCompletion({
      model: p.model,
      system: p.system,
      userText: p.userText,
      image: p.image,
      schema: p.schema,
      maxTokens: p.maxTokens,
    }).catch(asProviderError);
    return { result: data };
  }
  return structuredOpenAICompatible(p);
}

/** Try providers in order until one returns a valid structured result. */
export async function structuredCompletionWithFallback(
  params: Omit<StructuredParams, "provider" | "model"> & { targets: ProviderTarget[] },
): Promise<ProviderResult<unknown>> {
  if (params.targets.length === 0) throw new ProviderError(500, "No AI providers configured");

  const kind: AttemptKind = params.image ? "vision" : "chat";
  let lastError: unknown;
  for (const [index, target] of orderTargets(params.targets, kind, "structured").entries()) {
    const start = Date.now();
    const base = { kind, mode: "structured", provider: target.provider, model: target.model, attempt: index + 1 } as const;
    try {
      const { result, usage } = await structuredCompletionDetailed({ ...params, ...target });
      noteOutcome(target, undefined);
      reportAttempt({ ...base, success: true, ms: elapsedMs(start), ...(usage ? { usage } : {}) });
      return { ...target, result };
    } catch (error) {
      const code = attemptErrorCode(error);
      noteOutcome(target, code);
      reportAttempt({ ...base, success: false, ms: elapsedMs(start), error: code });
      lastError = error;
      console.warn(`[ai-provider] ${target.provider}/${target.model} structured request failed; trying fallback`);
    }
  }

  if (lastError instanceof ProviderError) throw lastError;
  throw new ProviderError(500, "All AI providers failed");
}

async function structuredOpenAICompatible(p: StructuredParams): Promise<{ result: unknown; usage?: AttemptUsage }> {
  const cfg = openAICompatibleConfig(p.provider);
  const key = requireKey(cfg);

  const content: Array<Record<string, unknown>> = [{ type: "text", text: p.userText }];
  if (p.image) {
    content.push({ type: "image_url", image_url: { url: p.image, detail: "high" } });
  }

  const res = await fetch(cfg.chatUrl, {
    method: "POST",
    headers: { ...cfg.headers, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: p.model,
      messages: [
        { role: "system", content: p.system },
        { role: "user", content },
      ],
      tools: [{
        type: "function",
        function: { name: p.toolName, description: "Structured result", parameters: p.schema },
      }],
      tool_choice: { type: "function", function: { name: p.toolName } },
      ...completionBudget(p.provider, p.model, p.maxTokens ?? 1500),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`${cfg.label} structured error:`, res.status, errText);
    throw new ProviderError(res.status || 500, `${cfg.label} request failed`);
  }

  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new ProviderError(500, "No structured response from AI");
  return { result: JSON.parse(args), usage: usageOf(data) };
}

async function structuredAnthropic(p: StructuredParams): Promise<unknown> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new ProviderError(500, "ANTHROPIC_API_KEY is not configured");

  const content: Array<Record<string, unknown>> = [];
  if (p.image) content.push(anthropicImageBlock(p.image));
  content.push({ type: "text", text: p.userText });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: p.maxTokens ?? 1500,
      system: p.system,
      messages: [{ role: "user", content }],
      tools: [{ name: p.toolName, description: "Structured result", input_schema: p.schema }],
      tool_choice: { type: "tool", name: p.toolName },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("Anthropic structured error:", res.status, errText);
    throw new ProviderError(res.status || 500, "Anthropic request failed");
  }

  const data = await res.json();
  const block = Array.isArray(data.content)
    ? data.content.find((b: { type?: string }) => b.type === "tool_use")
    : null;
  if (!block?.input) throw new ProviderError(500, "No structured response from AI");
  return block.input;
}

/** Build an Anthropic image content block from a data URL or https URL. */
function anthropicImageBlock(image: string): Record<string, unknown> {
  const m = image.match(/^data:(.+?);base64,(.*)$/s);
  if (m) {
    return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
  }
  return { type: "image", source: { type: "url", url: image } };
}

// ── Embeddings (for RAG / semantic search) ──────────────────────────────────
//
// Embeddings always use OpenAI's text-embedding-3-small (1536 dims) regardless
// of chat provider. This is deliberate and NOT a provider that can be swapped
// for a cheaper one in isolation: every stored vector column is `vector(1536)`,
// so a model with a different dimensionality (mistral-embed is 1024) requires a
// migration plus a re-embed of all existing content before it can be used.

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

/** Create embeddings for one or more input strings. Returns one vector each. */
export async function createEmbedding(input: string[]): Promise<number[][]> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new ProviderError(500, "OPENAI_API_KEY is not configured");
  if (input.length === 0) return [];

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("OpenAI embeddings error:", res.status, errText);
    throw new ProviderError(res.status || 500, "Embedding request failed");
  }

  const data = await res.json();
  return (data.data as Array<{ embedding: number[] }>).map((d) => d.embedding);
}
