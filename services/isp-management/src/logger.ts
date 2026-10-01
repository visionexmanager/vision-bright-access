export type Level = "debug" | "info" | "warn" | "error";
export interface Logger {
  child(bindings: Record<string, unknown>): Logger;
  debug(msg: string, f?: Record<string, unknown>): void;
  info(msg: string, f?: Record<string, unknown>): void;
  warn(msg: string, f?: Record<string, unknown>): void;
  error(msg: string, f?: Record<string, unknown>): void;
}

const SENSITIVE = /pass(word)?|secret|token|cookie|authorization|api[_-]?key|csrf|totp|otp|hash|pepper/i;

/** Redacts by key name, so a secret logged by mistake never reaches the file. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1);
    return out;
  }
  if (typeof value === "string" && value.length > 500) return value.slice(0, 500) + "…";
  return value;
}

export function createLogger(
  service: string,
  sink: (line: string) => void = (l) => process.stdout.write(l + "\n"),
  bindings: Record<string, unknown> = {},
): Logger {
  const emit = (level: Level, msg: string, f?: Record<string, unknown>) =>
    sink(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service,
        level,
        msg,
        ...(redact(bindings) as object),
        ...(f ? (redact(f) as object) : {}),
      }),
    );
  return {
    child: (b) => createLogger(service, sink, { ...bindings, ...b }),
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  };
}
