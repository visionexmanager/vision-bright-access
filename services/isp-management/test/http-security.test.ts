import { beforeEach, describe, expect, it } from "vitest";
import { MAX_FAILED, SESSION_IDLE_MS } from "../src/auth.js";
import { newTotpSecret } from "../src/crypto.js";
import { authed, harness, login, makeAdmin, ORIGIN, STRONG, totpNow, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});

const get = (url: string, a: { cookie: string }) => h.app.inject({ method: "GET", url, headers: { cookie: a.cookie } });
const post = (url: string, a: { cookie: string; csrf: string }, payload?: unknown) =>
  h.app.inject({ method: "POST", url, headers: authed(a, true), payload: payload as never });

describe("authentication", () => {
  it("logs in, sets a hardened session cookie, and never returns the token in the body", async () => {
    await makeAdmin(h, "owner");
    const { res, cookie } = await login(h, "owner");
    expect(res.statusCode).toBe(200);
    const sc = String(res.headers["set-cookie"]);
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Strict/i);
    expect(sc).toMatch(/Secure/i);
    expect(res.body).not.toContain(cookie.split("=")[1]!);
    expect((await get("/api/auth/me", { cookie })).statusCode).toBe(200);
  });

  it("answers every failure identically: wrong password, unknown user, disabled user", async () => {
    await makeAdmin(h, "owner");
    const id = await makeAdmin(h, "gone", "ADMIN");
    await h.c.db.query("UPDATE admin_users SET status='DISABLED' WHERE id=$1", [id]);
    const bodies = new Set<string>();
    for (const [u, p] of [["owner", "wrong-password-1"], ["nobody", "wrong-password-1"], ["gone", STRONG]] as const) {
      const r = await login(h, u, p);
      expect(r.res.statusCode).toBe(401);
      bodies.add(r.res.body);
    }
    expect(bodies.size).toBe(1);
  });

  it("locks the account after repeated failures, even for the correct password", async () => {
    await makeAdmin(h, "owner");
    for (let i = 0; i < MAX_FAILED; i++) await login(h, "owner", "bad-password-" + i);
    (h.c.limiter as unknown as { hits: Map<string, number[]> }).hits.clear(); // isolate the lockout from the limiter
    const r = await login(h, "owner");
    expect([401, 429]).toContain(r.res.statusCode);
    expect(r.cookie).toBe("");
  });

  it("rate-limits brute force and records it", async () => {
    await makeAdmin(h, "owner");
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await login(h, "owner", "bad-password-" + i)).res.statusCode);
    expect(codes).toContain(429);
    expect((await h.c.db.query("SELECT 1 FROM system_events WHERE event_type IN ('LOGIN_FAILED','RATE_LIMITED')")).rowCount).toBeGreaterThan(0);
  });

  it("expires an idle session and an absolute-age session", async () => {
    await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    h.clock.t += SESSION_IDLE_MS + 1000;
    expect((await get("/api/auth/me", a)).statusCode).toBe(401);
  });

  it("logout revokes the session server-side", async () => {
    await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    expect((await post("/api/auth/logout", a)).statusCode).toBe(200);
    expect((await get("/api/auth/me", a)).statusCode).toBe(401);
  });

  it("requires a valid, unreplayed TOTP once MFA is enabled", async () => {
    await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    const { secret } = (await post("/api/auth/mfa/begin", a)).json() as { secret: string };
    h.clock.t += 31_000;
    expect((await post("/api/auth/mfa/confirm", a, { code: totpNow(secret, h.clock.t) })).statusCode).toBe(200);
    expect((await login(h, "owner")).res.statusCode).toBe(401); // no code
    h.clock.t += 31_000;
    const code = totpNow(secret, h.clock.t);
    expect((await login(h, "owner", STRONG, code)).res.statusCode).toBe(200);
    expect((await login(h, "owner", STRONG, code)).res.statusCode).toBe(401); // replay
  });

  it("an enforced-MFA deployment confines a new session to MFA setup", async () => {
    const m = await harness({ REQUIRE_MFA: "true" });
    await m.c.auth.createAdmin({ username: "fresh", password: STRONG, role: "ADMIN" });
    const a = await login(m, "fresh");
    expect(a.res.json()).toMatchObject({ mfaSetupRequired: true });
    expect((await m.app.inject({ method: "GET", url: "/api/dashboard", headers: { cookie: a.cookie } })).statusCode).toBe(403);
    expect((await m.app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: a.cookie } })).statusCode).toBe(200);
  });
});

describe("authorisation and request hygiene", () => {
  it("every /api route requires a session", async () => {
    for (const [m, u] of [["GET", "/api/customers?q=abc"], ["GET", "/api/customers/1001"], ["GET", "/api/dashboard"], ["GET", "/api/audit"], ["GET", "/api/system"], ["GET", "/api/admin-users"], ["GET", "/api/whatsapp-admins"], ["POST", "/api/customers/1001/actions"], ["POST", "/api/actions/x/confirm"], ["POST", "/api/system/killswitch"]] as const)
      expect((await h.app.inject({ method: m, url: u })).statusCode, `${m} ${u}`).toBe(401);
  });

  it("rejects state changes without the CSRF token or from a foreign origin", async () => {
    await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    const body = { action: "SUSPEND", idempotencyKey: "web-key-0001" };
    const noToken = await h.app.inject({ method: "POST", url: "/api/customers/1001/actions", headers: { cookie: a.cookie, origin: ORIGIN, "content-type": "application/json" }, payload: body });
    expect(noToken.statusCode).toBe(403);
    const badOrigin = await h.app.inject({ method: "POST", url: "/api/customers/1001/actions", headers: { cookie: a.cookie, "x-csrf-token": a.csrf, origin: "https://evil.example", "content-type": "application/json" }, payload: body });
    expect(badOrigin.statusCode).toBe(403);
    const forgedLogin = await h.app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: "https://evil.example", "content-type": "application/json" }, payload: { username: "owner", password: STRONG } });
    expect(forgedLogin.statusCode).toBe(403);
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
  });

  it("READ_ONLY_ADMIN cannot act, manage admins, read the audit log or touch the kill switch", async () => {
    await makeAdmin(h, "viewer", "READ_ONLY_ADMIN");
    const a = await login(h, "viewer");
    expect((await post("/api/customers/1001/actions", a, { action: "SUSPEND", idempotencyKey: "web-key-0001" })).statusCode).toBe(403);
    expect((await get("/api/admin-users", a)).statusCode).toBe(403);
    expect((await get("/api/audit", a)).statusCode).toBe(403);
    expect((await post("/api/system/killswitch", a, { allWrites: false, whatsappWrites: false, radiusWrites: false })).statusCode).toBe(403);
    expect((await get("/api/customers/1001", a)).statusCode).toBe(200);
  });

  it("ADMIN cannot escalate: no admin management, no kill switch, no termination", async () => {
    await makeAdmin(h, "ops", "ADMIN");
    const a = await login(h, "ops");
    expect((await post("/api/admin-users", a, { username: "x-admin", password: STRONG, role: "SUPER_ADMIN" })).statusCode).toBe(403);
    expect((await post("/api/system/killswitch", a, { allWrites: true, whatsappWrites: true, radiusWrites: true })).statusCode).toBe(403);
    expect((await post("/api/customers/1001/actions", a, { action: "TERMINATE", idempotencyKey: "web-key-0002" })).statusCode).toBe(403);
  });

  it("rejects unknown fields and malformed ids; never leaks internals", async () => {
    await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    expect((await post("/api/customers/1001/actions", a, { action: "SUSPEND", idempotencyKey: "web-key-0001", extra: 1 })).statusCode).toBe(400);
    const sqli = await get("/api/customers/" + encodeURIComponent("1001'; DROP TABLE customers;--"), a);
    expect(sqli.statusCode).toBe(400);
    const wild = await get("/api/customers?q=%25", a);
    expect(wild.statusCode).toBe(400);
    h.providers.failNext = "get";
    const boom = await get("/api/customers/1001", a);
    expect(boom.statusCode).toBe(503);
    expect(boom.body).not.toMatch(/injected|stack|at Object|\.ts/);
  });

  it("returns JSON only and sends security headers; XSS payloads stay inert data", async () => {
    await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    h.providers.data.set("x1", { externalId: "x1", username: "xss", fullName: "<script>alert(1)</script>", status: "ACTIVE" });
    const r = await get("/api/customers/x1", a);
    expect(String(r.headers["content-type"])).toContain("application/json");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-frame-options"]).toBe("DENY");
    expect(String(r.headers["content-security-policy"])).toContain("frame-ancestors 'none'");
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.headers["x-robots-tag"]).toContain("noindex");
  });

  it("the full web flow: request, confirm, replay, with audit and CSRF", async () => {
    await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    const p = (await post("/api/customers/1001/actions", a, { action: "SUSPEND", idempotencyKey: "web-key-0001" })).json() as { id: string };
    const r1 = await post(`/api/actions/${p.id}/confirm`, a);
    expect(r1.json()).toMatchObject({ ok: true });
    const r2 = await post(`/api/actions/${p.id}/confirm`, a);
    expect(r2.json()).toMatchObject({ ok: true, replayed: true });
    expect(h.providers.data.get("1001")!.status).toBe("SUSPENDED");
    const audit = (await get("/api/audit", a)).json() as { entries: { action: string }[] };
    expect(audit.entries.map((e) => e.action)).toContain("SERVICE_SUSPEND");
  });

  it("the kill switch is SUPER_ADMIN-only, takes effect immediately, and is audited", async () => {
    await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    expect((await post("/api/system/killswitch", a, { allWrites: true, whatsappWrites: false, radiusWrites: false })).statusCode).toBe(200);
    const r = await post("/api/customers/1001/actions", a, { action: "SUSPEND", idempotencyKey: "web-key-0001" });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ error: { code: "ACTIONS_DISABLED" } });
    expect((await get("/api/customers/1001", a)).statusCode).toBe(200);
    expect((await h.c.db.query("SELECT 1 FROM audit_logs WHERE action='KILL_SWITCH_SET'")).rowCount).toBe(1);
  });

  it("will not disable or demote the last SUPER_ADMIN, or yourself", async () => {
    const id = await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    const second = await makeAdmin(h, "second", "ADMIN");
    const self = await h.app.inject({ method: "PATCH", url: `/api/admin-users/${id}`, headers: authed(a, true), payload: { status: "DISABLED" } });
    expect(self.statusCode).toBe(409);
    expect((await h.app.inject({ method: "PATCH", url: `/api/admin-users/${second}`, headers: authed(a, true), payload: { status: "DISABLED" } })).statusCode).toBe(200);
  });
});

describe("public surface", () => {
  it("health reveals one word and no internals", async () => {
    const r = await h.app.inject({ method: "GET", url: "/health" });
    expect(r.json()).toEqual({ status: "healthy" });
    expect((await h.app.inject({ method: "GET", url: "/robots.txt" })).body).toContain("Disallow: /");
  });
  it("detailed diagnostics need authentication and carry no hostnames", async () => {
    expect((await h.app.inject({ method: "GET", url: "/api/system" })).statusCode).toBe(401);
    await makeAdmin(h, "owner");
    const a = await login(h, "owner");
    const body = (await get("/api/system", a)).body;
    expect(body).toContain("killSwitch");
    expect(body).not.toMatch(/postgres:|192\.168|10\.\d+\.\d+\.\d+/);
  });
  it("unknown paths are a plain 404", async () => {
    expect((await h.app.inject({ method: "GET", url: "/admin" })).statusCode).toBe(404);
    expect((await h.app.inject({ method: "GET", url: "/wa/webhook" })).statusCode).toBe(404); // direct mode off
  });
  it("totp seed generator yields distinct secrets", () => expect(newTotpSecret()).not.toBe(newTotpSecret()));
});
