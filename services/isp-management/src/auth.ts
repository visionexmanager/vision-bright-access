import { writeAudit } from "./audit.js";
import { DUMMY_HASH, decrypt, encrypt, hashPassword, newTotpSecret, otpauthUri, randomToken, safeEqual, sha256, verifyPassword, verifyTotp } from "./crypto.js";
import type { Db } from "./db.js";
import { AppError, badRequest, tooMany, unauthorized } from "./errors.js";
import type { SecurityMonitor } from "./events.js";
import { LIMITS, type RateLimiter } from "./ratelimit.js";
import type { Role } from "./rbac.js";

export const SESSION_IDLE_MS = 30 * 60_000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60_000;
export const MAX_FAILED = 5;
export const LOCK_MS = 15 * 60_000;
export const MIN_PASSWORD = 12;

export interface SessionInfo {
  sessionId: string;
  adminId: string;
  username: string;
  displayName: string;
  role: Role;
  csrf: string;
  limited: boolean; // MFA not yet set up: only /api/auth/mfa/* and logout are allowed
}
interface AdminRow {
  id: string; username: string; display_name: string; role: Role; status: string; password_hash: string; totp_secret_enc: string | null;
  totp_enabled: boolean; totp_last_step: string | number; failed_attempts: number; locked_until: Date | string | null;
}

export function passwordProblem(p: string): string | null {
  if (p.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (p.length > 200) return "Password is too long.";
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return "Use letters and numbers.";
  return null;
}

export class Auth {
  constructor(private d: { db: Db; pepper: string; encKey: Buffer; requireMfa: boolean; limiter: RateLimiter; monitor: SecurityMonitor; now?: () => number }) {}
  private now = () => this.d.now?.() ?? Date.now();
  private hashToken = (t: string) => sha256(this.d.pepper + t);

  async createAdmin(a: { username: string; password: string; role: Exclude<Role, "WHATSAPP_ADMIN">; displayName?: string }): Promise<string> {
    const bad = passwordProblem(a.password);
    if (bad) throw badRequest(bad);
    if (!/^[A-Za-z0-9._@-]{3,64}$/.test(a.username)) throw badRequest("Invalid username.");
    const r = await this.d.db.query<{ id: string }>(
      "INSERT INTO admin_users (username, display_name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id",
      [a.username, a.displayName ?? a.username, a.role, await hashPassword(a.password)],
    );
    return r.rows[0]!.id;
  }

  async login(username: string, password: string, otp: string | undefined, ip: string, ua: string | null, requestId: string): Promise<{ token: string; session: SessionInfo }> {
    const uname = username.trim().toLowerCase();
    const ipOk = this.d.limiter.take("login-ip", ip, LIMITS.loginIp);
    const userOk = this.d.limiter.take("login-user", uname, LIMITS.loginUser);
    if (!ipOk || !userOk) {
      await this.d.monitor.record("RATE_LIMITED", "WARNING", "Login rate limit hit", { ip });
      throw tooMany();
    }
    const row = (await this.d.db.query<AdminRow>("SELECT * FROM admin_users WHERE lower(username) = $1", [uname])).rows[0];
    // Same work whether or not the account exists, so response time does not reveal it.
    const passOk = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    const fail = async (reason: string) => {
      if (row) {
        const attempts = row.failed_attempts + 1;
        await this.d.db.query("UPDATE admin_users SET failed_attempts=$2, locked_until=$3, updated_at=now() WHERE id=$1", [
          row.id, attempts >= MAX_FAILED ? 0 : attempts, attempts >= MAX_FAILED ? new Date(this.now() + LOCK_MS).toISOString() : null,
        ]);
      }
      await writeAudit(this.d.db, { actorType: "ANONYMOUS", action: "LOGIN", result: "FAILURE", metadata: { reason, username: uname.slice(0, 64) }, ip, userAgent: ua, requestId });
      await this.d.monitor.record("LOGIN_FAILED", "WARNING", "Admin login failed", { ip });
      throw unauthorized(); // identical for every cause
    };

    if (!row || row.status !== "ACTIVE" || !passOk) return fail("credentials");
    if (row.locked_until && new Date(row.locked_until).getTime() > this.now()) return fail("locked");

    let step = Number(row.totp_last_step);
    if (row.totp_enabled) {
      const secret = decrypt(row.totp_secret_enc!, this.d.encKey);
      const matched = otp ? verifyTotp(secret, otp, step, this.now()) : null;
      if (matched === null) return fail("otp");
      step = matched;
    }
    await this.d.db.query("UPDATE admin_users SET failed_attempts=0, locked_until=NULL, last_login=now(), totp_last_step=$2 WHERE id=$1", [row.id, step]);

    const token = randomToken(32);
    const csrf = randomToken(24);
    const limited = this.d.requireMfa && !row.totp_enabled;
    const s = await this.d.db.query<{ id: string }>(
      `INSERT INTO admin_sessions (admin_id, token_hash, csrf_token, expires_at, ip_address, user_agent, limited, created_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
      [row.id, this.hashToken(token), csrf, new Date(this.now() + SESSION_ABSOLUTE_MS).toISOString(), ip, ua?.slice(0, 300) ?? null, limited, new Date(this.now()).toISOString()],
    );
    await writeAudit(this.d.db, { actorType: "ADMIN_USER", actorId: row.id, action: "LOGIN", result: "SUCCESS", metadata: { mfa: row.totp_enabled }, ip, userAgent: ua, requestId });
    return { token, session: { sessionId: s.rows[0]!.id, adminId: row.id, username: row.username, displayName: row.display_name, role: row.role, csrf, limited } };
  }

  async resolve(token: string | undefined): Promise<SessionInfo | null> {
    if (!token || token.length > 100) return null;
    const t = this.now();
    type SessRow = { id: string; csrf_token: string; limited: boolean; last_seen_at: Date | string; expires_at: Date | string; revoked_at: unknown; admin_id: string; username: string; display_name: string; role: Role; status: string };
    const r = (
      await this.d.db.query<SessRow>(
        `SELECT s.id, s.csrf_token, s.limited, s.last_seen_at, s.expires_at, s.revoked_at, a.id AS admin_id, a.username, a.display_name, a.role, a.status
         FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id WHERE s.token_hash = $1`,
        [this.hashToken(token)],
      )
    ).rows[0];
    if (!r || r.revoked_at || r.status !== "ACTIVE") return null;
    if (new Date(r.expires_at).getTime() <= t || new Date(r.last_seen_at).getTime() <= t - SESSION_IDLE_MS) return null;
    await this.d.db.query("UPDATE admin_sessions SET last_seen_at = $2 WHERE id = $1", [r.id, new Date(t).toISOString()]);
    return { sessionId: r.id, adminId: r.admin_id, username: r.username, displayName: r.display_name, role: r.role, csrf: r.csrf_token, limited: r.limited };
  }

  csrfOk(session: SessionInfo, header: string | undefined): boolean {
    return !!header && safeEqual(header, session.csrf);
  }

  async logout(sessionId: string) {
    await this.d.db.query("UPDATE admin_sessions SET revoked_at = now() WHERE id = $1", [sessionId]);
  }

  async changePassword(s: SessionInfo, current: string, next: string): Promise<void> {
    const bad = passwordProblem(next);
    if (bad) throw badRequest(bad);
    const row = (await this.d.db.query<AdminRow>("SELECT * FROM admin_users WHERE id=$1", [s.adminId])).rows[0];
    if (!row || !(await verifyPassword(current, row.password_hash))) throw unauthorized();
    await this.d.db.query("UPDATE admin_users SET password_hash=$2, updated_at=now() WHERE id=$1", [s.adminId, await hashPassword(next)]);
    await this.d.db.query("UPDATE admin_sessions SET revoked_at = now() WHERE admin_id=$1 AND id <> $2 AND revoked_at IS NULL", [s.adminId, s.sessionId]);
    await writeAudit(this.d.db, { actorType: "ADMIN_USER", actorId: s.adminId, action: "PASSWORD_CHANGE", result: "SUCCESS" });
  }

  /** Begin MFA enrolment: the seed is stored encrypted and shown once. */
  async mfaBegin(s: SessionInfo): Promise<{ secret: string; uri: string }> {
    const row = (await this.d.db.query<AdminRow>("SELECT * FROM admin_users WHERE id=$1", [s.adminId])).rows[0];
    if (!row || row.totp_enabled) throw new AppError(409, "MFA_ALREADY_ENABLED", "MFA is already enabled.");
    const secret = newTotpSecret();
    await this.d.db.query("UPDATE admin_users SET totp_secret_enc=$2 WHERE id=$1", [s.adminId, encrypt(secret, this.d.encKey)]);
    return { secret, uri: otpauthUri(secret, s.username) };
  }

  async mfaConfirm(s: SessionInfo, code: string): Promise<void> {
    const row = (await this.d.db.query<AdminRow>("SELECT * FROM admin_users WHERE id=$1", [s.adminId])).rows[0];
    if (!row?.totp_secret_enc || row.totp_enabled) throw badRequest();
    if (!this.d.limiter.take("mfa-confirm", s.adminId, LIMITS.loginUser)) throw tooMany();
    const step = verifyTotp(decrypt(row.totp_secret_enc, this.d.encKey), code, Number(row.totp_last_step), this.now());
    if (step === null) throw new AppError(400, "BAD_CODE", "That code is not valid.");
    await this.d.db.query("UPDATE admin_users SET totp_enabled=true, totp_last_step=$2 WHERE id=$1", [s.adminId, step]);
    await this.d.db.query("UPDATE admin_sessions SET limited=false WHERE id=$1", [s.sessionId]);
    await writeAudit(this.d.db, { actorType: "ADMIN_USER", actorId: s.adminId, action: "MFA_ENABLED", result: "SUCCESS" });
  }

  async purgeExpired() {
    await this.d.db.query("DELETE FROM admin_sessions WHERE expires_at < now() - interval '1 day' OR revoked_at < now() - interval '1 day'");
  }
}
