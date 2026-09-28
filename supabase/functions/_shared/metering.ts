// Per-model usage and provider cost — the decisions, with no I/O.
//
//   provider response → normalized usage → price book row → provider cost
//
// Every AI call reports what it used in one shape (`NormalizedUsage`), and one
// function (`costOf`) turns that into US dollars from a row of `ai_price_book`.
// No price lives in an Edge Function; a function reports provider + model +
// usage, and the price book does the rest.
//
// This is SHADOW metering: it measures what each call cost the provider. It
// charges nobody. Converting a cost into VX, reserving and settling, is a later
// layer (vx_usage_ledger + _shared/vx/meter.ts) and a commercial decision.
//
// Three rules keep the numbers honest:
//   * a count the provider did not send is absent, never a zero;
//   * usage is "reported" (the provider's own counts), "estimated" (derived by
//     us, and said so) or "missing" — the cost is never silently guessed;
//   * a price the book does not have is "unpriced", never a default rate.
//
// Pure: the database and the clock are the caller's (usageMeter.ts).

import type { StreamUsageSeen } from "./streamUsage.ts";

export type UsageSource = "reported" | "estimated" | "missing";

export type MeteredOperation =
  | "chat" | "structured" | "stream" | "embedding" | "image" | "tts" | "stt" | "realtime" | "moderation";

/**
 * What one provider call used. Token fields match `AttemptUsage` in
 * aiProvider.ts. `output_tokens` already includes reasoning tokens (OpenAI
 * counts them inside completion_tokens; `geminiUsage` adds Gemini's thoughts
 * in) — `reasoning_tokens` is a breakdown, never billed on top.
 */
export interface NormalizedUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  total_tokens?: number;
  /** The part of input_tokens that is image, for models that price it apart (gpt-image). */
  image_input_tokens?: number;
  /** Characters of text sent, for per-character pricing (TTS). */
  characters?: number;
  /** Seconds of audio, for per-minute and per-hour pricing (transcription). */
  seconds?: number;
  /** Images produced, for per-image pricing. */
  images?: number;
}

/** One provider call, as a function reports it. Counts and ids only — never content. */
export interface UsageEvent {
  operation: MeteredOperation;
  provider: string;
  /** The model id the caller asked for. */
  model: string;
  /** The concrete model the provider says answered, when it says (`model`, `modelVersion`). */
  resolved_model?: string;
  /** Groups the attempts of one fallback chain. */
  chain_id?: string;
  /** 1 for a chain's first target, 2 for the first fallback, … */
  attempt?: number;
  outcome: "ok" | "error";
  error_code?: string;
  usage?: NormalizedUsage;
  usage_source: UsageSource;
}

export const PRICE_UNITS = [
  "usd_per_1m_tokens", "usd_per_1m_characters", "usd_per_minute", "usd_per_hour", "usd_per_image", "free",
] as const;
export type PriceUnit = typeof PRICE_UNITS[number];

/** A row of `ai_price_book`. Rates: `input`/`cached_input`/`output` per 1M tokens, or `price` per unit. */
export interface PriceRow {
  id: number;
  provider: string;
  model_id: string;
  unit: PriceUnit;
  rates: Record<string, unknown>;
  effective_from: string;
  effective_to: string | null;
}

export type CostResult =
  | { status: "priced"; cost_usd: number; price_id: number }
  | { status: "free"; cost_usd: 0; price_id: number }
  | { status: "unpriced"; reason: string; price_id?: number }
  | { status: "no_usage"; price_id?: number };

const count = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

const rate = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

/** Nine decimals: a one-token call to a cheap model is a few nano-dollars, not zero. */
const usd = (v: number) => Math.round(v * 1e9) / 1e9;

/** A usage with no count in it is no usage at all. */
export function hasUsage(u: NormalizedUsage | undefined): u is NormalizedUsage {
  return !!u && Object.values(u).some((v) => typeof v === "number");
}

/**
 * The price row in force for this call, at `at`: the concrete model the
 * provider named first, then the id the caller asked for. An alias such as
 * `gemini-flash-lite-latest` is priced only once someone has entered the
 * concrete model it resolved to — never by guessing what the alias means.
 */
export function priceFor(
  rows: readonly PriceRow[],
  provider: string,
  model: string,
  resolvedModel: string | undefined,
  at: string,
): PriceRow | null {
  const t = Date.parse(at);
  const inForce = (r: PriceRow) =>
    r.provider === provider &&
    Date.parse(r.effective_from) <= t &&
    (r.effective_to === null || Date.parse(r.effective_to) > t);
  for (const id of resolvedModel && resolvedModel !== model ? [resolvedModel, model] : [model]) {
    const row = rows.find((r) => r.model_id === id && inForce(r));
    if (row) return row;
  }
  return null;
}

/** What `usage` cost at `row`'s rates. Never a default rate, never an invented count. */
export function costOf(usage: NormalizedUsage | undefined, row: PriceRow | null): CostResult {
  if (!row) return { status: "unpriced", reason: "no price in the book" };
  if (row.unit === "free") return { status: "free", cost_usd: 0, price_id: row.id };
  if (!hasUsage(usage)) return { status: "no_usage", price_id: row.id };
  const r = row.rates;

  if (row.unit === "usd_per_1m_tokens") {
    const input = count(usage.input_tokens) ?? 0;
    // Image input tokens are part of input_tokens and, where a model prices
    // them apart (gpt-image), billed at their own rate; the rest is text.
    const imageIn = Math.min(count(usage.image_input_tokens) ?? 0, input);
    const textIn = input - imageIn;
    const cached = Math.min(count(usage.cached_input_tokens) ?? 0, textIn);
    const output = count(usage.output_tokens) ?? 0;
    if (usage.input_tokens === undefined && usage.output_tokens === undefined) {
      return { status: "unpriced", reason: "usage has no token counts", price_id: row.id };
    }
    const inRate = rate(r.input);
    const outRate = rate(r.output);
    const cachedRate = rate(r.cached_input) ?? inRate;
    const imageRate = rate(r.image_input);
    if (textIn > 0 && inRate === undefined) return { status: "unpriced", reason: "no input rate", price_id: row.id };
    if (imageIn > 0 && imageRate === undefined) return { status: "unpriced", reason: "no image input rate", price_id: row.id };
    if (output > 0 && outRate === undefined) return { status: "unpriced", reason: "no output rate", price_id: row.id };
    const cost = ((textIn - cached) * (inRate ?? 0) + cached * (cachedRate ?? 0) + imageIn * (imageRate ?? 0) +
      output * (outRate ?? 0)) / 1e6;
    return { status: "priced", cost_usd: usd(cost), price_id: row.id };
  }

  const price = rate(r.price);
  if (price === undefined) return { status: "unpriced", reason: "no price", price_id: row.id };
  const quantity = {
    usd_per_1m_characters: usage.characters === undefined ? undefined : usage.characters / 1e6,
    usd_per_minute: usage.seconds === undefined ? undefined : usage.seconds / 60,
    usd_per_hour: usage.seconds === undefined ? undefined : usage.seconds / 3600,
    usd_per_image: usage.images,
  }[row.unit];
  if (quantity === undefined || !(quantity >= 0)) {
    return { status: "unpriced", reason: `usage has no quantity for ${row.unit}`, price_id: row.id };
  }
  return { status: "priced", cost_usd: usd(quantity * price), price_id: row.id };
}

// ── Normalizers: each provider's usage shape → NormalizedUsage ──────────────

/**
 * Gemini's `usageMetadata`. Thinking tokens are billed as output, so they are
 * added to `output_tokens` and also kept as the `reasoning_tokens` breakdown.
 */
export function geminiUsage(meta: unknown): NormalizedUsage | undefined {
  const m = meta as Record<string, unknown> | null | undefined;
  if (!m || typeof m !== "object") return undefined;
  const input = count(m.promptTokenCount);
  const cached = count(m.cachedContentTokenCount);
  const candidates = count(m.candidatesTokenCount);
  const thoughts = count(m.thoughtsTokenCount);
  const total = count(m.totalTokenCount);
  const out: NormalizedUsage = {};
  if (input !== undefined) out.input_tokens = input;
  if (cached !== undefined) out.cached_input_tokens = cached;
  if (candidates !== undefined || thoughts !== undefined) out.output_tokens = (candidates ?? 0) + (thoughts ?? 0);
  if (thoughts !== undefined) out.reasoning_tokens = thoughts;
  if (total !== undefined) out.total_tokens = total;
  return hasUsage(out) ? out : undefined;
}

/**
 * An OpenAI-compatible chat completion's `usage` (OpenAI, Groq, Mistral,
 * OpenRouter), whole or from a stream's last event. Groq's `x_groq.usage` has
 * the same shape.
 */
export function chatUsage(data: unknown): NormalizedUsage | undefined {
  const usage = (data as { usage?: Record<string, unknown> } | null)?.usage;
  if (!usage || typeof usage !== "object") return undefined;
  const prompt = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  const completion = usage.completion_tokens_details as Record<string, unknown> | undefined;
  const out: NormalizedUsage = {};
  const input = count(usage.prompt_tokens);
  const cached = count(prompt?.cached_tokens);
  const output = count(usage.completion_tokens);
  const reasoning = count(completion?.reasoning_tokens);
  const total = count(usage.total_tokens);
  if (input !== undefined) out.input_tokens = input;
  if (cached !== undefined) out.cached_input_tokens = cached;
  if (output !== undefined) out.output_tokens = output;
  if (reasoning !== undefined) out.reasoning_tokens = reasoning;
  if (total !== undefined) out.total_tokens = total;
  return hasUsage(out) ? out : undefined;
}

/**
 * An /images/generations or /images/edits response (gpt-image): its token
 * usage, the image share of the input, and how many images came back.
 */
export function imageUsage(json: unknown): NormalizedUsage | undefined {
  const j = json as { usage?: Record<string, unknown>; data?: unknown } | null;
  const u = j?.usage;
  const out: NormalizedUsage = {};
  if (u && typeof u === "object") {
    const details = u.input_tokens_details as Record<string, unknown> | undefined;
    const input = count(u.input_tokens);
    const imageIn = count(details?.image_tokens);
    const cached = count(details?.cached_tokens);
    const output = count(u.output_tokens);
    const total = count(u.total_tokens);
    if (input !== undefined) out.input_tokens = input;
    if (imageIn !== undefined) out.image_input_tokens = imageIn;
    if (cached !== undefined) out.cached_input_tokens = cached;
    if (output !== undefined) out.output_tokens = output;
    if (total !== undefined) out.total_tokens = total;
  }
  if (Array.isArray(j?.data)) out.images = j.data.length;
  return hasUsage(out) ? out : undefined;
}

/**
 * An /audio/transcriptions response: the provider's own `usage` — seconds
 * (`type: "duration"`) or tokens (the gpt-4o transcribe family) — or, for
 * whisper's verbose_json, the audio `duration`.
 */
export function transcriptionUsage(json: unknown): NormalizedUsage | undefined {
  const j = json as { usage?: Record<string, unknown>; duration?: unknown } | null;
  const u = j?.usage;
  const out: NormalizedUsage = {};
  if (u && typeof u === "object") {
    if (u.type === "duration") {
      const seconds = count(u.seconds);
      if (seconds !== undefined) out.seconds = seconds;
    } else {
      const input = count(u.input_tokens);
      const output = count(u.output_tokens);
      const total = count(u.total_tokens);
      if (input !== undefined) out.input_tokens = input;
      if (output !== undefined) out.output_tokens = output;
      if (total !== undefined) out.total_tokens = total;
    }
  }
  const duration = count(j?.duration);
  if (out.seconds === undefined && duration !== undefined) out.seconds = duration;
  return hasUsage(out) ? out : undefined;
}

const utf8 = new TextEncoder();
export const utf8Bytes = (s: string): number => utf8.encode(s).length;

/**
 * What an ended stream used. The provider's own counts when its last event
 * carried them. Otherwise an estimate, marked "estimated", from the bytes of
 * the prompt and of the answer that went through — so the cost of a stream
 * cut short never disappears. The estimate cannot see reasoning tokens, which
 * a reasoning model bills as output; it is a floor, not a price.
 */
export function streamUsageFrom(
  seen: StreamUsageSeen,
  promptBytes: number,
): Omit<UsageEvent, "operation" | "provider" | "model"> {
  const resolved = modelIdOf(seen.model);
  const outcome = seen.end === "done"
    ? { outcome: "ok" as const }
    : { outcome: "error" as const, error_code: seen.end === "cancelled" ? "stream_cancelled" : "stream_interrupted" };
  const model = resolved ? { resolved_model: resolved } : {};
  const reported = seen.usage ? chatUsage({ usage: seen.usage }) : undefined;
  if (reported) return { ...outcome, ...model, usage: reported, usage_source: "reported" };
  return {
    ...outcome,
    ...model,
    usage: { input_tokens: estimateTokensFromBytes(promptBytes), output_tokens: estimateTokensFromBytes(seen.outputBytes) },
    usage_source: "estimated",
  };
}

/** An OpenAI-compatible /embeddings response's `usage`. */
export function embeddingUsage(json: unknown): NormalizedUsage | undefined {
  const u = (json as { usage?: Record<string, unknown> } | null)?.usage;
  if (!u || typeof u !== "object") return undefined;
  const input = count(u.prompt_tokens);
  const total = count(u.total_tokens);
  const out: NormalizedUsage = {};
  if (input !== undefined) out.input_tokens = input;
  if (total !== undefined) out.total_tokens = total;
  return hasUsage(out) ? out : undefined;
}

/**
 * A token count estimated from UTF-8 bytes, for a call whose provider sent no
 * usage. Four bytes per token: English runs about four characters per token at
 * one byte each; Arabic about two characters per token at two bytes each — so
 * one divisor serves both scripts to within the error an estimate can promise.
 * Only ever reported with usage_source "estimated".
 */
export function estimateTokensFromBytes(bytes: number): number {
  return bytes > 0 ? Math.ceil(bytes / 4) : 0;
}

/** A model id a provider returned, if it is one. Never anything else. */
export function modelIdOf(v: unknown): string | undefined {
  return typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v) ? v : undefined;
}
