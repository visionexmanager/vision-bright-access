/**
 * Centralized Edge Function caller.
 *
 * ALL calls to Supabase Edge Functions go through here.
 * No more scattered fetch() calls across components.
 *
 * Features:
 *  - Typed inputs and outputs per function
 *  - Auth mode handling (anon / user-jwt / admin-jwt)
 *  - Consistent error handling
 *  - Supports both JSON and SSE (streaming) responses
 *
 * Usage:
 *   // JSON response
 *   const data = await callEdge({ fn: "analyze-meal", body: { image, lang }, auth: "user-jwt" });
 *
 *   // Streaming response (SSE) — returns raw Response for useSSEStream
 *   const response = await callEdge({ fn: "academy-chat", body, auth: "user-jwt", stream: true });
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  EdgeFunctionName,
  AuthMode,
  RadarAIResponse,
  OCRResponse,
  MealAnalysisResponse,
  DietPlanResponse,
  RealtimeSessionResponse,
  AssistantType,
  VisionAnalysisResponse,
  GeneratedPlanResponse,
  SearchResponse,
  ModerationResult,
} from "@/lib/types";

// ── Internal helpers ─────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function getAuthHeaders(mode: AuthMode): Promise<Record<string, string>> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
  };

  if (mode === "anon") {
    return { ...base, Authorization: `Bearer ${ANON_KEY}` };
  }

  if (mode === "user-jwt" || mode === "admin-jwt") {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("User not authenticated");
    return { ...base, Authorization: `Bearer ${token}` };
  }

  // cron-secret — handled server-side, not from browser
  return base;
}

function edgeUrl(fn: EdgeFunctionName): string {
  return `${BASE_URL}/functions/v1/${fn}`;
}

// ── Core call function ────────────────────────────────────────────────────────

interface CallOptions {
  fn: EdgeFunctionName;
  body: Record<string, unknown>;
  auth: AuthMode;
  stream?: boolean;
  signal?: AbortSignal;
}

/**
 * Base edge function caller.
 * Returns `Response` when `stream: true`, parsed JSON otherwise.
 */
export async function callEdge(options: CallOptions & { stream: true }): Promise<Response>;
export async function callEdge(options: CallOptions & { stream?: false }): Promise<unknown>;
export async function callEdge(options: CallOptions): Promise<unknown> {
  const { fn, body, auth, stream = false, signal } = options;

  const headers = await getAuthHeaders(auth);
  const response = await fetch(edgeUrl(fn), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (stream) {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `Edge function error: ${response.status}`);
    }
    return response;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Edge function error: ${response.status}`);
  }

  return response.json();
}

// ── Typed callers per function ────────────────────────────────────────────────

/**
 * academy-chat — SSE streaming, requires user JWT
 */
export async function callAcademyChat(
  body: { messages: Array<{ role: string; content: string }>; studentProfile: Record<string, string> },
  signal?: AbortSignal
): Promise<Response> {
  return callEdge({ fn: "academy-chat", body, auth: "user-jwt", stream: true, signal });
}

/**
 * ai-chat — SSE streaming.
 *
 * `assistantId` selects a registry-driven domain assistant (legal, medical, …).
 * Domain assistants are gated behind login, while the default Visionex
 * assistant keeps the original anon behavior.
 */
export async function callAIChat(
  body: {
    messages: Array<{ role: string; content: string }>;
    context?: Record<string, unknown>;
    assistantId?: string;
  },
  signal?: AbortSignal
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const auth: AuthMode = body.assistantId || data.session ? "user-jwt" : "anon";
  return callEdge({ fn: "ai-chat", body, auth, stream: true, signal });
}

/**
 * realtime-session — returns ephemeral OpenAI WebRTC token
 */
export async function callRealtimeSession(
  assistant: AssistantType = "visionex",
  voice?: string,
  assistantId?: string,
): Promise<RealtimeSessionResponse> {
  return callEdge({
    fn: "realtime-session",
    body: { assistant, ...(voice ? { voice } : {}), ...(assistantId ? { assistantId } : {}) },
    auth: "user-jwt",
  }) as Promise<RealtimeSessionResponse>;
}

/**
 * radar-ai — structured image analysis for blind users
 */
export async function callRadarAI(
  image: string,
  lang: "en" | "ar" = "en",
  signal?: AbortSignal
): Promise<RadarAIResponse> {
  return callEdge({
    fn: "radar-ai",
    body: { image, lang },
    auth: "anon",
    signal,
  }) as Promise<RadarAIResponse>;
}

/**
 * analyze-meal — nutrition analysis from photo
 */
export async function callAnalyzeMeal(
  image: string,
  lang: "en" | "ar" = "en",
  signal?: AbortSignal
): Promise<MealAnalysisResponse> {
  return callEdge({
    fn: "analyze-meal",
    body: { image, lang },
    auth: "anon",
    signal,
  }) as Promise<MealAnalysisResponse>;
}

/**
 * generate-diet-plan — personalized daily meal plan
 */
export async function callGenerateDietPlan(
  params: { name: string; weight: string; height: string; goal: string; lang: string },
  signal?: AbortSignal
): Promise<DietPlanResponse> {
  return callEdge({
    fn: "generate-diet-plan",
    body: params,
    auth: "anon",
    signal,
  }) as Promise<DietPlanResponse>;
}

/**
 * ocr-scan — text extraction from image
 */
export async function callOCRScan(
  image: string,
  lang: "en" | "ar" = "en",
  hint?: string,
  signal?: AbortSignal
): Promise<OCRResponse> {
  return callEdge({
    fn: "ocr-scan",
    body: { image, lang, ...(hint ? { hint } : {}) },
    auth: "user-jwt",
    signal,
  }) as Promise<OCRResponse>;
}

/**
 * analyze-image — registry-driven vision analysis (skin, hair, …).
 * Requires user JWT. Returns the universal VisionAnalysis schema.
 */
export async function callVisionAnalyst(
  analystId: string,
  image: string,
  lang: string = "en",
  signal?: AbortSignal,
): Promise<VisionAnalysisResponse> {
  return callEdge({
    fn: "analyze-image",
    body: { analystId, image, lang },
    auth: "user-jwt",
    signal,
  }) as Promise<VisionAnalysisResponse>;
}

/**
 * ai-generate — registry-driven structured generation (training plan,
 * travel itinerary, …). Requires user JWT. Returns the universal GeneratedPlan schema.
 */
export async function callGenerate(
  generatorId: string,
  params: Record<string, string>,
  lang: string = "en",
  signal?: AbortSignal,
): Promise<GeneratedPlanResponse> {
  return callEdge({
    fn: "ai-generate",
    body: { generatorId, params, lang },
    auth: "user-jwt",
    signal,
  }) as Promise<GeneratedPlanResponse>;
}

/**
 * ai-search — semantic (RAG) search over products / content. Anon-friendly.
 * `source` optionally restricts to "products" or "content_items".
 */
export async function callAISearch<T = Record<string, unknown>>(
  query: string,
  source?: string,
  limit = 8,
  signal?: AbortSignal,
): Promise<SearchResponse<T>> {
  return callEdge({
    fn: "ai-search",
    body: { query, source, limit },
    auth: "anon",
    signal,
  }) as Promise<SearchResponse<T>>;
}

/**
 * moderate-content — flag user-generated text via the moderation model.
 * Requires user JWT (called at content-creation points).
 */
export async function callModerate(text: string): Promise<ModerationResult> {
  return callEdge({
    fn: "moderate-content",
    body: { text },
    auth: "user-jwt",
  }) as Promise<ModerationResult>;
}

/**
 * embed-content — (re)build embeddings for products / content. Admin only.
 */
export async function callEmbedContent(sourceTable?: string): Promise<{ ok: boolean; embedded: Record<string, number> }> {
  return callEdge({
    fn: "embed-content",
    body: sourceTable ? { source_table: sourceTable } : {},
    auth: "admin-jwt",
  }) as Promise<{ ok: boolean; embedded: Record<string, number> }>;
}

/**
 * enrich-product — AI product data enrichment (admin use)
 */
export async function callEnrichProduct(params: {
  name: string;
  category?: string;
  store_type?: string;
  description?: string;
}): Promise<unknown> {
  return callEdge({ fn: "enrich-product", body: params, auth: "admin-jwt" });
}

/**
 * analytics-insights — AI-powered analytics (admin only)
 */
export async function callAnalyticsInsights(): Promise<unknown> {
  return callEdge({ fn: "analytics-insights", body: {}, auth: "admin-jwt" });
}

/**
 * livekit-token — generate LiveKit JWT for voice rooms
 */
export async function callLiveKitToken(params: {
  roomId: string;
  userId: string;
  userName?: string;
}): Promise<{ token: string; url: string }> {
  return callEdge({
    fn: "livekit-token",
    body: params,
    auth: "anon",
  }) as Promise<{ token: string; url: string }>;
}

/**
 * radio-stream-token — exchange short-lived token for real stream URL
 */
export async function callRadioStreamToken(token: string): Promise<{ url: string }> {
  return callEdge({
    fn: "radio-stream-token",
    body: { token },
    auth: "user-jwt",
  }) as Promise<{ url: string }>;
}

/**
 * tv-stream-token — exchange short-lived token for real stream URL
 */
export async function callTVStreamToken(token: string): Promise<{ url: string }> {
  return callEdge({
    fn: "tv-stream-token",
    body: { token },
    auth: "user-jwt",
  }) as Promise<{ url: string }>;
}

/**
 * contact-form — public contact submission
 */
export async function callContactForm(params: {
  name: string;
  email: string;
  message: string;
}): Promise<{ success: boolean }> {
  return callEdge({
    fn: "contact-form",
    body: params,
    auth: "anon",
  }) as Promise<{ success: boolean }>;
}

/**
 * send-email — bulk email via Resend (admin only)
 */
export async function callSendEmail(params: {
  to: string[];
  subject: string;
  html: string;
}): Promise<{ sent: number }> {
  return callEdge({
    fn: "send-email",
    body: params,
    auth: "admin-jwt",
  }) as Promise<{ sent: number }>;
}
