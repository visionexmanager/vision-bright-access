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
import type { BillingConsumeResult, OperationType } from "@/lib/types/billing";

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
  body: { messages: Array<{ role: string; content: string }>; studentProfile: Record<string, string>; language?: string },
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
  userName?: string;
}): Promise<{ token: string; url: string }> {
  return callEdge({
    fn: "livekit-token",
    body: params,
    auth: "user-jwt",
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

// ── Speech Studio ─────────────────────────────────────────────────────────────

export interface SpeechGenerateRequest {
  text: string;
  voice_id: string;
  provider_voice_id: string;
  voice_name?: string;
  provider?: string;
  model?: string;
  language?: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
  output_format?: string;
  project_id?: string;
  preset_id?: string;
  preset_name?: string;
}

export interface SpeechGenerateResponse {
  ok: boolean;
  job_id: string;
  asset_id: string | null;
  audio_base64: string;
  mime_type: string;
  duration_sec: number;
  size_bytes: number;
  output_format: string;
}

/**
 * speech-generate — AI Media Studio TTS generation.
 * Requires user JWT. Returns audio as base64 JSON + job metadata.
 */
export async function callSpeechGenerate(
  body: SpeechGenerateRequest,
  signal?: AbortSignal
): Promise<SpeechGenerateResponse> {
  return callEdge({
    fn: "speech-generate",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<SpeechGenerateResponse>;
}

// ── Video Studio ──────────────────────────────────────────────────────────────

export interface VideoStudioRequest {
  action:          "generate" | "poll" | "cancel" | "delete";
  job_id?:         string;
  title?:          string;
  prompt?:         string;
  negative_prompt?: string;
  style?:          string;
  duration_sec?:   number;
  aspect_ratio?:   string;
  resolution?:     string;
  fps?:            number;
  camera_motion?:  string;
  creativity?:     number;
  seed?:           number;
  provider?:       string;
  provider_model?: string;
  project_id?:     string;
  template_id?:    string;
  audio_asset_id?: string;
  audio_mode?:     string;
}

export interface VideoStudioResponse {
  ok:              boolean;
  job_id?:         string;
  provider_job_id?: string;
  status?:         string;
  progress?:       number;
  video_url?:      string;
  storage_path?:   string;
  asset_id?:       string;
  error?:          string;
}

export async function callVideoStudio(
  body: VideoStudioRequest,
  signal?: AbortSignal
): Promise<VideoStudioResponse> {
  return callEdge({
    fn:   "video-studio",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<VideoStudioResponse>;
}

// ── Voice Studio ──────────────────────────────────────────────────────────────

export interface VoiceStudioRequest {
  action: "start_training" | "cancel_training" | "delete_profile";
  profile_id?: string;
  job_id?: string;
}

export interface VoiceStudioResponse {
  ok: boolean;
  job_id?: string;
  error?: string;
}

export async function callVoiceStudio(
  body: VoiceStudioRequest,
  signal?: AbortSignal
): Promise<VoiceStudioResponse> {
  return callEdge({
    fn: "voice-studio",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<VoiceStudioResponse>;
}

// ── Billing Engine ────────────────────────────────────────────────────────────

export interface BillingEngineRequest {
  action:           string;
  operation_type?:  OperationType;
  job_id?:          string;
  project_id?:      string;
  provider_slug?:   string;
  idempotency_key?: string;
  meta?:            Record<string, unknown>;
  plan_id?:         string;
  amount_vx?:       number;
  description?:     string;
  limit?:           number;
  offset?:          number;
  hours?:           number;
  type?:            string;
  reason?:          string;
}

export async function callBillingEngine<T = unknown>(
  body: BillingEngineRequest,
  signal?: AbortSignal
): Promise<{ ok: boolean; data?: T; error?: string } & Partial<BillingConsumeResult>> {
  return callEdge({
    fn:   "billing-engine",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<{ ok: boolean; data?: T; error?: string } & Partial<BillingConsumeResult>>;
}

// ── Provider Hub ──────────────────────────────────────────────────────────────

import type {
  ProviderHubRequest,
  ProviderHubResponse,
} from "@/lib/types/provider-hub";

export async function callProviderHub<T = unknown>(
  body: ProviderHubRequest,
  signal?: AbortSignal
): Promise<ProviderHubResponse<T>> {
  return callEdge({
    fn:   "provider-hub",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<ProviderHubResponse<T>>;
}

// ── Image Studio ──────────────────────────────────────────────────────────────

export interface ImageGenerateRequest {
  prompt:       string;
  model?:       "dall-e-3" | "dall-e-2";
  size?:        "1024x1024" | "1024x1792" | "1792x1024" | "512x512" | "256x256";
  quality?:     "standard" | "hd";
  style?:       "vivid" | "natural";
  project_id?:  string;
  preset_id?:   string;
}

export interface ImageGenerateResponse {
  ok:             boolean;
  job_id:         string;
  asset_id:       string | null;
  image_url:      string;
  revised_prompt: string;
  width:          number;
  height:         number;
  model:          string;
  size:           string;
  quality:        string;
  style:          string;
  error?:         string;
}

/**
 * image-generate — AI Media Studio DALL·E 3 image generation.
 * Reuses the existing OPENAI_API_KEY — no separate key needed.
 * Requires user JWT.
 */
export async function callImageGenerate(
  body: ImageGenerateRequest,
  signal?: AbortSignal
): Promise<ImageGenerateResponse> {
  return callEdge({
    fn:   "image-generate",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<ImageGenerateResponse>;
}

// ── Speech-to-Text ────────────────────────────────────────────────────────────

export interface SpeechTranscribeRequest {
  audio_base64:   string;
  mime_type?:     string;
  filename?:      string;
  language_hint?: string;
  project_id?:    string;
}

export interface SpeechTranscribeResponse {
  ok: boolean;
  job_id: string;
  transcript_text: string;
  detected_language: string | null;
  duration_sec: number | null;
}

export async function callSpeechTranscribe(
  body: SpeechTranscribeRequest,
  signal?: AbortSignal
): Promise<SpeechTranscribeResponse> {
  return callEdge({
    fn: "speech-transcribe",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<SpeechTranscribeResponse>;
}

// ── Document Studio ───────────────────────────────────────────────────────────

export interface DocumentGenerateRequest {
  mode: "analyze" | "summarize";
  input_text: string;
  filename?: string;
  language?: string;
  project_id?: string;
}

export interface DocumentAnalysisResult {
  summary: string;
  key_points: string[];
  action_items: string[];
  entities: string[];
  word_count: number;
}

export interface DocumentGenerateResponse {
  ok: boolean;
  job_id: string;
  result: DocumentAnalysisResult;
}

export async function callDocumentGenerate(
  body: DocumentGenerateRequest,
  signal?: AbortSignal
): Promise<DocumentGenerateResponse> {
  return callEdge({
    fn: "document-generate",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<DocumentGenerateResponse>;
}

// ── Text Tools Studio ─────────────────────────────────────────────────────────

export type TextTool = "code" | "writing" | "resume" | "presentation";

export interface TextToolsGenerateRequest {
  tool: TextTool;
  prompt: string;
  language?: string;
  project_id?: string;
  options?: Record<string, unknown>;
}

export interface FreeformToolResult {
  content: string;
  language: string;
  notes: string;
}

export interface DocumentToolResult {
  title: string;
  subtitle: string;
  sections: Array<{ heading: string; bullets: string[] }>;
}

export interface TextToolsGenerateResponse {
  ok: boolean;
  job_id: string;
  tool: TextTool;
  result: FreeformToolResult | DocumentToolResult;
}

export async function callTextToolsGenerate(
  body: TextToolsGenerateRequest,
  signal?: AbortSignal
): Promise<TextToolsGenerateResponse> {
  return callEdge({
    fn: "text-tools-generate",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<TextToolsGenerateResponse>;
}

// ── Image Studio tools (Replicate-backed) ─────────────────────────────────────

export type ImageToolMode = "img2img" | "upscale" | "bg-remove" | "restore" | "avatar";

export interface ImageToolsGenerateRequest {
  action: "generate";
  mode: ImageToolMode;
  image_url: string;
  prompt?: string;
  project_id?: string;
}

export interface ImageToolsPollRequest {
  action: "poll";
  job_id: string;
}

export interface ImageToolsGenerateResponse {
  ok: boolean;
  job_id?: string;
  status?: string;
  image_url?: string;
  asset_id?: string | null;
  error?: string;
}

export async function callImageToolsGenerate(
  body: ImageToolsGenerateRequest | ImageToolsPollRequest,
  signal?: AbortSignal
): Promise<ImageToolsGenerateResponse> {
  return callEdge({
    fn: "image-tools-generate",
    body: body as unknown as Record<string, unknown>,
    auth: "user-jwt",
    signal,
  }) as Promise<ImageToolsGenerateResponse>;
}

// ── System Health Check ───────────────────────────────────────────────────────

export interface HealthCheckComponentStatus {
  ok:     boolean;
  status: "ok" | "warning" | "error" | "missing";
  detail: string;
}

export interface HealthCheckResponse {
  ok:        boolean;
  timestamp: string;
  summary: {
    total:        number;
    passing:      number;
    errors:       number;
    warnings:     number;
    missing:      number;
    error_keys:   string[];
    warning_keys: string[];
    missing_keys: string[];
  };
  components: Record<string, HealthCheckComponentStatus>;
}

/**
 * health-check — tests all AI Media Studio infrastructure components.
 * Returns detailed status for DB tables, API keys, storage buckets, and providers.
 * No auth required.
 */
export async function callHealthCheck(): Promise<HealthCheckResponse> {
  return callEdge({
    fn:   "health-check",
    body: {},
    auth: "anon",
  }) as Promise<HealthCheckResponse>;
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
