import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NotSupportedError } from "../src/errors.js";
import { base32Encode, totpAt } from "../src/crypto.js";
import { PiClient } from "../src/providers/pi/client.js";
import { mapCustomer, mapSession, normalizeStatus, unwrapList } from "../src/providers/pi/mapper.js";
import { createPiProviders, loadPiActions } from "../src/providers/pi/provider.js";
import { CloudApiSender } from "../src/whatsapp/sender.js";
import { runWorkerOnce } from "../src/worker.js";
import { harness } from "./helpers.js";

type Handler = (url: URL, init: RequestInit) => { status?: number; body?: unknown };
function fakeFetch(handler: Handler) {
  const calls: { url: string; method: string; auth?: string; body?: unknown }[] = [];
  const f = (async (u: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(u));
    const headers = init.headers as Record<string, string>;
    calls.push({ url: url.pathname + url.search, method: String(init.method), auth: headers.authorization, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const r = handler(url, init);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { f, calls };
}
const client = (f: typeof fetch, extra = {}) => new PiClient({ baseUrl: "https://pi.test.invalid", username: "svc", password: "pw", fetchImpl: f, ...extra });

describe("PI client", () => {
  it("logs in once, then sends the bearer token; the credentials only go to /api/token/", async () => {
    const { f, calls } = fakeFetch((u) => (u.pathname === "/api/token/" ? { body: { access: "tok-1" } } : { body: { ok: 1 } }));
    const c = client(f);
    await c.get("/api/getstats");
    await c.get("/api/getstats");
    expect(calls.filter((x) => x.url === "/api/token/")).toHaveLength(1);
    expect(calls[1]!.auth).toBe("Bearer tok-1");
    expect(calls.filter((x) => x.url !== "/api/token/").every((x) => !JSON.stringify(x.body ?? "").includes("pw"))).toBe(true);
  });
  it("answers a 2FA challenge with a TOTP code", async () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const now = 1_700_000_000_000;
    const { f, calls } = fakeFetch((_u, init) => {
      const b = JSON.parse(String(init.body ?? "{}"));
      return b.otp_code ? { body: { access: "t" } } : { status: 202, body: { "2fa_required": true } };
    });
    await client(f, { totpSecret: secret, now: () => now }).get("/api/getstats");
    expect((calls[1]!.body as { otp_code: string }).otp_code).toBe(totpAt(secret, Math.floor(now / 30000)));
  });
  it("re-authenticates once on 401 and retries", async () => {
    let n = 0;
    const { f, calls } = fakeFetch((u) => (u.pathname === "/api/token/" ? { body: { access: `t${++n}` } } : n === 1 ? { status: 401 } : { body: { fine: true } }));
    expect(await client(f).get("/api/getstats")).toEqual({ fine: true });
    expect(calls.filter((x) => x.url === "/api/token/")).toHaveLength(2);
  });
  it("a failed login is an error, not a token-less retry loop", async () => {
    const { f, calls } = fakeFetch(() => ({ status: 401 }));
    await expect(client(f).get("/api/x")).rejects.toThrow(/login failed/);
    expect(calls).toHaveLength(1);
  });
  it("a 404 is null; a 500 is an upstream error", async () => {
    expect(await client(fakeFetch((u) => (u.pathname === "/api/token/" ? { body: { access: "t" } } : { status: 404 })).f).get("/api/user/")).toBeNull();
    await expect(client(fakeFetch((u) => (u.pathname === "/api/token/" ? { body: { access: "t" } } : { status: 500 })).f).get("/api/user/")).rejects.toThrow(/500/);
  });
});

describe("PI mapping (tolerant, and fail-safe when unrecognised)", () => {
  it("maps common field aliases and unwraps list envelopes", () => {
    expect(unwrapList({ body: { results: [{ id: 1 }] } })).toHaveLength(1);
    expect(mapCustomer({ id: 7, username: "u7", first_name: "A", last_name: "B", mobile: "961", status: "Active" })).toMatchObject({ externalId: "7", fullName: "A B", phone: "961", status: "ACTIVE" });
  });
  it("an unrecognised status is UNKNOWN, never ACTIVE", () => {
    expect(normalizeStatus({})).toBe("UNKNOWN");
    expect(normalizeStatus({ status: "weird" })).toBe("UNKNOWN");
    expect(normalizeStatus({ enabled: false })).toBe("SUSPENDED");
    expect(normalizeStatus({ status: "expired" })).toBe("EXPIRED");
  });
  it("drops infrastructure detail from sessions", () => {
    const s = mapSession({ acctsessionid: "s1", nasipaddress: "10.0.0.1", callingstationid: "aa:bb", acctinputoctets: 5 });
    expect(JSON.stringify(s)).not.toMatch(/10\.0\.0\.1|aa:bb/);
    expect(s).toMatchObject({ sessionId: "s1", bytesIn: 5 });
  });
  it("rejects a record that is not the one asked for", async () => {
    const { f } = fakeFetch((u) => (u.pathname === "/api/token/" ? { body: { access: "t" } } : { body: { id: 999, username: "someone-else", status: "active" } }));
    const p = createPiProviders(client(f));
    expect(await p.customers.get("1001")).toBeNull();
  });
});

describe("PI writes come only from captured templates", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-"));
  const write = (o: unknown) => {
    const p = join(dir, "a.json");
    writeFileSync(p, JSON.stringify(o));
    return p;
  };
  it("without a template, every write is NotSupported", async () => {
    const { f } = fakeFetch(() => ({ body: { access: "t" } }));
    const p = createPiProviders(client(f), {});
    await expect(p.radius.disableUser("u")).rejects.toBeInstanceOf(NotSupportedError);
    await expect(p.radius.enableUser("u")).rejects.toBeInstanceOf(NotSupportedError);
  });
  it("substitutes only $username and $customerId into the captured body", async () => {
    const { f, calls } = fakeFetch((u) => (u.pathname === "/api/token/" ? { body: { access: "t" } } : { body: {} }));
    const actions = loadPiActions(write({ DISABLE: { method: "POST", path: "/api/user/bulk/actions/", body: { action: "console.inactivate_users", users: ["$username"], note: "$other" } } }));
    await createPiProviders(client(f), actions).radius.disableUser("u1");
    expect(calls.at(-1)!.body).toEqual({ action: "console.inactivate_users", users: ["u1"], note: "$other" });
  });
  it("rejects a template that points outside /api or carries unknown keys", () => {
    expect(() => loadPiActions(write({ DISABLE: { method: "POST", path: "http://evil.example/x", body: {} } }))).toThrow();
    expect(() => loadPiActions(write({ DISABLE: { method: "POST", path: "/api/x", body: {}, extra: 1 } }))).toThrow();
    expect(() => loadPiActions(write({ DELETE_EVERYTHING: {} }))).toThrow();
  });
});

describe("WhatsApp sender and worker", () => {
  it("builds interactive buttons within Cloud API limits and sends the token only as a header", async () => {
    const seen: { url: string; auth: string; body: { interactive: { action: { buttons: { reply: { title: string } }[] } } } }[] = [];
    const s = new CloudApiSender({
      accessToken: "TOKEN", phoneNumberId: "123",
      fetchImpl: (async (u: string, i: RequestInit) => { seen.push({ url: String(u), auth: (i.headers as Record<string, string>).authorization!, body: JSON.parse(String(i.body)) }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch,
    });
    await s.sendButtons("961", "Hello", [1, 2, 3, 4].map((n) => ({ id: `i${n}`, title: "A very long button title indeed" })));
    expect(seen[0]!.body.interactive.action.buttons).toHaveLength(3);
    expect(seen[0]!.body.interactive.action.buttons[0]!.reply.title.length).toBeLessThanOrEqual(20);
    expect(seen[0]!.auth).toBe("Bearer TOKEN");
    expect(seen[0]!.url).not.toContain("TOKEN");
  });
  it("an unconfigured sender sends nothing and says so", async () => {
    const s = new CloudApiSender({});
    expect(s.configured()).toBe(false);
    await expect(s.sendText("961", "x")).resolves.toBeUndefined();
  });
  it("a worker pass writes a heartbeat, expires requests and prunes the replay window", async () => {
    const h = await harness();
    await h.c.db.query("INSERT INTO wa_inbound (message_id, received_at) VALUES ('old', now() - interval '3 days')");
    await runWorkerOnce(h.c);
    expect((await h.c.db.query("SELECT 1 FROM heartbeats WHERE component='worker'")).rowCount).toBe(1);
    expect((await h.c.db.query("SELECT 1 FROM wa_inbound")).rowCount).toBe(0);
    expect((await h.c.health.detailed()).checks.worker!.ok).toBe(true);
  });
  it("critical events alert the owners over WhatsApp; routine ones do not", async () => {
    const h = await harness();
    const by = await h.c.auth.createAdmin({ username: "owner-w", password: "Correct-Horse-9-Battery", role: "SUPER_ADMIN" });
    const w = await h.c.waAdmins.create(by, "96171234567", "Owner", "SUPER_ADMIN");
    await h.c.wa.handle({ messageId: "wamid.alert.1", from: "96171234567", timestampMs: h.clock.t, text: `enroll ${w.enrollmentCode}` });
    const before = h.sender.sent.length;
    await h.c.monitor.record("INFO_THING", "INFO", "routine");
    expect(h.sender.sent).toHaveLength(before);
    await h.c.monitor.record("DB_DOWN", "CRITICAL", "Database health check failed");
    expect(h.sender.sent.at(-1)!.body).toMatch(/ISP alert: Database/);
  });
  it("repeated bad webhook signatures escalate to an alert", async () => {
    const h = await harness();
    const by = await h.c.auth.createAdmin({ username: "owner-x", password: "Correct-Horse-9-Battery", role: "SUPER_ADMIN" });
    const w = await h.c.waAdmins.create(by, "96171234567", "Owner", "SUPER_ADMIN");
    await h.c.wa.handle({ messageId: "wamid.alert.2", from: "96171234567", timestampMs: h.clock.t, text: `enroll ${w.enrollmentCode}` });
    const before = h.sender.sent.length;
    for (let i = 0; i < 3; i++) await h.app.inject({ method: "POST", url: "/internal/v1/whatsapp/events", headers: { "content-type": "application/json" }, payload: "{}" });
    expect(h.sender.sent.length).toBeGreaterThan(before);
    expect(h.sender.sent.at(-1)!.body).toMatch(/signatures/i);
  });
});

import { shapeOf } from "../src/providers/pi/shape.js";
describe("contract probe shape", () => {
  it("reports keys and types but never values", () => {
    const s = JSON.stringify(shapeOf({ username: "alice", phone: "96170000000", nested: { n: 5, list: [{ id: 1 }] } }));
    expect(s).toContain("username");
    expect(s).not.toMatch(/alice|96170000000/);
  });
});
