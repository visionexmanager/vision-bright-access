import { createHash } from "node:crypto";
import type { Db, Queryable } from "./db.js";
import { redact } from "./logger.js";

export interface AuditEntry {
  actorType: "ADMIN_USER" | "WHATSAPP_ADMIN" | "SYSTEM" | "ANONYMOUS";
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  result: "SUCCESS" | "FAILURE" | "DENIED" | "REQUESTED";
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

const GENESIS = "0".repeat(64);

function digest(prev: string, e: AuditEntry, metadata: unknown, at: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify([prev, at, e.actorType, e.actorId ?? null, e.action, e.targetType ?? null, e.targetId ?? null, e.result, metadata]),
    )
    .digest("hex");
}

/**
 * Append one entry. Each row's hash covers the previous row's hash, so a
 * deleted or edited row is detectable by verifyAuditChain. An advisory lock
 * serialises writers so the chain has no forks.
 */
export async function writeAudit(db: Db | Queryable, e: AuditEntry): Promise<void> {
  const run = async (q: Queryable) => {
    await q.query("SELECT pg_advisory_xact_lock(7340211)");
    const last = await q.query<{ hash: string }>("SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1");
    const prev = last.rows[0]?.hash ?? GENESIS;
    const at = new Date().toISOString();
    const metadata = redact(e.metadata ?? {});
    await q.query(
      `INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, result, metadata, ip_address, user_agent, request_id, prev_hash, hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)`,
      [
        e.actorType,
        e.actorId ?? null,
        e.action,
        e.targetType ?? null,
        e.targetId ?? null,
        e.result,
        JSON.stringify(metadata),
        e.ip ?? null,
        e.userAgent?.slice(0, 300) ?? null,
        e.requestId ?? null,
        prev,
        digest(prev, e, metadata, at),
        at,
      ],
    );
  };
  if ("tx" in db) await db.tx(run);
  else await run(db);
}

export async function verifyAuditChain(db: Db): Promise<{ ok: boolean; checked: number; brokenAt?: number }> {
  const rows = (
    await db.query<{
      id: string; actor_type: AuditEntry["actorType"]; actor_id: string | null; action: string; target_type: string | null;
      target_id: string | null; result: AuditEntry["result"]; metadata: unknown; prev_hash: string; hash: string; created_at: Date | string;
    }>("SELECT * FROM audit_logs ORDER BY id")
  ).rows;
  let prev = GENESIS;
  for (const r of rows) {
    const at = new Date(r.created_at).toISOString();
    const expect = digest(prev, { actorType: r.actor_type, actorId: r.actor_id, action: r.action, targetType: r.target_type, targetId: r.target_id, result: r.result }, r.metadata, at);
    if (r.prev_hash !== prev || r.hash !== expect) return { ok: false, checked: rows.length, brokenAt: Number(r.id) };
    prev = r.hash;
  }
  return { ok: true, checked: rows.length };
}
