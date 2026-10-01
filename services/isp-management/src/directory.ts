import { writeAudit } from "./audit.js";
import type { Db } from "./db.js";
import { AppError, badRequest, forbidden, notFound } from "./errors.js";
import type { SecurityMonitor } from "./events.js";
import type { Logger } from "./logger.js";
import type { Customer, PaymentInfo, Providers, RadiusStatus, ServiceInfo, SessionInfo } from "./providers/types.js";
import { LIMITS, type RateLimiter } from "./ratelimit.js";
import { can, type Permission } from "./rbac.js";
import type { Actor, Ctx } from "./actions.js";
import { CUSTOMER_ID_RE } from "./actions.js";

export const MAX_SEARCH = 25;

type Section<T> = { available: true; data: T } | { available: false };
export interface Profile {
  customer: Customer;
  services?: Section<ServiceInfo[]>;
  payments?: Section<PaymentInfo[]>;
  radius?: Section<RadiusStatus>;
}

/** Customer reads. Authoritative from the provider; the local tables are a best-effort cache. */
export class Directory {
  private viewed = new Map<string, { id: string; at: number }[]>();
  constructor(private d: { db: Db; providers: Providers; limiter: RateLimiter; monitor: SecurityMonitor; log: Logger; now?: () => number }) {}
  private now = () => this.d.now?.() ?? Date.now();

  private need(a: Actor, p: Permission) {
    if (!can(a.role, p)) throw forbidden();
  }

  /** Wildcards and very short terms would turn search into a dump of the customer base. */
  static cleanQuery(q: string): string {
    const t = q.normalize("NFKC").trim();
    if (t.length < 3 || t.length > 64 || /[%_*\\]/.test(t) || /[\u0000-\u001f]/.test(t)) throw badRequest("Enter at least 3 characters (no wildcards).");
    return t;
  }

  async search(a: Actor, ctx: Ctx, q: string, limit = 10) {
    this.need(a, "customer:read");
    const term = Directory.cleanQuery(q);
    if (!this.d.limiter.take("search", a.id, LIMITS.search)) {
      await this.d.monitor.record("RATE_LIMITED", "WARNING", "Customer search rate limit hit", { actor: a.id });
      throw new AppError(429, "RATE_LIMITED", "Too many searches. Try again shortly.");
    }
    const page = await this.guard(() => this.d.providers.customers.search(term, Math.min(Math.max(1, limit), MAX_SEARCH)));
    await writeAudit(this.d.db, {
      actorType: a.type, actorId: a.id, action: "CUSTOMER_SEARCH", result: "SUCCESS",
      metadata: { queryLength: term.length, results: page.items.length, source: ctx.source }, ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId,
    });
    this.noteViewed(a, page.items.map((c) => c.externalId));
    return page;
  }

  async profile(a: Actor, ctx: Ctx, id: string, want: { services?: boolean; payments?: boolean; radius?: boolean } = { services: true, payments: true, radius: true }): Promise<Profile> {
    this.need(a, "customer:read");
    if (!CUSTOMER_ID_RE.test(id)) throw badRequest();
    if (!this.d.limiter.take("read", a.id, LIMITS.customerRead)) throw new AppError(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
    const customer = await this.guard(() => this.d.providers.customers.get(id));
    if (!customer) throw notFound();
    this.noteViewed(a, [customer.externalId]);

    const part = async <T>(perm: Permission, on: boolean | undefined, f: () => Promise<T>): Promise<Section<T> | undefined> => {
      if (!on || !can(a.role, perm)) return undefined;
      try {
        return { available: true, data: await f() };
      } catch (e) {
        this.d.log.warn("profile section failed", { err: String(e) });
        return { available: false };
      }
    };
    if (want.radius && !this.d.limiter.take("radius", a.id, LIMITS.radius)) throw new AppError(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
    const [services, payments, radius] = await Promise.all([
      part("service:read", want.services, () => this.d.providers.services.listForCustomer(id)),
      part("payment:read", want.payments, () => this.d.providers.payments.listForCustomer(id, 5)),
      part("radius:read", want.radius, () => this.d.providers.radius.getUserStatus(customer.username)),
    ]);
    await this.cache(customer, services?.available ? services.data : undefined).catch((e) => this.d.log.warn("cache write failed", { err: String(e) }));
    await writeAudit(this.d.db, {
      actorType: a.type, actorId: a.id, action: "CUSTOMER_VIEW", targetType: "customer", targetId: id, result: "SUCCESS",
      metadata: { source: ctx.source }, ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId,
    });
    return { customer, services, payments, radius };
  }

  async sessions(a: Actor, id: string): Promise<SessionInfo[]> {
    this.need(a, "radius:read");
    const c = await this.guard(() => this.d.providers.customers.get(id));
    if (!c) throw notFound();
    if (!this.d.limiter.take("radius", a.id, LIMITS.radius)) throw new AppError(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
    return this.guard(() => this.d.providers.radius.getActiveSessions(c.username));
  }

  private async guard<T>(f: () => Promise<T>): Promise<T> {
    try {
      return await f();
    } catch (e) {
      this.d.log.error("provider read failed", { err: String(e) });
      await this.d.monitor.record("PROVIDER_READ_FAILED", "WARNING", "ISP system read failed");
      throw new AppError(503, "UNAVAILABLE", "Service temporarily unavailable.");
    }
  }

  /** More than 50 distinct customers opened in 10 minutes is a scrape, not a support shift. */
  private noteViewed(a: Actor, ids: string[]) {
    const t = this.now();
    const list = (this.viewed.get(a.id) ?? []).filter((x) => x.at > t - 10 * 60_000);
    for (const id of ids) list.push({ id, at: t });
    this.viewed.set(a.id, list);
    if (new Set(list.map((x) => x.id)).size > 50) {
      this.viewed.set(a.id, []);
      void this.d.monitor.record("ENUMERATION_SUSPECTED", "CRITICAL", "Many distinct customers viewed in a short time", { actor: a.id });
    }
  }

  private async cache(c: Customer, services?: ServiceInfo[]) {
    const row = await this.d.db.query<{ id: string }>(
      `INSERT INTO customers (external_customer_id, username, full_name, phone, email, address, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (external_customer_id) DO UPDATE SET username=EXCLUDED.username, full_name=EXCLUDED.full_name, phone=EXCLUDED.phone,
         email=EXCLUDED.email, address=EXCLUDED.address, status=EXCLUDED.status, updated_at=now() RETURNING id`,
      [c.externalId, c.username, c.fullName ?? null, c.phone ?? null, c.email ?? null, c.address ?? null, c.status],
    );
    const cid = row.rows[0]?.id;
    if (!cid) return;
    for (const s of services ?? []) {
      await this.d.db.query(
        `INSERT INTO services (customer_id, external_service_id, username, service_type, package, speed, status, activation_date, expiration_date, suspension_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (customer_id, external_service_id) DO UPDATE SET service_type=EXCLUDED.service_type, package=EXCLUDED.package, speed=EXCLUDED.speed,
           status=EXCLUDED.status, activation_date=EXCLUDED.activation_date, expiration_date=EXCLUDED.expiration_date, suspension_date=EXCLUDED.suspension_date, updated_at=now()`,
        [cid, s.externalId, s.username, s.serviceType ?? null, s.package ?? null, s.speed ?? null, s.status, s.activationDate ?? null, s.expirationDate ?? null, s.suspensionDate ?? null],
      );
    }
  }

  async dashboard(a: Actor) {
    this.need(a, "system:read");
    const counts = await this.d.db.query<{ status: string; n: string }>("SELECT status, count(*)::text AS n FROM customers GROUP BY status");
    const expiring = await this.d.db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM services WHERE expiration_date IS NOT NULL AND expiration_date BETWEEN now() AND now() + interval '7 days'",
    );
    const upstream = await this.d.providers.stats.stats().catch(() => null);
    const events = await this.d.db.query("SELECT id, event_type, severity, message, created_at FROM system_events WHERE severity IN ('ERROR','CRITICAL') ORDER BY id DESC LIMIT 10");
    const recent = can(a.role, "audit:read")
      ? (await this.d.db.query("SELECT id, actor_type, action, target_id, result, created_at FROM audit_logs ORDER BY id DESC LIMIT 10")).rows
      : undefined;
    return {
      cachedCustomersByStatus: Object.fromEntries(counts.rows.map((r) => [r.status, Number(r.n)])),
      cachedExpiringWithin7Days: Number(expiring.rows[0]?.n ?? 0),
      upstreamStats: upstream,
      recentErrors: events.rows,
      recentActions: recent,
    };
  }
}
