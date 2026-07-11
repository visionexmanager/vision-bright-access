// Real Gemini API adapter for the Career Center AI layer.
//
// Sibling to aiProvider.ts (openai/anthropic) — same calling shape
// (system + userText + optional image + JSON schema → parsed object, or a
// streaming chat completion), so careerAiOrchestrator.ts can treat all three
// providers uniformly. Nothing in aiProvider.ts is touched by this file.

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "GeminiProviderError";
  }
}

export interface GeminiUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface GeminiStructuredParams {
  model: string;
  system: string;
  userText: string;
  /** Optional image: a `data:<mime>;base64,…` URL. */
  image?: string;
  /** JSON Schema for the result object (same schema passed to OpenAI tool-calling). */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

/**
 * Strip JSON-Schema keywords Gemini's `responseSchema` (an OpenAPI 3.0
 * subset) doesn't understand. Unknown fields make the request fail outright,
 * so this is defensive, not cosmetic.
 */
function sanitizeSchemaForGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForGemini);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (key === "additionalProperties" || key === "$schema" || key === "title") continue;
      out[key] = sanitizeSchemaForGemini(value);
    }
    return out;
  }
  return schema;
}

function parseDataUrl(image: string): { mimeType: string; data: string } {
  const m = image.match(/^data:(.+?);base64,(.*)$/s);
  if (m) return { mimeType: m[1], data: m[2] };
  // Not a data URL (e.g. https://...) — Gemini's generateContent needs inline
  // bytes, so callers should pass a data URL. Fall back to treating it as
  // opaque base64 to avoid a hard crash.
  return { mimeType: "image/jpeg", data: image };
}

export async function geminiStructuredCompletion(
  p: GeminiStructuredParams,
): Promise<{ data: unknown; usage: GeminiUsage }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new GeminiProviderError(500, "GEMINI_API_KEY is not configured");

  const parts: Array<Record<string, unknown>> = [{ text: p.userText }];
  if (p.image) {
    const { mimeType, data } = parseDataUrl(p.image);
    parts.push({ inlineData: { mimeType, data } });
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${p.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: sanitizeSchemaForGemini(p.schema),
          maxOutputTokens: p.maxTokens ?? 2048,
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("Gemini structured error:", res.status, errText);
    throw new GeminiProviderError(res.status || 500, "Gemini request failed");
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new GeminiProviderError(500, "No structured response from Gemini");
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GeminiProviderError(500, "Gemini returned non-JSON output despite responseSchema");
  }

  const usage: GeminiUsage = {
    promptTokens: json?.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: json?.usageMetadata?.candidatesTokenCount ?? 0,
  };

  return { data, usage };
}

export interface GeminiChatParams {
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

/** Streams a chat completion from Gemini, re-shaped into OpenAI-compatible SSE. */
export async function geminiStreamChatCompletion(
  p: GeminiChatParams,
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new GeminiProviderError(500, "GEMINI_API_KEY is not configured");

  const contents = p.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${p.model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.system }] },
        contents,
        generationConfig: { maxOutputTokens: p.maxTokens ?? 2048 },
      }),
    },
  );

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    console.error("Gemini stream error:", res.status, errText);
    throw new GeminiProviderError(res.status || 500, "Gemini request failed");
  }

  return transformGeminiToOpenAI(res.body);
}

function transformGeminiToOpenAI(
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
        if (!payload) continue;

        try {
          const evt = JSON.parse(payload);
          const text = evt?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text === "string" && text.length > 0) {
            const chunk = { choices: [{ delta: { content: text } }] };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch {
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
