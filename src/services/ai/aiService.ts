/**
 * AI SERVICE LAYER — Unified gateway for all AI operations on VisionEx.
 *
 * RULE: All AI calls across the platform MUST go through this service.
 * No component or hook may call edge functions / fetch AI endpoints directly.
 *
 * Delegates to edgeFunctions.ts for transport; this layer adds:
 *  - Semantic, intent-based API (streamChat vs rawEdgeCall)
 *  - Consistent typing for every use case
 *  - Single import point: `import { aiService } from "@/services/ai/aiService"`
 */

import {
  callAIChat,
  callAcademyChat,
  callRadarAI,
  callAnalyzeMeal,
  callGenerateDietPlan,
  callOCRScan,
  callRealtimeSession,
  callVisionAnalyst,
  callGenerate,
  callAISearch,
  callModerate,
} from "@/lib/api/edgeFunctions";

import type {
  AssistantType,
  RadarAIResponse,
  MealAnalysisResponse,
  DietPlanResponse,
  OCRResponse,
  RealtimeSessionResponse,
  VisionAnalysisResponse,
  GeneratedPlanResponse,
  SearchResponse,
  ModerationResult,
} from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatContext {
  currentPage?: string;
  language?: string;
  productName?: string;
  currentStep?: string;
  shopContext?: string;
  /** Selects a registry-driven domain assistant (e.g. "legal-advisor"). */
  assistantId?: string;
}

// ── General Chat (ai-chat edge function) ─────────────────────────────────────

/**
 * Stream a general AI chat response.
 * Returns a raw Response for SSE consumption via useSSEStream.consumeStream().
 *
 * Used by: AIChat widget, SimulationMentor, VXBazaar seller chat, any page chat.
 */
async function streamChat(
  messages: ChatMessage[],
  context?: ChatContext,
  signal?: AbortSignal
): Promise<Response> {
  return callAIChat(
    {
      messages: messages.map(({ role, content }) => ({ role, content })),
      context: context as Record<string, unknown>,
      assistantId: context?.assistantId,
    },
    signal
  );
}

// ── Academy Chat (academy-chat edge function) ─────────────────────────────────

/**
 * Stream a Munir (Academy AI tutor) response.
 * Returns raw Response for SSE. Requires user JWT.
 *
 * Used by: Academy.tsx, CareerAptitudeTest.tsx, useAcademyChat.ts
 */
async function streamAcademyChat(
  messages: ChatMessage[],
  studentProfile: Record<string, string>,
  signal?: AbortSignal
): Promise<Response> {
  return callAcademyChat(
    {
      messages: messages.map(({ role, content }) => ({ role, content })),
      studentProfile,
    },
    signal
  );
}

// ── Vision AI ─────────────────────────────────────────────────────────────────

/**
 * Analyze an image for scene description (Radar AI for blind users).
 * Used by: RadarAI.tsx service page.
 */
async function analyzeImage(
  image: string,
  lang: "en" | "ar" = "ar",
  signal?: AbortSignal
): Promise<RadarAIResponse> {
  return callRadarAI(image, lang, signal);
}

/**
 * Analyze a meal photo for nutrition info.
 * Used by: NutritionExpert.tsx
 */
async function analyzeMeal(
  image: string,
  lang: "en" | "ar" = "ar",
  signal?: AbortSignal
): Promise<MealAnalysisResponse> {
  return callAnalyzeMeal(image, lang, signal);
}

/**
 * Generate a personalized diet plan.
 * Used by: NutritionExpert.tsx
 */
async function generateDietPlan(
  params: { name: string; weight: string; height: string; goal: string; lang: string },
  signal?: AbortSignal
): Promise<DietPlanResponse> {
  return callGenerateDietPlan(params, signal);
}

// ── OCR ───────────────────────────────────────────────────────────────────────

/**
 * Extract text from an image (OCR).
 * Used by: OCRScan.tsx service page. Requires user JWT.
 */
async function ocrScan(
  image: string,
  lang: "en" | "ar" = "ar",
  hint?: string,
  signal?: AbortSignal
): Promise<OCRResponse> {
  return callOCRScan(image, lang, hint, signal);
}

// ── Vision Analysts (analyze-image edge function) ──────────────────────────────

/**
 * Analyze an image with a registry-driven analyst (e.g. "skin-care", "hair-care").
 * Returns the universal VisionAnalysis schema. Requires user JWT.
 */
async function analyzeWithAnalyst(
  analystId: string,
  image: string,
  lang: string = "ar",
  signal?: AbortSignal,
): Promise<VisionAnalysisResponse> {
  return callVisionAnalyst(analystId, image, lang, signal);
}

// ── Structured Generators (ai-generate edge function) ──────────────────────────

/**
 * Generate a structured plan with a registry-driven generator
 * (e.g. "training-plan", "travel-itinerary"). Requires user JWT.
 */
async function generatePlan(
  generatorId: string,
  params: Record<string, string>,
  lang: string = "ar",
  signal?: AbortSignal,
): Promise<GeneratedPlanResponse> {
  return callGenerate(generatorId, params, lang, signal);
}

// ── Summarization (ai-generate edge function, "content-summary") ───────────────

/** Summarize text into the universal GeneratedPlan structure. Requires user JWT. */
async function summarizeText(
  text: string,
  lang: string = "ar",
  signal?: AbortSignal,
): Promise<GeneratedPlanResponse> {
  return callGenerate("content-summary", { text }, lang, signal);
}

// ── Semantic Search (ai-search edge function) ──────────────────────────────────

/**
 * Semantic search over products / content via embeddings.
 * `source` optionally restricts to "products" or "content_items".
 */
async function search<T = Record<string, unknown>>(
  query: string,
  source?: string,
  limit = 8,
  signal?: AbortSignal,
): Promise<SearchResponse<T>> {
  return callAISearch<T>(query, source, limit, signal);
}

// ── Moderation (moderate-content edge function) ────────────────────────────────

/** Flag user-generated text. Returns { flagged, categories }. Requires user JWT. */
async function moderate(text: string): Promise<ModerationResult> {
  return callModerate(text);
}

// ── Voice / Realtime ──────────────────────────────────────────────────────────

/**
 * Get an ephemeral OpenAI Realtime session token for WebRTC voice.
 * Used by: useVoiceChat.ts. Requires user JWT.
 */
async function getRealtimeSession(
  assistant: AssistantType = "visionex",
  voice?: string,
  assistantId?: string,
): Promise<RealtimeSessionResponse> {
  return callRealtimeSession(assistant, voice, assistantId);
}

// ── Exported service object ───────────────────────────────────────────────────

export const aiService = {
  streamChat,
  streamAcademyChat,
  analyzeImage,
  analyzeMeal,
  generateDietPlan,
  ocrScan,
  getRealtimeSession,
  analyzeWithAnalyst,
  generatePlan,
  search,
  moderate,
  summarizeText,
} as const;
