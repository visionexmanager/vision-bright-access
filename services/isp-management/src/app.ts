import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import cookie from "@fastify/cookie";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { type Actor, type Ctx } from "./actions.js";
import { listAdminUsers, updateAdminUser } from "./adminusers.js";
import { verifyAuditChain, writeAudit } from "./audit.js";
import type { SessionInfo } from "./auth.js";
import type { Container } from "./container.js";
import { AppError, badRequest, forbidden, unauthorized } from "./errors.js";
import { LIMITS } from "./ratelimit.js";
import { can, type Permission } from "./rbac.js";
import { extractMessages, verifyGatewaySignature, verifyMetaSignature } from "./whatsapp/inbound.js";
import { safeEqual } from "./crypto.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
    session?: SessionInfo;
    reqId: string;
  }
}

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon", ".png": "image/png", ".woff2": "font/woff2" };

const strict = <T extends z.ZodRawShape>(s: T) => z.object(s).strict();
const idParam = z.string().regex(/^[A-Za-z0-9._@-]{1,64}$/);
const uuidParam = z.string().uuid();

export async function buildApp(c: Container, opts: { webDir?: string } = {}) {
  const { cfg } = c;
  const prod = cfg.env === "production";
  const COOKIE = prod ? "__Host-isp_sid" : "isp_sid";
  const app = Fastify({ trustProxy: cfg.trustProxy, bodyLimit: 256 * 1024, genReqId: () => randomUUID() });
  await app.register(cookie);

  // One JSON parser for everything; keeps the exact bytes for webhook signatures.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    req.rawBody = body as Buffer;
    if (!(body as Buffer).length) return done(null, {});
    try {
      done(null, JSON.parse((body as Buffer).toString("utf8")));
    } catch {
      done(badRequest("Malformed JSON."), undefined);
    }
  });

  const actorOf = (s: SessionInfo): Actor => ({ type: "ADMIN_USER", id: s.adminId, role: s.role, label: s.username });
  const ctxOf = (req: FastifyRequest): Ctx => ({ source: "WEB", ip: req.ip, userAgent: req.headers["user-agent"] ?? null, requestId: req.reqId });

  app.addHook("onRequest", async (req, reply) => {
    req.reqId = String(req.id);
    reply.header("x-request-id", req.reqId);
    reply.header("x-robots-tag", "noindex, nofollow, noarchive");
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cross-origin-opener-policy", "same-origin");
    reply.header("cross-origin-resource-policy", "same-origin");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    reply.header("content-security-policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (prod) reply.header("strict-transport-security", "max-age=31536000");
    if (req.url.startsWith("/api")) reply.header("cache-control", "no-store");

    if (!c.limiter.take("public", req.ip, LIMITS.publicIp)) {
      await c.monitor.record("RATE_LIMITED", "WARNING", "Per-IP request limit hit", { ip: req.ip });
      return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } });
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).send({ error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Invalid request." } });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: { code: "BAD_REQUEST", message: "Invalid request." } });
    c.log.error("unhandled error", { requestId: req.reqId, err: String(err), path: req.url.split("?")[0] });
    return reply.code(500).send({ error: { code: "INTERNAL", message: "Service temporarily unavailable." } });
  });

  // ---- session + CSRF for /api (login and the WhatsApp endpoints are excluded) ----
  const OPEN = new Set(["/api/auth/login"]);
  app.addHook("preHandler", async (req) => {
    const path = req.url.split("?")[0]!;
    if (!path.startsWith("/api/") || OPEN.has(path)) return;
    const s = await c.auth.resolve(req.cookies[COOKIE]);
    if (!s) throw unauthorized();
    req.session = s;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.headers.origin;
      if (origin && origin !== cfg.publicOrigin) throw forbidden();
      if (!c.auth.csrfOk(s, req.headers["x-csrf-token"] as string | undefined)) throw forbidden();
    }
    if (s.limited && !path.startsWith("/api/auth/")) throw new AppError(403, "MFA_REQUIRED", "Set up two-factor authentication first.");
  });

  const need = (req: FastifyRequest, p: Permission): SessionInfo => {
    const s = req.session;
    if (!s) throw unauthorized();
    if (!can(s.role, p)) throw forbidden();
    return s;
  };

  // ---- public: minimal health only ----
  app.get("/health", async (_req, reply) => (await c.health.liveDb()) ? { status: "healthy" } : reply.code(503).send({ status: "unhealthy" }));
  app.get("/readiness", async (_req, reply) => (await c.health.liveDb()) ? { status: "healthy" } : reply.code(503).send({ status: "unhealthy" }));
  app.get("/liveness", async () => ({ status: "healthy" }));
  app.get("/robots.txt", async (_req, reply) => reply.type("text/plain").send("User-agent: *\nDisallow: /\n"));

  // ---- auth ----
  app.post("/api/auth/login", async (req, reply) => {
    // Login has no session to carry a CSRF token, so require same-origin JSON.
    if (req.headers.origin && req.headers.origin !== cfg.publicOrigin) throw forbidden();
    if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) throw badRequest();
    const b = strict({ username: z.string().min(1).max(64), password: z.string().min(1).max(200), otp: z.string().max(10).optional() }).parse(req.body);
    const { token, session } = await c.auth.login(b.username, b.password, b.otp, req.ip, req.headers["user-agent"] ?? null, req.reqId);
    reply.setCookie(COOKIE, token, { httpOnly: true, secure: prod || cfg.publicOrigin.startsWith("https://"), sameSite: "strict", path: "/", maxAge: 8 * 3600 });
    return { user: { username: session.username, displayName: session.displayName, role: session.role }, csrf: session.csrf, mfaSetupRequired: session.limited };
  });
  app.get("/api/auth/me", async (req) => {
    const s = req.session!;
    return { user: { username: s.username, displayName: s.displayName, role: s.role }, csrf: s.csrf, mfaSetupRequired: s.limited };
  });
  app.post("/api/auth/logout", async (req, reply) => {
    await c.auth.logout(req.session!.sessionId);
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });
  app.post("/api/auth/password", async (req) => {
    const b = strict({ current: z.string().max(200), next: z.string().max(200) }).parse(req.body);
    await c.auth.changePassword(req.session!, b.current, b.next);
    return { ok: true };
  });
  app.post("/api/auth/mfa/begin", async (req) => c.auth.mfaBegin(req.session!));
  app.post("/api/auth/mfa/confirm", async (req) => {
    await c.auth.mfaConfirm(req.session!, strict({ code: z.string().length(6) }).parse(req.body).code);
    return { ok: true };
  });

  // ---- read ----
  app.get("/api/dashboard", async (req) => {
    const s = need(req, "system:read");
    return c.directory.dashboard(actorOf(s));
  });
  app.get("/api/customers", async (req) => {
    const s = need(req, "customer:read");
    const q = strict({ q: z.string().max(80), limit: z.coerce.number().int().min(1).max(25).optional() }).parse(req.query);
    return c.directory.search(actorOf(s), ctxOf(req), q.q, q.limit ?? 10);
  });
  app.get<{ Params: { id: string } }>("/api/customers/:id", async (req) => {
    const s = need(req, "customer:read");
    return c.directory.profile(actorOf(s), ctxOf(req), idParam.parse(req.params.id));
  });
  app.get<{ Params: { id: string } }>("/api/customers/:id/sessions", async (req) => {
    const s = need(req, "radius:read");
    return { sessions: await c.directory.sessions(actorOf(s), idParam.parse(req.params.id)) };
  });

  // ---- state change: request, then confirm ----
  app.post<{ Params: { id: string } }>("/api/customers/:id/actions", async (req) => {
    const s = req.session!;
    const b = strict({ action: z.enum(["SUSPEND", "RESUME", "ACTIVATE", "TERMINATE"]), idempotencyKey: z.string().min(8).max(200) }).parse(req.body);
    return c.actions.request(actorOf(s), ctxOf(req), b.action, idParam.parse(req.params.id), `web:${s.adminId}:${b.idempotencyKey}`);
  });
  app.post<{ Params: { id: string } }>("/api/actions/:id/confirm", async (req) => c.actions.confirm(actorOf(req.session!), ctxOf(req), uuidParam.parse(req.params.id)));
  app.post<{ Params: { id: string } }>("/api/actions/:id/cancel", async (req) => c.actions.cancel(actorOf(req.session!), ctxOf(req), uuidParam.parse(req.params.id)));

  // ---- audit / system ----
  app.get("/api/audit", async (req) => {
    need(req, "audit:read");
    const q = strict({ before: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query);
    const r = await c.db.query(
      "SELECT id, actor_type, actor_id, action, target_type, target_id, result, metadata, created_at FROM audit_logs WHERE ($1::bigint IS NULL OR id < $1) ORDER BY id DESC LIMIT $2",
      [q.before ?? null, q.limit ?? 50],
    );
    return { entries: r.rows };
  });
  app.get("/api/audit/verify", async (req) => {
    need(req, "killswitch:manage");
    return verifyAuditChain(c.db);
  });
  app.get("/api/events", async (req) => {
    need(req, "system:read");
    return { events: (await c.db.query("SELECT id, event_type, severity, message, created_at FROM system_events ORDER BY id DESC LIMIT 100")).rows };
  });
  app.get("/api/system", async (req) => {
    need(req, "system:read");
    const [health, ks, queue] = await Promise.all([
      c.health.detailed(),
      c.gate.get(),
      c.db.query<{ status: string; n: string }>("SELECT status, count(*)::text AS n FROM pending_actions WHERE created_at > now() - interval '1 day' GROUP BY status"),
    ]);
    // Booleans only: no hostnames, no addresses, no secrets.
    return {
      environment: cfg.env, health, killSwitch: ks,
      writeCapabilities: { radiusWrite: cfg.flags.radiusWrite, whatsappWrite: cfg.flags.whatsappWrite, suspension: cfg.flags.suspension, activation: cfg.flags.activation, termination: cfg.flags.termination },
      actionsLast24h: Object.fromEntries(queue.rows.map((r) => [r.status, Number(r.n)])),
    };
  });
  app.post("/api/system/killswitch", async (req) => {
    const s = need(req, "killswitch:manage");
    const b = strict({ allWrites: z.boolean(), whatsappWrites: z.boolean(), radiusWrites: z.boolean() }).parse(req.body);
    await c.gate.set(b, s.username);
    await writeAudit(c.db, { actorType: "ADMIN_USER", actorId: s.adminId, action: "KILL_SWITCH_SET", result: "SUCCESS", metadata: b, ip: req.ip, requestId: req.reqId });
    await c.monitor.record("KILL_SWITCH", b.allWrites || b.whatsappWrites || b.radiusWrites ? "CRITICAL" : "INFO", "Kill switch changed", { ...b, by: s.username });
    return b;
  });

  // ---- admin management ----
  app.get("/api/admin-users", async (req) => {
    need(req, "admin:manage");
    return { users: await listAdminUsers(c.db) };
  });
  app.post("/api/admin-users", async (req) => {
    const s = need(req, "admin:manage");
    const b = strict({ username: z.string().max(64), password: z.string().max(200), role: z.enum(["SUPER_ADMIN", "ADMIN", "READ_ONLY_ADMIN"]), displayName: z.string().max(80).optional() }).parse(req.body);
    const id = await c.auth.createAdmin(b);
    await writeAudit(c.db, { actorType: "ADMIN_USER", actorId: s.adminId, action: "ADMIN_USER_CREATE", targetType: "admin_user", targetId: id, result: "SUCCESS", metadata: { role: b.role }, ip: req.ip, requestId: req.reqId });
    return { id };
  });
  app.patch<{ Params: { id: string } }>("/api/admin-users/:id", async (req) => {
    const s = need(req, "admin:manage");
    const b = strict({ status: z.enum(["ACTIVE", "DISABLED"]).optional(), role: z.enum(["SUPER_ADMIN", "ADMIN", "READ_ONLY_ADMIN"]).optional() }).parse(req.body);
    await updateAdminUser(c.db, s.adminId, uuidParam.parse(req.params.id), b);
    return { ok: true };
  });
  app.get("/api/whatsapp-admins", async (req) => {
    need(req, "whatsapp_admin:manage");
    return { admins: await c.waAdmins.list() };
  });
  app.post("/api/whatsapp-admins", async (req) => {
    const s = need(req, "whatsapp_admin:manage");
    const b = strict({ phone: z.string().max(25), name: z.string().max(80), role: z.enum(["ADMIN", "WHATSAPP_ADMIN", "READ_ONLY_ADMIN"]) }).parse(req.body);
    return c.waAdmins.create(s.adminId, b.phone, b.name, b.role);
  });
  app.patch<{ Params: { id: string } }>("/api/whatsapp-admins/:id", async (req) => {
    const s = need(req, "whatsapp_admin:manage");
    const b = strict({ status: z.enum(["ACTIVE", "DISABLED"]) }).parse(req.body);
    await c.waAdmins.setStatus(s.adminId, uuidParam.parse(req.params.id), b.status);
    return { ok: true };
  });

  // ---- WhatsApp inbound ----
  const processInbound = async (req: FastifyRequest, reply: FastifyReply) => {
    const msgs = extractMessages(req.body);
    if (!msgs) return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Invalid request." } });
    // Always 200 once authenticated: a non-200 makes the provider retry, which only repeats the work.
    for (const m of msgs) await c.wa.handle(m, req.ip).catch((e) => c.log.error("whatsapp message failed", { err: String(e) }));
    return reply.code(200).send({ ok: true });
  };
  const wrongSig = async (req: FastifyRequest, reply: FastifyReply) => {
    await c.monitor.record("WA_SIGNATURE_INVALID", "WARNING", "WhatsApp webhook signature rejected", { ip: req.ip });
    return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  };
  const waLimit = (req: FastifyRequest) => c.limiter.take("wa-webhook", req.ip, LIMITS.waWebhookIp);

  // Forwarded from the public VisionEX webhook, authenticated with a shared HMAC + timestamp.
  app.post("/internal/v1/whatsapp/events", async (req, reply) => {
    if (!waLimit(req)) return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Too many requests." } });
    const ok = verifyGatewaySignature(req.rawBody ?? Buffer.alloc(0), req.headers["x-isp-timestamp"] as string | undefined, req.headers["x-isp-signature"] as string | undefined, cfg.wa.gatewaySecret, c.now());
    return ok ? processInbound(req, reply) : wrongSig(req, reply);
  });

  if (cfg.wa.directWebhook) {
    app.get("/wa/webhook", async (req, reply) => {
      const q = req.query as Record<string, string>;
      if (q["hub.mode"] === "subscribe" && cfg.wa.verifyToken && safeEqual(q["hub.verify_token"] ?? "", cfg.wa.verifyToken)) return reply.type("text/plain").send(q["hub.challenge"] ?? "");
      return reply.code(403).send();
    });
    app.post("/wa/webhook", async (req, reply) => {
      if (!waLimit(req)) return reply.code(429).send();
      return verifyMetaSignature(req.rawBody ?? Buffer.alloc(0), req.headers["x-hub-signature-256"] as string | undefined, cfg.wa.appSecret) ? processInbound(req, reply) : wrongSig(req, reply);
    });
  }

  // ---- static admin UI (same origin: cookie auth, no CORS) ----
  const webDir = opts.webDir ? resolve(opts.webDir) : null;
  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split("?")[0]!;
    if (!webDir || req.method !== "GET" || path.startsWith("/api/") || path.startsWith("/internal/")) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found." } });
    const file = resolve(join(webDir, normalize(decodeURIComponent(path)).replace(/^([/\\])+/, "")));
    const inside = file === webDir || file.startsWith(webDir + sep);
    const target = inside && existsSync(file) && statSync(file).isFile() ? file : join(webDir, "index.html");
    if (!existsSync(target)) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found." } });
    return reply.type(MIME[extname(target)] ?? "application/octet-stream").send(readFileSync(target));
  });

  return app;
}
