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

/** Try providers in order until one accepts the streaming request. */
export async function streamChatCompletionWithFallback(
  params: Omit<ProviderChatParams, "provider" | "model"> & { targets: ProviderTarget[] },
): Promise<ProviderResult<ReadableStream<Uint8Array>>> {
  if (params.targets.length === 0) throw new ProviderError(500, "No AI providers configured");

  let lastError: unknown;
  for (const target of params.targets) {
    try {
      const result = await streamChatCompletion({ ...params, ...target });
      return { ...target, result };
    } catch (error) {
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
      max_tokens: p.maxTokens ?? 2048,
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
  if (p.provider === "anthropic") return structuredAnthropic(p);
  if (p.provider === "gemini") {
    const { data } = await geminiStructuredCompletion({
      model: p.model,
      system: p.system,
      userText: p.userText,
      image: p.image,
      schema: p.schema,
      maxTokens: p.maxTokens,
    }).catch(asProviderError);
    return data;
  }
  return structuredOpenAICompatible(p);
}

/** Try providers in order until one returns a valid structured result. */
export async function structuredCompletionWithFallback(
  params: Omit<StructuredParams, "provider" | "model"> & { targets: ProviderTarget[] },
): Promise<ProviderResult<unknown>> {
  if (params.targets.length === 0) throw new ProviderError(500, "No AI providers configured");

  let lastError: unknown;
  for (const target of params.targets) {
    try {
      const result = await structuredCompletion({ ...params, ...target });
      return { ...target, result };
    } catch (error) {
      lastError = error;
      console.warn(`[ai-provider] ${target.provider}/${target.model} structured request failed; trying fallback`);
    }
  }

  if (lastError instanceof ProviderError) throw lastError;
  throw new ProviderError(500, "All AI providers failed");
}

async function structuredOpenAICompatible(p: StructuredParams): Promise<unknown> {
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
      max_tokens: p.maxTokens ?? 1500,
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
  return JSON.parse(args);
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
