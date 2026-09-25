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

export type AIProvider = "openai" | "anthropic" | "gemini" | "groq" | "mistral";

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
}

const OPENAI_COMPATIBLE: Record<"openai" | "groq" | "mistral", OpenAICompatibleConfig> = {
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

/** The completion-budget fields a request carries, for this provider and model. */
function completionBudget(provider: AIProvider, model: string, limit: number): Record<string, unknown> {
  const reasoning = provider === "openai" && Object.prototype.hasOwnProperty.call(OPENAI_REASONING_MODELS, model)
    ? OPENAI_REASONING_MODELS[model]
    : undefined;
  return reasoning
    ? { max_completion_tokens: limit, reasoning_effort: reasoning.effort }
    : { max_tokens: limit };
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

/** The one code an attempt's error is recorded as. Reads the error's type and status, never records its text. */
export function attemptErrorCode(error: unknown): AttemptErrorCode {
  if (error instanceof ProviderError) {
    if (/ is not configured$/.test(error.message)) return "not_configured";
    if (error.message === "No structured response from AI") return "invalid_response";
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

/** Try providers in order until one accepts the streaming request. */
export async function streamChatCompletionWithFallback(
  params: Omit<ProviderChatParams, "provider" | "model"> & { targets: ProviderTarget[] },
): Promise<ProviderResult<ReadableStream<Uint8Array>>> {
  if (params.targets.length === 0) throw new ProviderError(500, "No AI providers configured");

  let lastError: unknown;
  for (const [index, target] of params.targets.entries()) {
    const start = Date.now();
    const base = { kind: "chat", mode: "stream", provider: target.provider, model: target.model, attempt: index + 1 } as const;
    try {
      const result = await streamChatCompletion({ ...params, ...target });
      reportAttempt({ ...base, success: true, ms: elapsedMs(start) });
      return { ...target, result };
    } catch (error) {
      reportAttempt({ ...base, success: false, ms: elapsedMs(start), error: attemptErrorCode(error) });
      lastError = error;
      console.warn(`[ai-provider] ${target.provider}/${target.model} unavailable; trying fallback`);
    }
  }

  if (lastError instanceof ProviderError) throw lastError;
  throw new ProviderError(500, "All AI providers failed");
}

async function streamOpenAICompatible(
  p: ProviderChatParams,
): Promise<ReadableStream<Uint8Array>> {
  const cfg = openAICompatibleConfig(p.provider);
  const key = requireKey(cfg);

  const res = await fetch(cfg.chatUrl, {
    method: "POST",
    headers: {
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
  for (const [index, target] of params.targets.entries()) {
    const start = Date.now();
    const base = { kind, mode: "structured", provider: target.provider, model: target.model, attempt: index + 1 } as const;
    try {
      const { result, usage } = await structuredCompletionDetailed({ ...params, ...target });
      reportAttempt({ ...base, success: true, ms: elapsedMs(start), ...(usage ? { usage } : {}) });
      return { ...target, result };
    } catch (error) {
      reportAttempt({ ...base, success: false, ms: elapsedMs(start), error: attemptErrorCode(error) });
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
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
