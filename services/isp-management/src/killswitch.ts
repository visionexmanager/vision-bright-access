import type { Flags } from "./config.js";
import type { Db } from "./db.js";
import type { ServiceAction } from "./rbac.js";

export interface KillSwitch {
  allWrites: boolean; // disables every state-changing operation
  whatsappWrites: boolean; // disables writes that originate from WhatsApp
  radiusWrites: boolean; // disables anything that reaches RADIUS
}

const OFF: KillSwitch = { allWrites: false, whatsappWrites: false, radiusWrites: false };

/**
 * The environment flags are the CEILING; the kill switch can only reduce what
 * they allow. A flag that is off in the environment cannot be turned on from
 * the UI, so a compromised admin session cannot enable a dangerous capability.
 */
export class WriteGate {
  constructor(
    private db: Db,
    private flags: Flags,
  ) {}

  async get(): Promise<KillSwitch> {
    const r = await this.db.query<{ value: Partial<KillSwitch> }>("SELECT value FROM settings WHERE key = 'killswitch'");
    return { ...OFF, ...(r.rows[0]?.value ?? {}) };
  }

  async set(next: KillSwitch, by: string): Promise<void> {
    await this.db.query(
      `INSERT INTO settings (key, value, updated_by) VALUES ('killswitch', $1::jsonb, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(next), by],
    );
  }

  /** Reason the write is blocked, or null when it may proceed. */
  async blockedReason(action: ServiceAction, source: "WEB" | "WHATSAPP"): Promise<string | null> {
    const ks = await this.get();
    if (ks.allWrites) return "All state-changing actions are disabled (kill switch).";
    if (source === "WHATSAPP" && (ks.whatsappWrites || !this.flags.whatsappWrite)) return "WhatsApp actions are disabled.";
    if (ks.radiusWrites || !this.flags.radiusWrite) return "RADIUS changes are disabled.";
    if (action === "SUSPEND" && !this.flags.suspension) return "Suspension is disabled.";
    if ((action === "ACTIVATE" || action === "RESUME") && !this.flags.activation) return "Activation is disabled.";
    if (action === "TERMINATE" && !this.flags.termination) return "Termination is disabled.";
    return null;
  }
}
