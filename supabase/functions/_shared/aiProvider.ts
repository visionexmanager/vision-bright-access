// Unified AI provider layer for VisionEx edge functions.
//
// One entry point — streamChatCompletion() — that talks to either OpenAI or
// Anthropic and ALWAYS returns an OpenAI-shaped SSE stream
// (`data: {"choices":[{"delta":{"content":"..."}}]}\n\n` … `data: [DONE]`).
//
// This lets the entire frontend (useSSEStream / AIChat) stay unchanged while
// each assistant can be switched between providers via the registry config.

export type AIProvider = "openai" | "anthropic";

export interface ProviderChatParams {
  provider: AIProvider;
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

/** Thrown on an upstream provider error so callers can map status codes. */
export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Stream a chat completion from the configured provider.
 * Returns a ReadableStream of OpenAI-compatible SSE bytes.
 */
export async function streamChatCompletion(
  params: ProviderChatParams,
): Promise<ReadableStream<Uint8Array>> {
  if (params.provider === "anthropic") return streamAnthropic(params);
  return streamOpenAI(params);
}

// ── OpenAI ─────────────────────────────────────────────────────────────────

async function streamOpenAI(p: ProviderChatParams): Promise<ReadableStream<Uint8Array>> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new ProviderError(500, "OPENAI_API_KEY is not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
    console.error("OpenAI API error:", res.status, errText);
    throw new ProviderError(res.status || 500, "OpenAI request failed");
  }

  // OpenAI body is already in the OpenAI SSE shape — pass through.
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
  return structuredOpenAI(p);
}

async function structuredOpenAI(p: StructuredParams): Promise<unknown> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new ProviderError(500, "OPENAI_API_KEY is not configured");

  const content: Array<Record<string, unknown>> = [{ type: "text", text: p.userText }];
  if (p.image) {
    content.push({ type: "image_url", image_url: { url: p.image, detail: "high" } });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
    console.error("OpenAI structured error:", res.status, errText);
    throw new ProviderError(res.status || 500, "OpenAI request failed");
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
// Anthropic has no first-party embeddings API, so embeddings always use
// OpenAI's text-embedding-3-small (1536 dims) regardless of chat provider.

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
