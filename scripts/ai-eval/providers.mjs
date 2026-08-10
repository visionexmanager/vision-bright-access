// Node-side provider clients for the eval harness.
//
// This deliberately re-implements the minimal request shape rather than
// importing supabase/functions/_shared/aiProvider.ts: that module is Deno and
// cannot be loaded from Node. The endpoints and request bodies are kept
// identical to the edge layer, and src/test/ai-eval-scoring.test.ts asserts the
// endpoints here still match the ones the edge layer uses, so the two cannot
// drift apart silently.
//
// Keys are read from the environment and never logged, echoed, or written to
// the results file.

/** Cheap tier per provider — the tier a high-volume routed task would use. */
export const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  groq: "llama-3.1-8b-instant",
  mistral: "mistral-small-latest",
  // Known dead — returns 404 "no longer available to new users". Kept so an
  // explicit `--providers gemini` still resolves to a model; replace it with an
  // id proven by a real generation before trusting any gemini row again.
  gemini: "gemini-2.5-flash",
};

export const OPENAI_COMPATIBLE = {
  openai: { envKey: "OPENAI_API_KEY", url: "https://api.openai.com/v1/chat/completions" },
  groq: { envKey: "GROQ_API_KEY", url: "https://api.groq.com/openai/v1/chat/completions" },
  mistral: { envKey: "MISTRAL_API_KEY", url: "https://api.mistral.ai/v1/chat/completions" },
};

export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Providers a bare run compares. Gemini is deliberately absent: the account has
// no credit, so every call it makes is guaranteed to fail. A full gemini run on
// 2026-08-10 scored 0% with 18/18 errors — six HTTP 404 "gemini-2.5-flash is no
// longer available to new users" (a dead model id, a separate fault from the
// billing one), then twelve HTTP 429 once the empty balance surfaced. Leaving it
// in the default set buries the real comparison under an all-zero row. It stays
// selectable with `--providers gemini` for whoever re-funds the account.
export const ALL_PROVIDERS = ["openai", "groq", "mistral"];

export function envKeyFor(provider) {
  return provider === "gemini" ? "GEMINI_API_KEY" : OPENAI_COMPATIBLE[provider]?.envKey;
}

/** Providers whose key is present. Anything else is skipped, not failed. */
export function availableProviders(env, requested = ALL_PROVIDERS) {
  return requested.filter((p) => {
    const key = envKeyFor(p);
    return Boolean(key && env[key]);
  });
}

/**
 * Gemini's responseSchema is an OpenAPI 3.0 subset: unknown keywords make the
 * whole request fail. Mirrors sanitizeSchemaForGemini() in geminiProvider.ts.
 */
function sanitizeSchemaForGemini(schema) {
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForGemini);
  if (schema && typeof schema === "object") {
    const out = {};
    for (const [key, value] of Object.entries(schema)) {
      if (key === "additionalProperties" || key === "$schema" || key === "title") continue;
      out[key] = sanitizeSchemaForGemini(value);
    }
    return out;
  }
  return schema;
}

async function callOpenAICompatible({ provider, model, system, userText, schema, toolName, maxTokens, env, fetchImpl }) {
  const cfg = OPENAI_COMPATIBLE[provider];
  const res = await fetchImpl(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env[cfg.envKey]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
      tools: [{ type: "function", function: { name: toolName, description: "Structured result", parameters: schema } }],
      tool_choice: { type: "function", function: { name: toolName } },
      max_tokens: maxTokens ?? 400,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("no tool call in response");

  return {
    output: JSON.parse(args),
    usage: data.usage
      ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 }
      : null,
  };
}

async function callGemini({ model, system, userText, schema, maxTokens, env, fetchImpl }) {
  // Key goes in the header, not the query string: URLs end up in proxy and
  // request logs.
  const res = await fetchImpl(`${GEMINI_API_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: sanitizeSchemaForGemini(schema),
        maxOutputTokens: maxTokens ?? 400,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("no text part in response");

  return {
    output: JSON.parse(text),
    usage: {
      promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

/**
 * Model names from a list response, in either shape: OpenAI-style `data[].id`
 * or Gemini-style `models[].name` (which arrives prefixed with `models/`).
 *
 * Lives here rather than in list-models.mjs so tests can import it without
 * executing a CLI — importing a module that self-executes would fire real
 * network calls the moment a key is present in the environment.
 */
export function extractModelNames(payload) {
  if (Array.isArray(payload?.data)) return payload.data.map((m) => m.id).filter(Boolean);
  if (Array.isArray(payload?.models)) {
    return payload.models.map((m) => String(m.name ?? "").replace(/^models\//, "")).filter(Boolean);
  }
  return [];
}

/** Run one structured completion. Throws on any upstream or parse failure. */
export function structuredCompletion(params) {
  const fetchImpl = params.fetchImpl ?? globalThis.fetch;
  const model = params.model ?? DEFAULT_MODELS[params.provider];
  const args = { ...params, model, fetchImpl };
  return params.provider === "gemini" ? callGemini(args) : callOpenAICompatible(args);
}
