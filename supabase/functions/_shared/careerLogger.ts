// Structured logging + request tracing for Phase 11 Career Center Edge
// Functions. New functions only — nothing here is retrofitted into the
// existing career-ai-* handlers from Phase 10.

// deno-lint-ignore no-explicit-any
type SupabaseServiceClient = any;

export type LogLevel = "debug" | "info" | "warn" | "error";

export function newTraceId(): string {
  return crypto.randomUUID();
}

export interface LogFields {
  traceId: string;
  service: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, fields: LogFields, message: string): void {
  const line = JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (fields: LogFields, message: string) => emit("debug", fields, message),
  info: (fields: LogFields, message: string) => emit("info", fields, message),
  warn: (fields: LogFields, message: string) => emit("warn", fields, message),
  error: (fields: LogFields, message: string) => emit("error", fields, message),
};

/** Persists a structured error to career_error_log. Never throws — a logging failure must not break the request it's logging. */
export async function persistCareerError(
  supabase: SupabaseServiceClient,
  entry: {
    traceId: string;
    service: string;
    severity?: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    userId?: string | null;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("career_error_log").insert({
      trace_id: entry.traceId,
      service: entry.service,
      severity: entry.severity ?? "error",
      message: entry.message.slice(0, 2000),
      context: entry.context ?? {},
      user_id: entry.userId ?? null,
    });
    if (error) console.error("Failed to persist career error log:", error);
  } catch (e) {
    console.error("Failed to persist career error log:", e);
  }
}

/** Records one request's latency/status to career_request_metrics. Never throws. */
export async function recordCareerRequestMetric(
  supabase: SupabaseServiceClient,
  entry: {
    traceId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    userId?: string | null;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("career_request_metrics").insert({
      trace_id: entry.traceId,
      endpoint: entry.endpoint,
      method: entry.method,
      status_code: entry.statusCode,
      latency_ms: entry.latencyMs,
      user_id: entry.userId ?? null,
    });
    if (error) console.error("Failed to record career request metric:", error);
  } catch (e) {
    console.error("Failed to record career request metric:", e);
  }
}
