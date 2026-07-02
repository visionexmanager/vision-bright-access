// Central AI orchestrator for the Career Center: provider selection,
// cost-tier model routing, fallback across OpenAI -> Anthropic -> Gemini,
// response caching (ai_response_cache), and usage/latency logging
// (ai_interactions). Every /api/ai/* Edge Function calls into this instead
// of talking to a provider directly.
//
// Reuses the existing structuredCompletion()/streamChatCompletion() from
// aiProvider.ts (openai/anthropic) unmodified, and the new geminiProvider.ts
// for Gemini, behind one uniform interface.

import { AIProvider as UpstreamProvider, structuredCompletion, streamChatCompletion } from "./aiProvider.ts";
import { geminiStreamChatCompletion, geminiStructuredCompletion } from "./geminiProvider.ts";
import {
  CareerAIStructuredResponse,
  coerceToStructuredResponse,
  sanitizeAiOutput,
} from "./careerAiSafety.ts";

// deno-lint-ignore no-explicit-any
type SupabaseServiceClient = any;

export type CareerAiProvider = UpstreamProvider | "gemini";
export type CostTier = "cheap" | "capable";

const DEFAULT_PROVIDER_ORDER: CareerAiProvider[] = ["openai", "anthropic", "gemini"];

// Model identifiers follow the conventions already used elsewhere in this
// codebase (see _shared/assistants.ts, news-generate/index.ts) for OpenAI
// and Anthropic. Gemini has no prior convention in this repo, so current
// well-known Gemini model IDs are used.
const MODEL_MATRIX: Record<CareerAiProvider, Record<CostTier, string>> = {
  openai: { cheap: "gpt-4o-mini", capable: "gpt-4.1" },
  anthropic: { cheap: "claude-haiku-4-5-20251001", capable: "claude-sonnet-4-6" },
  gemini: { cheap: "gemini-2.5-flash", capable: "gemini-2.5-pro" },
};

const DEFAULT_TIER_BY_SERVICE: Record<string, CostTier> = {
  resume: "capable",
  analyze: "cheap",
  coach: "capable",
  roadmap: "capable",
  visa: "capable",
  match: "cheap",
  salary: "cheap",
  interview: "capable",
  health_score: "cheap",
  chat: "cheap",
};

const DEFAULT_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Rough token estimate (chars/4) for providers whose response doesn't surface usage — logging-quality only, not billing-accurate. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface CareerAIRequest {
  supabase: SupabaseServiceClient;
  service: string;
  userId: string | null;
  system: string;
  userText: string;
  image?: string;
  schema: Record<string, unknown>;
  toolName: string;
  tier?: CostTier;
  maxTokens?: number;
  /** Set to 0 to disable caching for this call (e.g. highly personalized input). */
  cacheTtlSeconds?: number;
  providerOrder?: CareerAiProvider[];
}

export interface CareerAIResult {
  response: CareerAIStructuredResponse;
  meta: {
    provider: string;
    model: string;
    cached: boolean;
    degraded: boolean;
    latencyMs: number;
  };
}

async function callProvider(
  provider: CareerAiProvider,
  model: string,
  p: CareerAIRequest,
): Promise<{ data: unknown; usage: { promptTokens: number; completionTokens: number } }> {
  if (provider === "gemini") {
    return geminiStructuredCompletion({
      model,
      system: p.system,
      userText: p.userText,
      image: p.image,
      schema: p.schema,
      maxTokens: p.maxTokens,
    });
  }

  const data = await structuredCompletion({
    provider,
    model,
    system: p.system,
    userText: p.userText,
    image: p.image,
    schema: p.schema,
    toolName: p.toolName,
    maxTokens: p.maxTokens,
  });

  // structuredCompletion() (aiProvider.ts, unmodified) doesn't surface token
  // usage, so this is a best-effort estimate for observability logging only.
  return {
    data,
    usage: {
      promptTokens: estimateTokens(p.system + p.userText),
      completionTokens: estimateTokens(JSON.stringify(data)),
    },
  };
}

async function getCachedResponse(
  supabase: SupabaseServiceClient,
  cacheKey: string,
): Promise<CareerAIStructuredResponse | null> {
  const { data, error } = await supabase
    .from("ai_response_cache")
    .select("response")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return data.response as CareerAIStructuredResponse;
}

async function setCachedResponse(
  supabase: SupabaseServiceClient,
  cacheKey: string,
  service: string,
  response: unknown,
  ttlSeconds: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const { error } = await supabase
    .from("ai_response_cache")
    .upsert({ cache_key: cacheKey, service, response, expires_at: expiresAt }, { onConflict: "cache_key" });
  if (error) console.error("Failed to cache AI response:", error);
}

async function logInteraction(
  supabase: SupabaseServiceClient,
  entry: {
    userId: string | null;
    service: string;
    provider: string;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs: number;
    cacheHit: boolean;
    requestSummary?: string;
    responseSummary?: string;
  },
): Promise<void> {
  const { error } = await supabase.from("ai_interactions").insert({
    user_id: entry.userId,
    service: entry.service,
    provider: entry.provider,
    model: entry.model,
    prompt_tokens: entry.promptTokens ?? null,
    completion_tokens: entry.completionTokens ?? null,
    latency_ms: entry.latencyMs,
    cache_hit: entry.cacheHit,
    request_summary: entry.requestSummary?.slice(0, 500) ?? null,
    response_summary: entry.responseSummary?.slice(0, 500) ?? null,
  });
  if (error) console.error("Failed to log AI interaction:", error);
}

function fallbackResponse(): CareerAIStructuredResponse {
  return {
    summary: "AI is temporarily unavailable. Your request was not processed — please try again shortly.",
    recommendations: [],
    scores: {},
    insights: [],
    next_steps: ["Retry this request in a few minutes.", "If this keeps happening, contact support."],
  };
}

/**
 * Runs a structured (non-streaming) AI call for one of the 9 structured
 * Career Center services: checks cache, tries providers in fallback order,
 * sanitizes/coerces the result to the mandatory response shape, caches and
 * logs it. Never throws for a provider failure — degrades gracefully
 * instead, since callers must always return a valid structured response.
 */
export async function runStructuredCareerAI(p: CareerAIRequest): Promise<CareerAIResult> {
  const tier = p.tier ?? DEFAULT_TIER_BY_SERVICE[p.service] ?? "cheap";
  const order = p.providerOrder ?? DEFAULT_PROVIDER_ORDER;
  // Image-bearing requests are never cached: the cache key is derived from
  // system+userText only, so two different images accompanying identical
  // text would otherwise collide and serve one image's result for another.
  const cacheTtl = p.image ? 0 : (p.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS);

  const cacheKey = await sha256Hex(JSON.stringify({ service: p.service, system: p.system, userText: p.userText, toolName: p.toolName }));

  if (cacheTtl !== 0) {
    const started = Date.now();
    const cached = await getCachedResponse(p.supabase, cacheKey);
    if (cached) {
      await logInteraction(p.supabase, {
        userId: p.userId,
        service: p.service,
        provider: "cache",
        model: "cached",
        latencyMs: Date.now() - started,
        cacheHit: true,
        requestSummary: p.userText.slice(0, 300),
      });
      return { response: cached, meta: { provider: "cache", model: "cached", cached: true, degraded: false, latencyMs: Date.now() - started } };
    }
  }

  const startedAt = Date.now();
  let lastError: unknown;

  for (const provider of order) {
    const model = MODEL_MATRIX[provider][tier];
    try {
      const { data, usage } = await callProvider(provider, model, p);
      const structured = sanitizeAiOutput(coerceToStructuredResponse(data));
      const latencyMs = Date.now() - startedAt;

      if (cacheTtl !== 0) await setCachedResponse(p.supabase, cacheKey, p.service, structured, cacheTtl);

      await logInteraction(p.supabase, {
        userId: p.userId,
        service: p.service,
        provider,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        latencyMs,
        cacheHit: false,
        requestSummary: p.userText.slice(0, 300),
        responseSummary: structured.summary.slice(0, 300),
      });

      return { response: structured, meta: { provider, model, cached: false, degraded: false, latencyMs } };
    } catch (err) {
      lastError = err;
      console.error(`Career AI: provider ${provider} failed for service ${p.service}, trying next`, err);
    }
  }

  const latencyMs = Date.now() - startedAt;
  await logInteraction(p.supabase, {
    userId: p.userId,
    service: p.service,
    provider: "none",
    model: "none",
    latencyMs,
    cacheHit: false,
    requestSummary: p.userText.slice(0, 300),
    responseSummary: `all providers failed: ${String(lastError)}`.slice(0, 300),
  });

  return { response: fallbackResponse(), meta: { provider: "none", model: "none", cached: false, degraded: true, latencyMs } };
}

export class CareerAIAllProvidersFailedError extends Error {
  constructor(cause: string) {
    super(`All AI providers failed: ${cause}`);
    this.name = "CareerAIAllProvidersFailedError";
  }
}

export interface CareerAIChatRequest {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tier?: CostTier;
  maxTokens?: number;
  providerOrder?: CareerAiProvider[];
}

/**
 * Establishes a streaming chat completion, trying providers in fallback
 * order until one successfully opens a stream. Once a stream is returned to
 * the caller, no further fallback happens (bytes may already be in flight).
 */
export async function runCareerAIChatStream(
  p: CareerAIChatRequest,
): Promise<{ stream: ReadableStream<Uint8Array>; provider: CareerAiProvider; model: string }> {
  const tier = p.tier ?? DEFAULT_TIER_BY_SERVICE.chat;
  const order = p.providerOrder ?? DEFAULT_PROVIDER_ORDER;
  let lastError: unknown;

  for (const provider of order) {
    const model = MODEL_MATRIX[provider][tier];
    try {
      const stream = provider === "gemini"
        ? await geminiStreamChatCompletion({ model, system: p.system, messages: p.messages, maxTokens: p.maxTokens })
        : await streamChatCompletion({ provider, model, system: p.system, messages: p.messages, maxTokens: p.maxTokens });
      return { stream, provider, model };
    } catch (err) {
      lastError = err;
      console.error(`Career AI chat: provider ${provider} failed, trying next`, err);
    }
  }

  throw new CareerAIAllProvidersFailedError(String(lastError));
}
