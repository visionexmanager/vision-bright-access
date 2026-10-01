import type { Container } from "./container.js";

/** One pass of background maintenance. Idempotent; safe to run from any number of schedulers. */
export async function runWorkerOnce(c: Container): Promise<void> {
  const { db, log } = c;
  const step = async (name: string, f: () => Promise<unknown>) => {
    try {
      await f();
    } catch (e) {
      log.error("worker step failed", { step: name, err: String(e) });
      await c.monitor.record("WORKER_STEP_FAILED", "ERROR", `Worker step failed: ${name}`);
    }
  };
  await step("heartbeat", () =>
    db.query(
      "INSERT INTO heartbeats (component, beat_at, info) VALUES ('worker', now(), '{}'::jsonb) ON CONFLICT (component) DO UPDATE SET beat_at = now()",
    ),
  );
  await step("actions", () => c.actions.sweep());
  await step("sessions", () => c.auth.purgeExpired());
  await step("replay-window", () => db.query("DELETE FROM wa_inbound WHERE received_at < now() - interval '2 days'"));
  // audit_logs is never pruned here; only operational noise is.
  await step("events-retention", () => db.query("DELETE FROM system_events WHERE created_at < now() - interval '90 days'"));
  await step("health", async () => {
    const h = await c.health.detailed();
    if (!h.checks.database?.ok) await c.monitor.record("DB_DOWN", "CRITICAL", "Database health check failed");
    else if (!h.checks.ispSystem?.ok) await c.monitor.record("ISP_DOWN", "ERROR", "ISP system unreachable");
  });
}

export async function runWorkerForever(c: Container, everyMs = 30_000, signal?: AbortSignal): Promise<void> {
  while (!signal?.aborted) {
    await runWorkerOnce(c);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}
