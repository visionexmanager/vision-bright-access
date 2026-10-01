import { beforeEach, describe, expect, it } from "vitest";
import { hmacHex } from "../src/crypto.js";
import { extractMessages, verifyGatewaySignature, verifyMetaSignature } from "../src/whatsapp/inbound.js";
import { btn, intentSchema, interpret, parseButton, parseText } from "../src/whatsapp/parser.js";
import type { InboundMessage } from "../src/whatsapp/inbound.js";
import { GATEWAY_SECRET, harness, makeAdmin, totpNow, type Harness } from "./helpers.js";

const PHONE = "96171234567";
let h: Harness;
let n = 0;
const msg = (text: string, from = PHONE): InboundMessage => ({ messageId: `wamid.${++n}`, from, timestampMs: h.clock.t, text });
const tap = (buttonId: string, from = PHONE): InboundMessage => ({ messageId: `wamid.${++n}`, from, timestampMs: h.clock.t, buttonId });
const last = () => h.sender.sent.at(-1)!;

/** Creates an enrolled, unlocked WhatsApp admin and returns its TOTP seed. */
async function enrolled(role: "ADMIN" | "WHATSAPP_ADMIN" | "READ_ONLY_ADMIN" = "WHATSAPP_ADMIN", unlock = true) {
  const by = await makeAdmin(h, "owner" + ++n);
  const w = await h.c.waAdmins.create(by, PHONE, "Mohammad", role);
  await h.c.wa.handle(msg(`enroll ${w.enrollmentCode}`));
  if (unlock) {
    h.clock.t += 31_000;
    await h.c.wa.handle(msg(`unlock ${totpNow(w.totpSecret, h.clock.t)}`));
  }
  return w;
}

beforeEach(async () => {
  h = await harness();
});

describe("webhook authentication", () => {
  const raw = Buffer.from(JSON.stringify({ entry: [] }));
  it("verifies Meta's X-Hub-Signature-256 over the exact bytes", () => {
    const good = "sha256=" + hmacHex("app-secret", raw);
    expect(verifyMetaSignature(raw, good, "app-secret")).toBe(true);
    expect(verifyMetaSignature(raw, good, "other-secret")).toBe(false);
    expect(verifyMetaSignature(Buffer.from(raw.toString() + " "), good, "app-secret")).toBe(false);
    expect(verifyMetaSignature(raw, undefined, "app-secret")).toBe(false);
    expect(verifyMetaSignature(raw, good, undefined)).toBe(false);
  });
  it("gateway signature binds the timestamp and rejects replays outside the window", () => {
    const ts = String(Math.floor(h.clock.t / 1000));
    const sig = hmacHex(GATEWAY_SECRET, `${ts}.${raw.toString()}`);
    expect(verifyGatewaySignature(raw, ts, sig, GATEWAY_SECRET, h.clock.t)).toBe(true);
    expect(verifyGatewaySignature(raw, ts, sig, GATEWAY_SECRET, h.clock.t + 120_000)).toBe(false);
    expect(verifyGatewaySignature(raw, String(Number(ts) + 1), sig, GATEWAY_SECRET, h.clock.t)).toBe(false);
    expect(verifyGatewaySignature(raw, ts, sig, undefined, h.clock.t)).toBe(false);
  });

  const body = (text: string) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [{ id: "wamid.http1", from: PHONE, timestamp: String(Math.floor(h.clock.t / 1000)), type: "text", text: { body: text } }] } }] }] });
  const signed = (payload: object, secret = GATEWAY_SECRET) => {
    const rawBody = JSON.stringify(payload);
    const ts = String(Math.floor(h.clock.t / 1000));
    return { rawBody, headers: { "content-type": "application/json", "x-isp-timestamp": ts, "x-isp-signature": hmacHex(secret, `${ts}.${rawBody}`) } };
  };

  it("rejects a forged signature, records it, and never reaches the controller", async () => {
    const s = signed(body("hi"), "wrong-secret-wrong-secret-wrong-secret");
    const r = await h.app.inject({ method: "POST", url: "/internal/v1/whatsapp/events", headers: s.headers, payload: s.rawBody });
    expect(r.statusCode).toBe(401);
    expect(h.sender.sent).toHaveLength(0);
    expect((await h.c.db.query("SELECT 1 FROM system_events WHERE event_type='WA_SIGNATURE_INVALID'")).rowCount).toBe(1);
    expect((await h.c.db.query("SELECT 1 FROM wa_inbound")).rowCount).toBe(0);
  });
  it("rejects an unsigned request and a malformed payload", async () => {
    expect((await h.app.inject({ method: "POST", url: "/internal/v1/whatsapp/events", headers: { "content-type": "application/json" }, payload: "{}" })).statusCode).toBe(401);
    const bad = signed({ entry: "nope" });
    expect((await h.app.inject({ method: "POST", url: "/internal/v1/whatsapp/events", headers: bad.headers, payload: bad.rawBody })).statusCode).toBe(400);
  });
  it("accepts a correctly signed message from an enrolled admin and answers it", async () => {
    await enrolled();
    const s = signed(body("hi"));
    const r = await h.app.inject({ method: "POST", url: "/internal/v1/whatsapp/events", headers: s.headers, payload: s.rawBody });
    expect(r.statusCode).toBe(200);
    expect(last().body).toMatch(/ISP admin/);
  });
  it("extractMessages skips unsupported types and rejects malformed ones", () => {
    expect(extractMessages({ entry: [{ changes: [{ value: { messages: [{ id: "a", from: "96171234567", timestamp: "1", type: "image" }] } }] }] })).toBeNull();
    expect(extractMessages({ entry: [{ changes: [{ value: {} }] }] })).toEqual([]);
  });
});

describe("sender identity", () => {
  it("is silent to an unknown number and records it, without revealing an admin channel", async () => {
    await h.c.wa.handle(msg("customer 1001", "96170000000"));
    expect(h.sender.sent).toHaveLength(0);
    expect((await h.c.db.query("SELECT 1 FROM system_events WHERE event_type='WA_UNKNOWN_SENDER'")).rowCount).toBe(1);
    expect(h.providers.calls).toHaveLength(0);
  });
  it("a PENDING admin gets no help and no data until the enrolment code is sent", async () => {
    const by = await makeAdmin(h, "owner");
    await h.c.waAdmins.create(by, PHONE, "Mohammad", "WHATSAPP_ADMIN");
    await h.c.wa.handle(msg("customer 1001"));
    await h.c.wa.handle(msg("enroll 00000000"));
    expect(h.sender.sent).toHaveLength(0);
    expect(h.providers.calls).toHaveLength(0);
  });
  it("the enrolment code is single-use and expires", async () => {
    const by = await makeAdmin(h, "owner");
    const w = await h.c.waAdmins.create(by, PHONE, "M", "WHATSAPP_ADMIN");
    h.clock.t += 31 * 60_000;
    await h.c.wa.handle(msg(`enroll ${w.enrollmentCode}`));
    expect((await h.c.waAdmins.byPhone(PHONE))!.status).toBe("PENDING");
  });
  it("an enrolled number is still locked until a valid TOTP, and a code cannot be replayed", async () => {
    const w = await enrolled("WHATSAPP_ADMIN", false);
    await h.c.wa.handle(msg("customer 1001"));
    expect(last().body).toMatch(/Locked/);
    expect(h.providers.calls).toHaveLength(0);
    await h.c.wa.handle(msg("unlock 000000"));
    expect(last().body).toMatch(/did not work/);
    h.clock.t += 31_000;
    const code = totpNow(w.totpSecret, h.clock.t);
    await h.c.wa.handle(msg(`unlock ${code}`));
    expect(last().body).toMatch(/Unlocked/);
    await h.c.wa.handle(msg("lock"));
    await h.c.wa.handle(msg(`unlock ${code}`)); // same step again
    expect(last().body).toMatch(/did not work/);
  });
  it("the unlocked session expires after idle time", async () => {
    await enrolled();
    h.clock.t += 16 * 60_000;
    await h.c.wa.handle(msg("customer 1001"));
    expect(last().body).toMatch(/Locked/);
  });
  it("brute-forcing the unlock code is rate limited", async () => {
    await enrolled("WHATSAPP_ADMIN", false);
    for (let i = 0; i < 8; i++) await h.c.wa.handle(msg(`unlock ${String(i).padStart(6, "0")}`));
    const rejected = h.sender.sent.filter((s) => /did not work/.test(s.body)).length;
    expect(rejected).toBeLessThanOrEqual(5);
  });
  it("a disabled admin is silenced immediately", async () => {
    const w = await enrolled();
    await h.c.waAdmins.setStatus("00000000-0000-0000-0000-000000000000", w.id, "DISABLED").catch(() => undefined);
    await h.c.db.query("UPDATE whatsapp_admins SET status='DISABLED'");
    const before = h.sender.sent.length;
    await h.c.wa.handle(msg("customer 1001"));
    expect(h.sender.sent).toHaveLength(before);
  });
});

describe("message hygiene", () => {
  it("drops a duplicate delivery of the same message id", async () => {
    await enrolled();
    const m = msg("customer 1001");
    await h.c.wa.handle(m);
    const n1 = h.sender.sent.length;
    await h.c.wa.handle(m);
    expect(h.sender.sent).toHaveLength(n1);
  });
  it("drops a stale message (replay of an old capture)", async () => {
    await enrolled();
    const before = h.sender.sent.length;
    await h.c.wa.handle({ ...msg("customer 1001"), timestampMs: h.clock.t - 10 * 60_000 });
    expect(h.sender.sent).toHaveLength(before);
  });
});

describe("conversation", () => {
  it("shows a concise customer card with real buttons and a Back action, never numbered menus", async () => {
    await enrolled();
    await h.c.wa.handle(msg("customer 1001"));
    const m = last();
    expect(m.kind).toBe("buttons");
    expect(m.body).toMatch(/Test Customer One/);
    expect(m.body).not.toMatch(/reply\s+\d|press\s+\d/i);
    expect(m.buttons!.map((b) => b.title)).toContain("Back");
    expect(m.buttons!.length).toBeLessThanOrEqual(3);
    expect(m.body).not.toMatch(/192\.168|secret|password/i);
  });
  it("find with several matches returns a list that ends with Back", async () => {
    await enrolled();
    await h.c.wa.handle(msg("find test customer"));
    expect(last().kind).toBe("list");
    expect(last().rows!.at(-1)!.title).toBe("Back");
  });
  it("suspend asks for confirmation first; only the button executes it", async () => {
    await enrolled();
    await h.c.wa.handle(msg("suspend user1001"));
    const ask = last();
    expect(ask.body).toMatch(/Confirm suspend/i);
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
    const confirm = ask.buttons!.find((b) => /^ok:/.test(b.id))!;
    await h.c.wa.handle(tap(confirm.id));
    expect(last().body).toMatch(/✔/);
    expect(h.providers.data.get("1001")!.status).toBe("SUSPENDED");
  });
  it("typing yes or confirm in free text never executes anything", async () => {
    await enrolled();
    await h.c.wa.handle(msg("suspend user1001"));
    for (const t of ["yes", "confirm", "ok", "CONFIRM SUSPEND"]) await h.c.wa.handle(msg(t));
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
  });
  it("a redelivered confirm tap executes once", async () => {
    await enrolled();
    await h.c.wa.handle(msg("suspend user1001"));
    const id = last().buttons!.find((b) => /^ok:/.test(b.id))!.id;
    await h.c.wa.handle(tap(id));
    await h.c.wa.handle(tap(id));
    expect(h.providers.calls.filter((c) => c === "radius.disable")).toHaveLength(1);
    expect(last().body).toMatch(/already processed/);
  });
  it("Cancel leaves the customer untouched", async () => {
    await enrolled();
    await h.c.wa.handle(msg("suspend user1001"));
    await h.c.wa.handle(tap(last().buttons!.find((b) => /^no:/.test(b.id))!.id));
    expect(last().body).toMatch(/Cancelled/);
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
  });
  it("a forged button id for another admin's pending action does nothing", async () => {
    await enrolled();
    await h.c.wa.handle(msg("suspend user1001"));
    const pid = last().buttons!.find((b) => /^ok:/.test(b.id))!.id.slice(3);
    const by = await makeAdmin(h, "owner-b");
    const w2 = await h.c.waAdmins.create(by, "96179999999", "Other", "WHATSAPP_ADMIN");
    await h.c.wa.handle(msg(`enroll ${w2.enrollmentCode}`, "96179999999"));
    h.clock.t += 31_000;
    await h.c.wa.handle(msg(`unlock ${totpNow(w2.totpSecret, h.clock.t)}`, "96179999999"));
    await h.c.wa.handle(tap(btn.confirm(pid), "96179999999"));
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
    expect(last().body).not.toMatch(/✔/);
  });
  it("READ_ONLY admins can look but not act, and are not offered the action buttons", async () => {
    await enrolled("READ_ONLY_ADMIN");
    await h.c.wa.handle(msg("suspend user1001"));
    expect(h.providers.data.get("1001")!.status).toBe("ACTIVE");
    await h.c.wa.handle(tap(btn.view("actions", "1001")));
    expect(last().buttons!.some((b) => /^a:/.test(b.id))).toBe(false);
    await h.c.wa.handle(msg("customer 1001"));
    expect(last().body).toMatch(/user1001/);
  });
  it("Back returns to the previous customer view, then home", async () => {
    await enrolled();
    await h.c.wa.handle(msg("customer 1001"));
    await h.c.wa.handle(tap(btn.view("payment", "1001")));
    expect(last().body).toMatch(/payments/i);
    await h.c.wa.handle(tap(btn.nav("back")));
    expect(last().body).toMatch(/Test Customer One/);
  });
  it("hides internals when the ISP system is down", async () => {
    await enrolled();
    h.providers.failNext = "get";
    await h.c.wa.handle(msg("customer 1001"));
    expect(last().body).toBe("Service temporarily unavailable.");
  });
  it("the kill switch stops WhatsApp actions while lookups still work", async () => {
    await enrolled();
    await h.c.gate.set({ allWrites: false, whatsappWrites: true, radiusWrites: false }, "owner");
    await h.c.wa.handle(msg("suspend user1001"));
    expect(last().body).toMatch(/disabled/i);
    await h.c.wa.handle(msg("customer 1001"));
    expect(last().body).toMatch(/user1001/);
  });
});

describe("parser and the AI boundary", () => {
  it("understands structured and equivalent wording", () => {
    expect(parseText("customer 12345")).toEqual({ kind: "CUSTOMER", query: "12345" });
    expect(parseText("find mohammad")).toEqual({ kind: "FIND", query: "mohammad" });
    expect(parseText("check abc123")).toEqual({ kind: "CUSTOMER", query: "abc123" });
    expect(parseText("active sessions abc123")).toEqual({ kind: "VIEW", view: "sessions", query: "abc123" });
    expect(parseText("payment 12345")).toMatchObject({ view: "payment" });
    expect(parseText("expiring this week")).toEqual({ kind: "EXPIRING", range: "week" });
    expect(parseText("Suspend   abc123")).toEqual({ kind: "ACTION", action: "SUSPEND", query: "abc123" });
    expect(parseText("back")).toEqual({ kind: "BACK" });
    expect(parseText("home")).toEqual({ kind: "HOME" });
  });
  it("refuses an action with no valid target or an injected one", () => {
    expect(parseText("suspend")).toEqual({ kind: "UNKNOWN" });
    expect(parseText("suspend abc; drop table")).toEqual({ kind: "UNKNOWN" });
    expect(parseText("suspend all")).toMatchObject({ kind: "ACTION", query: "all" }); // a literal id; the backend will not find it
  });
  it("the schema has no confirm intent, so a model cannot confirm anything", () => {
    for (const bad of [{ kind: "CONFIRM", pendingId: "x" }, { kind: "ACTION", action: "TERMINATE", query: "1" }, { kind: "ACTION", action: "SUSPEND", query: "1", extra: true }, { kind: "ACTION", action: "SUSPEND" }])
      expect(intentSchema.safeParse(bad).success).toBe(false);
  });
  it("model output is validated; garbage and tool-call attempts fall back to UNKNOWN", async () => {
    expect(await interpret("please cut off the guy 1001", { interpret: async () => ({ kind: "ACTION", action: "SUSPEND", query: "1001" }) })).toEqual({ kind: "ACTION", action: "SUSPEND", query: "1001" });
    expect(await interpret("zzz", { interpret: async () => ({ kind: "RUN_SQL", sql: "DROP TABLE x" }) })).toEqual({ kind: "UNKNOWN" });
    expect(await interpret("zzz", { interpret: async () => { throw new Error("model down"); } })).toEqual({ kind: "UNKNOWN" });
    expect(await interpret("zzz", { interpret: async () => ({ kind: "ACTION", action: "SUSPEND", query: "x; y" }) })).toEqual({ kind: "UNKNOWN" });
  });
  it("a model-proposed action still needs the confirm button", async () => {
    const ai = await harness();
    const sender = ai.sender;
    const { createContainer } = await import("../src/container.js");
    const c = await createContainer(ai.cfg, { db: ai.c.db, providers: ai.providers, sender, now: () => ai.clock.t, ai: { interpret: async () => ({ kind: "ACTION", action: "SUSPEND", query: "1001" }) } });
    const by = await makeAdmin(ai, "owner-ai");
    const w = await c.waAdmins.create(by, PHONE, "M", "WHATSAPP_ADMIN");
    await c.wa.handle({ messageId: "wamid.ai.1", from: PHONE, timestampMs: ai.clock.t, text: `enroll ${w.enrollmentCode}` });
    ai.clock.t += 31_000;
    await c.wa.handle({ messageId: "wamid.ai.2", from: PHONE, timestampMs: ai.clock.t, text: `unlock ${totpNow(w.totpSecret, ai.clock.t)}` });
    await c.wa.handle({ messageId: "wamid.ai.3", from: PHONE, timestampMs: ai.clock.t, text: "kindly disconnect that gentleman now" });
    expect(sender.sent.at(-1)!.body).toMatch(/Confirm suspend/i);
    expect(ai.providers.data.get("1001")!.status).toBe("ACTIVE");
  });
  it("only backend-shaped button ids parse", () => {
    expect(parseButton("a:SUSPEND:1001")).toMatchObject({ kind: "ACTION" });
    for (const bad of ["a:TERMINATE:1001", "a:SUSPEND:1001;x", "ok:not-a-uuid", "v:profile:", "sh:rm -rf", ""]) expect(parseButton(bad)).toBeNull();
  });
});
