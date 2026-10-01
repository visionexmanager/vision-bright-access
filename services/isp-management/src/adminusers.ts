import { writeAudit } from "./audit.js";
import type { Db } from "./db.js";
import { conflict, notFound } from "./errors.js";
import type { Role } from "./rbac.js";

export async function listAdminUsers(db: Db) {
  return (await db.query("SELECT id, username, display_name, role, status, totp_enabled, last_login, created_at FROM admin_users ORDER BY created_at")).rows;
}

/**
 * Role/status changes. Never on yourself, and never the last active SUPER_ADMIN,
 * so an operator cannot lock the system out of its own owner. Disabling a user
 * ends all their sessions immediately.
 */
export async function updateAdminUser(db: Db, by: string, id: string, patch: { status?: "ACTIVE" | "DISABLED"; role?: Exclude<Role, "WHATSAPP_ADMIN"> }): Promise<void> {
  if (id === by) throw conflict("SELF_CHANGE", "You cannot change your own role or status.");
  const cur = (await db.query<{ role: Role; status: string }>("SELECT role, status FROM admin_users WHERE id=$1", [id])).rows[0];
  if (!cur) throw notFound();
  const next = { role: patch.role ?? cur.role, status: patch.status ?? cur.status };
  if (cur.role === "SUPER_ADMIN" && cur.status === "ACTIVE" && (next.role !== "SUPER_ADMIN" || next.status !== "ACTIVE")) {
    const n = (await db.query<{ n: string }>("SELECT count(*)::text AS n FROM admin_users WHERE role='SUPER_ADMIN' AND status='ACTIVE'")).rows[0]!.n;
    if (Number(n) <= 1) throw conflict("LAST_SUPER_ADMIN", "At least one active SUPER_ADMIN must remain.");
  }
  await db.query("UPDATE admin_users SET role=$2, status=$3, updated_at=now() WHERE id=$1", [id, next.role, next.status]);
  if (next.status === "DISABLED") await db.query("UPDATE admin_sessions SET revoked_at=now() WHERE admin_id=$1 AND revoked_at IS NULL", [id]);
  await writeAudit(db, { actorType: "ADMIN_USER", actorId: by, action: "ADMIN_USER_UPDATE", targetType: "admin_user", targetId: id, result: "SUCCESS", metadata: { role: next.role, status: next.status } });
}
