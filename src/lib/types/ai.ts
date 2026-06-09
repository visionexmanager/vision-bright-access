/**
 * AI Services — TypeScript Types
 * Shared types for all AI-powered features: chat, vision, voice, OCR.
 */

// ── Generic Chat ──────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system";

export interface AIMessage {
  id: string;
  role: MessageRole;
  content: string;
}

export interface AIMessagePayload {
  role: Exclude<MessageRole, "system">;
  content: string;
}

// ── SSE Stream ────────────────────────────────────────────────────────────────

export interface SSEStreamOptions {
  url: string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  onToken: (token: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export interface SSEStreamResult {
  content: string;
  isStreaming: boolean;
  error: string | null;
  abort: () => void;
  send: (body: Record<string, unknown>) => void;
}

// ── Edge Function Registry ────────────────────────────────────────────────────

export type EdgeFunctionName =
  | "academy-chat"
  | "ai-chat"
  | "realtime-session"
  | "radar-ai"
  | "analyze-meal"
  | "generate-diet-plan"
  | "ocr-scan"
  | "enrich-product"
  | "analytics-insights"
  | "livekit-token"
  | "radio-stream-token"
  | "tv-stream-token"
  | "send-email"
  | "contact-form"
  | "trial-billing";

export type AuthMode = "anon" | "user-jwt" | "admin-jwt" | "cron-secret";

export interface EdgeCallOptions<TBody = Record<string, unknown>> {
  fn: EdgeFunctionName;
  body: TBody;
  auth: AuthMode;
  stream?: boolean;
}

// ── Radar AI (Vision) ─────────────────────────────────────────────────────────

export interface RadarAnalysis {
  overview: string;
  objects: string[];
  text_detected: string;
  people: string;
  environment: string;
  safety_notes: string;
  accessibility_tip: string;
}

export interface RadarAIRequest {
  image: string;   // base64 data URL or URL
  lang?: "en" | "ar";
}

export interface RadarAIResponse {
  analysis: RadarAnalysis;
}

// ── OCR Scan ──────────────────────────────────────────────────────────────────

export interface OCRResult {
  extracted_text: string;
  detected_language: string;
  confidence: "High" | "Medium" | "Low";
  word_count: number;
  has_handwriting: boolean;
}

export interface OCRRequest {
  image: string;
  lang?: "en" | "ar";
  hint?: string;
}

export interface OCRResponse {
  result: OCRResult;
}

// ── Meal Analysis ─────────────────────────────────────────────────────────────

export interface MealAnalysis {
  name: string;
  calories: number;
  ingredients: string[];
  tip: string;
  rating: number;
}

export interface MealAnalysisResponse {
  analysis: MealAnalysis;
}

// ── Diet Plan ─────────────────────────────────────────────────────────────────

export interface DietMeal {
  name: string;
  time: string;
  calories: number;
  ingredients: string[];
  description: string;
}

export interface DietPlan {
  meals: DietMeal[];
  totalCalories: number;
  tips: string[];
  waterIntake: string;
}

export interface DietPlanResponse {
  plan: DietPlan;
}

// ── Voice / Realtime ──────────────────────────────────────────────────────────

export type AssistantType = "visionex" | "munir" | "nutrition" | "radar" | "ocr" | "mentor";

export type VoiceStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

export interface VoiceTranscript {
  role: "user" | "assistant";
  text: string;
}

export interface RealtimeSessionResponse {
  client_secret: {
    value: string;
    expires_at: number;
  };
  session_id: string;
}
