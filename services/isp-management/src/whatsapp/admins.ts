import { randomInt } from "node:crypto";
import { writeAudit } from "../audit.js";
import { decrypt, encrypt, newTotpSecret, otpauthUri, sha256, verifyTotp } from "../crypto.js";
import type { Db } from "../db.js";
import { badRequest, conflict, notFound } from "../errors.js";
import type { Role } from "../rbac.js";

export const ENROLL_TTL_MS = 30 * 60_000;
export const UNLOCK_TTL_MS = 15 * 60_000;

export interface WaAdmin {
  id: string;
  phone: string;
  name: string;
  role: Role;
  status: "PENDING" | "ACTIVE" | "DISABLED";
}
interface Row {
  id: string; phone_number: string; name: string; role: Role; status: WaAdmin["status"]; enrollment_code_hash: string | null;
  enrollment_expires_at: Date | string | null; totp_secret_enc: string | null; totp_last_step: string | number;
}
const toAdmin = (r: Row): WaAdmin => ({ id: r.id, phone: r.phone_number, name: r.name, role: r.role, status: r.status });

export const normalizePhone = (p: string) => p.replace(/[^\d]/g, "");

/**
 * WhatsApp admin identity = allowlisted number (checked against the signed
 * webhook) + a TOTP unlock. A phone number alone never authenticates anyone.
 */
export class WaAdmins {
  constructor(private d: { db: Db; encKey: Buffer; now?: () => number }) {}
  private now = () => this.d.now?.() ?? Date.now();

  /** Called from the web UI by a SUPER_ADMIN. The code and seed are returned once and never stored in clear. */
  async create(by: string, phone: string, name: string, role: Role): Promise<{ id: string; enrollmentCode: string; totpSecret: string; otpauthUri: string }> {
    const p = normalizePhone(phone);
    if (!/^\d{8,15}$/.test(p) || !name.trim() || name.length > 80) throw badRequest("Invalid phone number or name.");
    const code = String(randomInt(0, 100_000_000)).padStart(8, "0");
    const secret = newTotpSecret();
    try {
      const r = await this.d.db.query<{ id: string }>(
        `INSERT INTO whatsapp_admins (phone_number, name, role, status, enrollment_code_hash, enrollment_expires_at, totp_secret_enc, created_by)
         VALUES ($1,$2,$3,'PENDING',$4,$5,$6,$7) RETURNING id`,
        [p, name.trim(), role, sha256(code), new Date(this.now() + ENROLL_TTL_MS).toISOString(), encrypt(secret, this.d.encKey), by],
      );
      await writeAudit(this.d.db, { actorType: "ADMIN_USER", actorId: by, action: "WA_ADMIN_CREATE", targetType: "whatsapp_admin", targetId: r.rows[0]!.id, result: "SUCCESS", metadata: { role } });
      return { id: r.rows[0]!.id, enrollmentCode: code, totpSecret: secret, otpauthUri: otpauthUri(secret, name.trim(), "VisionEX ISP WhatsApp") };
    } catch (e) {
      if (String(e).includes("whatsapp_admins_phone_uq")) throw conflict("EXISTS", "That number is already registered.");
      throw e;
    }
  }

  async setStatus(by: string, id: string, status: "ACTIVE" | "DISABLED"): Promise<void> {
    const r = await this.d.db.query("UPDATE whatsapp_admins SET status=$2 WHERE id=$1 AND ($2 = 'DISABLED' OR enrollment_code_hash IS NULL)", [id, status]);
    if (!r.rowCount) throw notFound();
    await this.d.db.query("DELETE FROM wa_sessions WHERE admin_id=$1", [id]);
    await writeAudit(this.d.db, { actorType: "ADMIN_USER", actorId: by, action: "WA_ADMIN_STATUS", targetType: "whatsapp_admin", targetId: id, result: "SUCCESS", metadata: { status } });
  }

  async list() {
    return (await this.d.db.query<Row & { last_used_at: unknown; created_at: unknown }>("SELECT id, phone_number, name, role, status, last_used_at, created_at FROM whatsapp_admins ORDER BY created_at")).rows.map((r) => ({
      id: r.id, phone: r.phone_number.slice(0, 3) + "•••••" + r.phone_number.slice(-2), name: r.name, role: r.role, status: r.status, lastUsedAt: r.last_used_at, createdAt: r.created_at,
    }));
  }

  async byPhone(phone: string): Promise<WaAdmin | null> {
    const r = (await this.d.db.query<Row>("SELECT * FROM whatsapp_admins WHERE phone_number=$1", [phone])).rows[0];
    return r ? toAdmin(r) : null;
  }

  /** The sender proves control of the allowlisted number by sending the one-time code. */
  async enroll(phone: string, code: string): Promise<WaAdmin | null> {
    const r = (await this.d.db.query<Row>("SELECT * FROM whatsapp_admins WHERE phone_number=$1 AND status='PENDING'", [phone])).rows[0];
    if (!r?.enrollment_code_hash || !r.enrollment_expires_at) return null;
    if (new Date(r.enrollment_expires_at).getTime() < this.now() || r.enrollment_code_hash !== sha256(code.trim())) return null;
    await this.d.db.query("UPDATE whatsapp_admins SET status='ACTIVE', enrollment_code_hash=NULL, enrollment_expires_at=NULL WHERE id=$1", [r.id]);
    await writeAudit(this.d.db, { actorType: "WHATSAPP_ADMIN", actorId: r.id, action: "WA_ADMIN_ENROLL", targetType: "whatsapp_admin", targetId: r.id, result: "SUCCESS" });
    return toAdmin({ ...r, status: "ACTIVE" });
  }

  async unlock(admin: WaAdmin, code: string): Promise<boolean> {
    const r = (await this.d.db.query<Row>("SELECT * FROM whatsapp_admins WHERE id=$1 AND status='ACTIVE'", [admin.id])).rows[0];
    if (!r?.totp_secret_enc) return false;
    const step = verifyTotp(decrypt(r.totp_secret_enc, this.d.encKey), code, Number(r.totp_last_step), this.now());
    if (step === null) return false;
    await this.d.db.query("UPDATE whatsapp_admins SET totp_last_step=$2, last_used_at=now() WHERE id=$1", [admin.id, step]);
    await this.d.db.query(
      `INSERT INTO wa_sessions (admin_id, unlocked_until, context) VALUES ($1,$2,'{}'::jsonb)
       ON CONFLICT (admin_id) DO UPDATE SET unlocked_until=EXCLUDED.unlocked_until, context='{}'::jsonb, updated_at=now()`,
      [admin.id, new Date(this.now() + UNLOCK_TTL_MS).toISOString()],
    );
    return true;
  }

  async lock(adminId: string) {
    await this.d.db.query("DELETE FROM wa_sessions WHERE admin_id=$1", [adminId]);
  }

  /** Sliding: every accepted message extends the window, up to the idle limit. */
  async session(adminId: string): Promise<{ unlocked: boolean; context: Record<string, unknown> }> {
    const r = (await this.d.db.query<{ unlocked_until: Date | string | null; context: Record<string, unknown> }>("SELECT unlocked_until, context FROM wa_sessions WHERE admin_id=$1", [adminId])).rows[0];
    const unlocked = !!r?.unlocked_until && new Date(r.unlocked_until).getTime() > this.now();
    if (unlocked) await this.d.db.query("UPDATE wa_sessions SET unlocked_until=$2 WHERE admin_id=$1", [adminId, new Date(this.now() + UNLOCK_TTL_MS).toISOString()]);
    return { unlocked, context: unlocked ? (r?.context ?? {}) : {} };
  }

  async setContext(adminId: string, context: Record<string, unknown>) {
    await this.d.db.query("UPDATE wa_sessions SET context=$2::jsonb, updated_at=now() WHERE admin_id=$1", [adminId, JSON.stringify(context)]);
  }
}
