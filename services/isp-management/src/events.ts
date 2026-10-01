import type { Db } from "./db.js";
import type { Logger } from "./logger.js";

export type Severity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface AlertSink {
  /** Deliver a critical alert to the owners. Must never throw. */
  alert(message: string): Promise<void>;
}

/** Events that, repeated, indicate an attack and escalate to an alert. */
const THRESHOLDS: Record<string, { count: number; windowMs: number; message: string }> = {
  LOGIN_FAILED: { count: 10, windowMs: 10 * 60_000, message: "Repeated failed admin logins" },
  WA_SIGNATURE_INVALID: { count: 3, windowMs: 10 * 60_000, message: "Invalid WhatsApp webhook signatures" },
  WA_UNKNOWN_SENDER: { count: 5, windowMs: 60 * 60_000, message: "Messages from unknown WhatsApp numbers" },
  RATE_LIMITED: { count: 30, windowMs: 10 * 60_000, message: "Excessive API calls" },
  ENUMERATION_SUSPECTED: { count: 1, windowMs: 60_000, message: "Customer enumeration suspected" },
  RADIUS_FAILED: { count: 3, windowMs: 10 * 60_000, message: "Repeated RADIUS operation failures" },
  ACTION_FAILED: { count: 3, windowMs: 10 * 60_000, message: "Repeated failed administrative actions" },
};

export class SecurityMonitor {
  private recent = new Map<string, number[]>();
  private alerted = new Map<string, number>();
  constructor(
    private db: Db,
    private log: Logger,
    private sink: AlertSink,
    private now: () => number = Date.now,
  ) {}

  async record(type: string, severity: Severity, message: string, metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.db.query("INSERT INTO system_events (event_type, severity, message, metadata) VALUES ($1,$2,$3,$4::jsonb)", [
        type,
        severity,
        message.slice(0, 500),
        JSON.stringify(metadata),
      ]);
    } catch (e) {
      this.log.error("event write failed", { type, err: String(e) });
    }
    this.log[severity === "INFO" ? "info" : severity === "WARNING" ? "warn" : "error"](message, { event: type, ...metadata });

    const rule = THRESHOLDS[type];
    const t = this.now();
    if (rule) {
      const hits = (this.recent.get(type) ?? []).filter((x) => x > t - rule.windowMs);
      hits.push(t);
      this.recent.set(type, hits);
      const last = this.alerted.get(type) ?? 0;
      if (hits.length >= rule.count && t - last > rule.windowMs) {
        this.alerted.set(type, t);
        await this.escalate(`${rule.message} (${hits.length} in ${Math.round(rule.windowMs / 60000)} min)`);
      }
    }
    if (severity === "CRITICAL") await this.escalate(message);
  }

  private async escalate(message: string) {
    try {
      await this.sink.alert(message);
    } catch (e) {
      this.log.error("alert delivery failed", { err: String(e) });
    }
  }
}
