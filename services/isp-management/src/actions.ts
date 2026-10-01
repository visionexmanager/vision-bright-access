import { writeAudit } from "./audit.js";
import type { Db } from "./db.js";
import { AppError, NotSupportedError, badRequest, conflict, forbidden, notFound } from "./errors.js";
import type { SecurityMonitor } from "./events.js";
import type { WriteGate } from "./killswitch.js";
import type { Logger } from "./logger.js";
import type { Providers, Status } from "./providers/types.js";
import { LIMITS, type RateLimiter } from "./ratelimit.js";
import { ACTION_PERMISSION, can, type Role, type ServiceAction } from "./rbac.js";

export interface Actor {
  type: "ADMIN_USER" | "WHATSAPP_ADMIN";
  id: string;
  role: Role;
  label: string;
}
export interface Ctx {
  source: "WEB" | "WHATSAPP";
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export const CONFIRM_TTL_MS = 2 * 60_000;
export const CUSTOMER_ID_RE = /^[A-Za-z0-9._@-]{1,64}$/;

const EXPECTED: Record<ServiceAction, Status> = { SUSPEND: "SUSPENDED", RESUME: "ACTIVE", ACTIVATE: "ACTIVE", TERMINATE: "TERMINATED" };
const ALLOWED_FROM: Record<ServiceAction, Status[]> = {
  SUSPEND: ["ACTIVE"],
  RESUME: ["SUSPENDED"],
  ACTIVATE: ["SUSPENDED", "EXPIRED"],
  TERMINATE: ["ACTIVE", "SUSPENDED", "EXPIRED"],
};

export interface PendingView {
  id: string;
  action: ServiceAction;
  customer: { externalId: string; username: string; fullName?: string };
  currentStatus: Status;
  resultingStatus: Status;
  expiresAt: string;
  state: "PENDING" | "EXECUTING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
}
export interface ResultView {
  id: string;
  state: PendingView["state"];
  ok: boolean;
  replayed: boolean;
  message: string;
  errorCode?: string;
}

interface Row {
  id: string; idempotency_key: string; actor_type: Actor["type"]; actor_id: string; source: "WEB" | "WHATSAPP";
  action: ServiceAction; customer_external_id: string; params: { username: string; fullName?: string };
  state_snapshot: { status: Status }; status: PendingView["state"]; expires_at: Date | string;
  result: { message: string } | null; error_code: string | null;
}

const SAFE_ERRORS: Record<string, string> = {
  ACTIONS_DISABLED: "That action is currently disabled.",
  STATE_CHANGED: "The customer's state changed since the request. Nothing was done; start again.",
  NOT_SUPPORTED: "This operation is not available on the connected ISP system.",
  UPSTREAM_ERROR: "The ISP system did not accept the change. Nothing was reported as done.",
  VERIFICATION_FAILED: "The change was sent but the ISP system does not show it. Check the customer manually.",
  FORBIDDEN: "You are not allowed to do that.",
  INTERRUPTED: "The action was interrupted. Check the customer manually.",
};

export class ActionService {
  constructor(
    private d: { db: Db; providers: Providers; gate: WriteGate; monitor: SecurityMonitor; limiter: RateLimiter; log: Logger; now?: () => number },
  ) {}
  private now = () => this.d.now?.() ?? Date.now();

  private toPending(r: Row): PendingView {
    return {
      id: r.id,
      action: r.action,
      customer: { externalId: r.customer_external_id, username: r.params.username, fullName: r.params.fullName },
      currentStatus: r.state_snapshot.status,
      resultingStatus: EXPECTED[r.action],
      expiresAt: new Date(r.expires_at).toISOString(),
      state: r.status,
    };
  }

  private audit(actor: Actor, ctx: Ctx, action: ServiceAction, customerId: string, result: "SUCCESS" | "FAILURE" | "DENIED" | "REQUESTED", metadata: Record<string, unknown> = {}) {
    return writeAudit(this.d.db, {
      actorType: actor.type, actorId: actor.id, action: `SERVICE_${action}`, targetType: "customer", targetId: customerId,
      result, metadata: { source: ctx.source, actor: actor.label, ...metadata }, ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId,
    });
  }

  /** Step 1. Validates, snapshots the authoritative state, returns what to confirm. Changes nothing. */
  async request(actor: Actor, ctx: Ctx, action: ServiceAction, customerId: string, idempotencyKey: string): Promise<PendingView> {
    if (!CUSTOMER_ID_RE.test(customerId) || idempotencyKey.length < 8 || idempotencyKey.length > 200) throw badRequest();
    if (!can(actor.role, ACTION_PERMISSION[action])) {
      await this.audit(actor, ctx, action, customerId, "DENIED", { reason: "role" });
      throw forbidden();
    }
    if (!this.d.limiter.take("state", actor.id, LIMITS.stateChange)) {
      await this.d.monitor.record("RATE_LIMITED", "WARNING", "State-change rate limit hit", { actor: actor.id });
      throw new AppError(429, "RATE_LIMITED", "Too many requests. Try again later.");
    }

    const existing = await this.d.db.query<Row>("SELECT * FROM pending_actions WHERE idempotency_key = $1", [idempotencyKey]);
    if (existing.rows[0]) {
      const r = existing.rows[0];
      if (r.actor_id !== actor.id || r.action !== action || r.customer_external_id !== customerId) throw conflict("IDEMPOTENCY_MISMATCH", "That request key was used for something else.");
      return this.toPending(r);
    }

    const blocked = await this.d.gate.blockedReason(action, ctx.source);
    if (blocked) {
      await this.audit(actor, ctx, action, customerId, "DENIED", { reason: "disabled" });
      throw conflict("ACTIONS_DISABLED", blocked);
    }
    if (action === "TERMINATE") throw conflict("NOT_SUPPORTED", SAFE_ERRORS.NOT_SUPPORTED!);

    const c = await this.fresh(customerId);
    if (c.status === "UNKNOWN") throw conflict("STATE_UNKNOWN", "The customer's current state could not be determined, so no change is allowed.");
    if (!ALLOWED_FROM[action].includes(c.status)) throw conflict("INVALID_STATE", `Cannot ${action.toLowerCase()} a customer whose status is ${c.status}.`);

    const ins = await this.d.db.query<Row>(
      `INSERT INTO pending_actions (idempotency_key, actor_type, actor_id, source, action, customer_external_id, params, state_snapshot, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
      [idempotencyKey, actor.type, actor.id, ctx.source, action, customerId, JSON.stringify({ username: c.username, fullName: c.fullName }), JSON.stringify({ status: c.status }), new Date(this.now() + CONFIRM_TTL_MS).toISOString()],
    );
    const row = ins.rows[0] ?? (await this.d.db.query<Row>("SELECT * FROM pending_actions WHERE idempotency_key = $1", [idempotencyKey])).rows[0]!;
    if (ins.rows[0]) await this.audit(actor, ctx, action, customerId, "REQUESTED", { pendingId: row.id });
    return this.toPending(row);
  }

  private async fresh(customerId: string) {
    const c = await this.d.providers.customers.get(customerId).catch((e) => {
      this.d.log.error("authoritative lookup failed", { err: String(e) });
      throw new AppError(503, "UNAVAILABLE", "Service temporarily unavailable.");
    });
    if (!c) throw notFound();
    return c;
  }

  private async owned(actor: Actor, id: string): Promise<Row> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
    const r = (await this.d.db.query<Row>("SELECT * FROM pending_actions WHERE id = $1", [id])).rows[0];
    // Someone else's action is indistinguishable from a missing one.
    if (!r || r.actor_id !== actor.id || r.actor_type !== actor.type) throw notFound();
    return r;
  }

  private result(r: Row, replayed: boolean): ResultView {
    const ok = r.status === "SUCCEEDED";
    return {
      id: r.id, state: r.status, ok, replayed,
      message: ok ? (r.result?.message ?? "Done.") : r.status === "PENDING" ? "Awaiting confirmation." : r.error_code ? (SAFE_ERRORS[r.error_code] ?? "The action did not complete.") : `Action ${r.status.toLowerCase()}.`,
      errorCode: r.error_code ?? undefined,
    };
  }

  async cancel(actor: Actor, ctx: Ctx, id: string): Promise<ResultView> {
    const r = await this.owned(actor, id);
    if (r.status === "PENDING") {
      await this.d.db.query("UPDATE pending_actions SET status='CANCELLED' WHERE id=$1 AND status='PENDING'", [id]);
      await this.audit(actor, ctx, r.action, r.customer_external_id, "FAILURE", { pendingId: id, reason: "cancelled" });
    }
    return this.result((await this.owned(actor, id)), false);
  }

  /** Step 2. Exactly one confirm can claim the row; a replay returns the stored outcome. */
  async confirm(actor: Actor, ctx: Ctx, id: string): Promise<ResultView> {
    const r0 = await this.owned(actor, id);
    if (r0.status === "SUCCEEDED" || r0.status === "FAILED") return this.result(r0, true);
    if (r0.status === "CANCELLED") throw conflict("CANCELLED", "That request was cancelled.");
    if (r0.status === "EXECUTING") throw conflict("IN_PROGRESS", "That action is already running.");
    if (new Date(r0.expires_at).getTime() <= this.now()) {
      await this.d.db.query("UPDATE pending_actions SET status='EXPIRED' WHERE id=$1 AND status='PENDING'", [id]);
      throw conflict("EXPIRED", "That request expired. Start again.");
    }

    const claim = await this.d.db.query<Row>(
      "UPDATE pending_actions SET status='EXECUTING', executed_at=now() WHERE id=$1 AND status='PENDING' AND expires_at > $2 RETURNING *",
      [id, new Date(this.now()).toISOString()],
    );
    const row = claim.rows[0];
    if (!row) return this.result(await this.owned(actor, id), true); // lost the race: report the winner's outcome

    const fail = async (code: string, detail: Record<string, unknown> = {}, level: "DENIED" | "FAILURE" = "FAILURE") => {
      await this.d.db.query("UPDATE pending_actions SET status='FAILED', error_code=$2 WHERE id=$1", [id, code]);
      await this.audit(actor, ctx, row.action, row.customer_external_id, level, { pendingId: id, code, ...detail });
      if (code === "UPSTREAM_ERROR" || code === "VERIFICATION_FAILED") {
        await this.d.monitor.record(code === "UPSTREAM_ERROR" ? "RADIUS_FAILED" : "ACTION_FAILED", "ERROR", `Action ${row.action} failed: ${code}`, { pendingId: id });
      }
      return this.result((await this.owned(actor, id)), false);
    };

    if (!can(actor.role, ACTION_PERMISSION[row.action])) return fail("FORBIDDEN", {}, "DENIED");
    const blocked = await this.d.gate.blockedReason(row.action, ctx.source);
    if (blocked) return fail("ACTIONS_DISABLED", {}, "DENIED");

    let cust;
    try {
      cust = await this.fresh(row.customer_external_id);
    } catch {
      return fail("UPSTREAM_ERROR", { phase: "recheck" });
    }
    // Re-check the target against the snapshot the admin actually confirmed.
    if (cust.status !== row.state_snapshot.status || cust.username !== row.params.username) return fail("STATE_CHANGED", { was: row.state_snapshot.status, now: cust.status });

    try {
      if (row.action === "SUSPEND") await this.d.providers.radius.disableUser(cust.username);
      else if (row.action === "RESUME" || row.action === "ACTIVATE") await this.d.providers.radius.enableUser(cust.username);
      else throw new NotSupportedError(row.action);
    } catch (e) {
      if (e instanceof NotSupportedError) return fail("NOT_SUPPORTED");
      this.d.log.error("provider write failed", { action: row.action, err: String(e) });
      return fail("UPSTREAM_ERROR");
    }

    let after;
    try {
      after = await this.fresh(row.customer_external_id);
    } catch {
      return fail("VERIFICATION_FAILED", { phase: "readback" });
    }
    if (after.status !== EXPECTED[row.action]) return fail("VERIFICATION_FAILED", { expected: EXPECTED[row.action], got: after.status });

    const message = `${row.action[0]}${row.action.slice(1).toLowerCase()} done. Status is now ${after.status}.`;
    await this.d.db.query("UPDATE pending_actions SET status='SUCCEEDED', result=$2::jsonb WHERE id=$1", [id, JSON.stringify({ message })]);
    await this.audit(actor, ctx, row.action, row.customer_external_id, "SUCCESS", { pendingId: id, from: row.state_snapshot.status, to: after.status });
    return this.result(await this.owned(actor, id), false);
  }

  /** Worker: expire stale requests; an action stuck EXECUTING needs a human. */
  async sweep(): Promise<{ expired: number; interrupted: number }> {
    const now = new Date(this.now()).toISOString();
    const exp = await this.d.db.query("UPDATE pending_actions SET status='EXPIRED' WHERE status='PENDING' AND expires_at < $1", [now]);
    const stuck = await this.d.db.query<{ id: string }>(
      "UPDATE pending_actions SET status='FAILED', error_code='INTERRUPTED' WHERE status='EXECUTING' AND executed_at < $1 RETURNING id",
      [new Date(this.now() - 5 * 60_000).toISOString()],
    );
    for (const s of stuck.rows) await this.d.monitor.record("ACTION_INTERRUPTED", "CRITICAL", "An action was interrupted mid-execution; verify the customer manually", { pendingId: s.id });
    return { expired: exp.rowCount, interrupted: stuck.rows.length };
  }
}
