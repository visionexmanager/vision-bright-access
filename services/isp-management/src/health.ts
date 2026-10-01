import { statfsSync } from "node:fs";
import os from "node:os";
import type { Db } from "./db.js";
import type { Providers, WhatsAppProvider } from "./providers/types.js";

export interface Health {
  healthy: boolean;
  checks: Record<string, { ok: boolean; ms?: number; note?: string }>;
}

/**
 * Detailed diagnostics. Only the authenticated /api/system route returns this;
 * the public endpoints reveal a single word.
 */
export class HealthChecker {
  private providerCache: { at: number; ok: boolean; ms: number } | null = null;
  constructor(private d: { db: Db; providers: Providers; wa: WhatsAppProvider; dataDir?: string; now?: () => number }) {}

  async liveDb(): Promise<boolean> {
    try {
      await this.d.db.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async detailed(): Promise<Health> {
    const now = this.d.now?.() ?? Date.now();
    const checks: Health["checks"] = {};

    let t = Date.now();
    checks.database = { ok: await this.liveDb(), ms: Date.now() - t };

    if (!this.providerCache || now - this.providerCache.at > 30_000) {
      t = Date.now();
      const ok = await this.d.providers.ping().catch(() => false);
      this.providerCache = { at: now, ok, ms: Date.now() - t };
    }
    checks.ispSystem = { ok: this.providerCache.ok, ms: this.providerCache.ms };
    checks.whatsapp = { ok: this.d.wa.configured(), note: this.d.wa.configured() ? undefined : "not configured" };

    try {
      const hb = (await this.d.db.query<{ beat_at: Date | string }>("SELECT beat_at FROM heartbeats WHERE component='worker'")).rows[0];
      const age = hb ? now - new Date(hb.beat_at).getTime() : Infinity;
      checks.worker = { ok: age < 3 * 60_000, note: hb ? `last beat ${Math.round(age / 1000)}s ago` : "no heartbeat" };
    } catch {
      checks.worker = { ok: false };
    }

    try {
      const s = statfsSync(this.d.dataDir ?? process.cwd());
      const freePct = (Number(s.bavail) / Number(s.blocks)) * 100;
      checks.disk = { ok: freePct > 10, note: `${freePct.toFixed(0)}% free` };
    } catch {
      checks.disk = { ok: false };
    }
    const memPct = (os.freemem() / os.totalmem()) * 100;
    checks.memory = { ok: memPct > 5, note: `${memPct.toFixed(0)}% free` };

    // WhatsApp and the worker are optional for read-only operation; the others are not.
    const healthy = checks.database!.ok && checks.disk!.ok && checks.memory!.ok;
    return { healthy, checks };
  }
}
