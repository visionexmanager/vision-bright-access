// Input validation, prompt-injection defense, and output sanitization for
// the Career Center AI layer. Deliberately simple, deterministic checks —
// no AI-based moderation, so this never adds a second model call.

const MAX_INPUT_CHARS = 12000;

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|any|the) (previous|prior|above) instructions?/i,
  /disregard (all|any|the) (previous|prior|above) (instructions?|rules?)/i,
  /you are now/i,
  /system prompt/i,
  /reveal (your|the) (system|hidden) prompt/i,
  /act as (an? )?(unfiltered|unrestricted|jailbroken)/i,
  /\bDAN\b/, // "Do Anything Now" jailbreak framing
];

export interface InputValidationResult {
  ok: boolean;
  reason?: string;
  /** Input with obvious injection phrases neutralized, safe to embed in a prompt. */
  cleaned: string;
}

/**
 * Validates and lightly neutralizes free-text user input before it's
 * embedded in a prompt. Rejects empty/oversized input outright; injection
 * attempts are neutralized rather than rejected, since a false positive on
 * a legit "ignore my typo above" message shouldn't hard-block the request.
 */
export function validateAndCleanInput(text: string): InputValidationResult {
  const trimmed = (text ?? "").trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: "Input is empty", cleaned: "" };
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    return { ok: false, reason: `Input exceeds ${MAX_INPUT_CHARS} characters`, cleaned: "" };
  }

  let cleaned = trimmed;
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[filtered]");
  }

  return { ok: true, cleaned };
}

/**
 * Recursively strips HTML/script markup from whatever the model returned, so
 * a compromised or hallucinating response can't inject markup into the
 * frontend (defense in depth — the frontend must still escape/encode on render).
 */
export function sanitizeAiOutput<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeAiOutput(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeAiOutput(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** The mandatory response shape every /api/ai/* endpoint must return. */
export interface CareerAIStructuredResponse {
  summary: string;
  recommendations: string[];
  scores: Record<string, number>;
  insights: string[];
  next_steps: string[];
}

/** Fills in any keys missing from a model response so the contract always holds. */
export function coerceToStructuredResponse(raw: unknown): CareerAIStructuredResponse {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    summary: typeof obj.summary === "string" ? obj.summary : "",
    recommendations: Array.isArray(obj.recommendations)
      ? obj.recommendations.filter((r) => typeof r === "string")
      : [],
    scores: obj.scores && typeof obj.scores === "object" && !Array.isArray(obj.scores)
      ? Object.fromEntries(
        Object.entries(obj.scores as Record<string, unknown>).filter(
          ([, v]) => typeof v === "number",
        ),
      ) as Record<string, number>
      : {},
    insights: Array.isArray(obj.insights) ? obj.insights.filter((i) => typeof i === "string") : [],
    next_steps: Array.isArray(obj.next_steps)
      ? obj.next_steps.filter((s) => typeof s === "string")
      : [],
  };
}
