// No AI work for a caller without an active paid subscription.
//
// Three layers, each pinned here:
//
//   1. the decision — `ai_subscription_gate` in SQL, executed for real under
//      PGlite by scripts/sql/ai-subscription-gate-scenarios.mjs (every
//      subscription state, the one-notice race, re-arming, grants); this file
//      pins its plan list to the client's;
//   2. the TypeScript gate — `_shared/subscriptionGate.ts`: only the literal
//      'authorized' passes, every failure refuses, nothing the caller sends is
//      read, and the refusal carries nothing internal;
//   3. the placement — every user-facing AI entry point asks the gate before
//      any limit, VX charge, tool or provider, and every function that can
//      reach a provider is either gated or on a short, reasoned exempt list.
//
// The scenario block drives an entry point shaped like the real ones against
// an in-memory gate with the same semantics as the SQL, and counts what would
// have cost money. For every refused case: provider calls, tool runs, billable
// operations and VX all stay at zero.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type GateDb,
  isAuthorized,
  readGateVerdict,
  requireActiveSubscription,
  subscriptionGate,
  subscriptionGateResponse,
} from "../../supabase/functions/_shared/subscriptionGate.ts";
import {
  gateAllowsAccountTurn,
  subscriptionRequiredNotice,
  subscriptionRequiredShortNotice,
  PLANS_URL,
} from "../../supabase/functions/_shared/whatsappEntitlements.ts";
import { UI_STRINGS } from "../../supabase/functions/_shared/whatsappStrings.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";
import { PAID_PLAN_ORDER } from "@/lib/billing/plans";
import {
  installSubscriptionGateObserver,
  isSubscriptionGateNotice,
  SUBSCRIPTION_GATE_EVENT,
} from "@/lib/billing/subscriptionGateObserver";

const MIGRATION = "supabase/migrations/20261062000000_ai_subscription_gate.sql";
const FUNCTIONS = "supabase/functions";

// ── An in-memory gate with the SQL's semantics ───────────────────────────────

type Sub = { plan: string; status: "active" | "cancelled" | "expired" | "past_due"; endsInDays: number };

interface World {
  subs: Record<string, Sub[]>;
  admins: Set<string>;
  trials: Set<string>;
  vx: Record<string, number>;
  pendingOrders: Set<string>;
  linkedPhones: Record<string, string>;
  ownerPhone: string;
  notices: Set<string>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  failWith?: unknown;
}

const PAID = new Set<string>(PAID_PLAN_ORDER);

function world(): World {
  return {
    subs: {}, admins: new Set(), trials: new Set(), vx: {}, pendingOrders: new Set(),
    linkedPhones: {}, ownerPhone: "96170000001", notices: new Set(), rpcCalls: [],
  };
}

function entitled(w: World, userId: string | null): boolean {
  if (!userId) return false;
  if (w.admins.has(userId)) return true;
  // Trials, VX and pending orders are deliberately not consulted.
  return (w.subs[userId] ?? []).some((s) => s.status === "active" && s.endsInDays > 0 && PAID.has(s.plan));
}

function gateSql(w: World, channel: string, subject: string, userId: string | null): string {
  if (!subject?.trim()) return "blocked_silent";
  const key = `${channel}|${subject}`;
  if (entitled(w, userId)) {
    w.notices.delete(key);
    return "authorized";
  }
  if (w.notices.has(key)) return "blocked_silent";
  w.notices.add(key);
  return "blocked_first_notice";
}

function fakeDb(w: World): GateDb {
  return {
    rpc(fn, args) {
      w.rpcCalls.push({ fn, args });
      if (w.failWith) return Promise.resolve({ data: null, error: w.failWith });
      if (fn === "ai_subscription_gate") {
        return Promise.resolve({
          data: gateSql(w, args._channel as string, args._subject as string, (args._user_id as string) ?? null),
          error: null,
        });
      }
      if (fn === "ai_subscription_gate_whatsapp") {
        const phone = args._wa_phone as string;
        if (phone === w.ownerPhone) return Promise.resolve({ data: "authorized", error: null });
        return Promise.resolve({ data: gateSql(w, "whatsapp", phone, w.linkedPhones[phone] ?? null), error: null });
      }
      return Promise.resolve({ data: null, error: { code: "42883" } });
    },
  };
}

// ── An entry point shaped like the real ones ─────────────────────────────────

interface Meter {
  provider: number;
  fallback: number;
  tools: number;
  billable: number;
  vx: number;
  replies: string[];
}

const meter = (): Meter => ({ provider: 0, fallback: 0, tools: 0, billable: 0, vx: 0, replies: [] });

/**
 * Website/API: verified user id → gate → daily limit → VX → provider (with a
 * fallback) → tools. The body may carry spoofed fields; the handler, like the
 * real ones, never passes them to the gate.
 */
async function webEntryPoint(w: World, m: Meter, req: Request, verifiedUserId: string | null, kind: string) {
  const refused = await subscriptionGate(fakeDb(w), req, verifiedUserId, {});
  if (refused) return refused;
  m.billable++;
  m.vx += 10;
  m.provider++;
  if (kind === "fallback") m.fallback++;
  if (kind === "tool" || kind === "agent" || kind === "workflow") m.tools++;
  return new Response("{}", { status: 200 });
}

/** WhatsApp: signed sender → gate → (one notice as text) or the work. */
async function whatsappEntryPoint(w: World, m: Meter, from: string, text: string, media = false) {
  const verdict = await requireActiveSubscription(fakeDb(w), { channel: "whatsapp", waPhone: from });
  if (!isAuthorized(verdict)) {
    if (verdict === "blocked_first_notice") m.replies.push(subscriptionRequiredNotice("en"));
    return;
  }
  if (media) m.provider++; // transcription / vision
  m.provider++;
  m.billable++;
  m.vx += 1;
  m.replies.push("answer");
}

const request = (headers: Record<string, string> = {}, body: unknown = { prompt: "hi" }) =>
  new Request("https://example.test/functions/v1/ai-chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.9", ...headers },
    body: JSON.stringify(body),
  });

function expectNothingSpent(m: Meter) {
  expect(m.provider).toBe(0);
  expect(m.fallback).toBe(0);
  expect(m.tools).toBe(0);
  expect(m.billable).toBe(0);
  expect(m.vx).toBe(0);
}

async function bodyOf(r: Response) {
  return JSON.parse(await r.text()) as Record<string, unknown>;
}

describe("the twenty-five scenarios", () => {
  it("1–2: a new unsubscribed website user is told once, then refused silently", async () => {
    const w = world(), m = meter();
    const first = await webEntryPoint(w, m, request(), "u1", "chat");
    expect(first.status).toBe(403);
    expect(await bodyOf(first)).toMatchObject({ error: "subscription_required", notify: true });
    const second = await webEntryPoint(w, m, request(), "u1", "chat");
    expect(second.status).toBe(403);
    expect(await bodyOf(second)).toMatchObject({ error: "subscription_required", notify: false });
    expectNothingSpent(m);
  });

  it("3–4: a new unsubscribed WhatsApp sender gets one notice, then no reply at all", async () => {
    const w = world(), m = meter();
    await whatsappEntryPoint(w, m, "96171111111", "hello");
    await whatsappEntryPoint(w, m, "96171111111", "what's the weather");
    await whatsappEntryPoint(w, m, "96171111111", "", true);
    expect(m.replies).toHaveLength(1);
    expect(m.replies[0]).toContain(PLANS_URL);
    expectNothingSpent(m);
  });

  it("5: ten simultaneous WhatsApp messages produce exactly one notice", async () => {
    const w = world(), m = meter();
    await Promise.all(Array.from({ length: 10 }, () => whatsappEntryPoint(w, m, "96172222222", "hi")));
    expect(m.replies).toHaveLength(1);
    expectNothingSpent(m);
  });

  it("6: subscribing after the notice restores access with no support step", async () => {
    const w = world(), m = meter();
    await whatsappEntryPoint(w, m, "96173333333", "hi");
    w.linkedPhones["96173333333"] = "u6";
    w.subs.u6 = [{ plan: "basic", status: "active", endsInDays: 30 }];
    await whatsappEntryPoint(w, m, "96173333333", "hi again");
    expect(m.replies).toEqual([subscriptionRequiredNotice("en"), "answer"]);
    const web = await webEntryPoint(w, meter(), request(), "u6", "chat");
    expect(web.status).toBe(200);
  });

  it("7: an active subscriber on every paid plan is served", async () => {
    for (const plan of PAID_PLAN_ORDER) {
      const w = world(), m = meter();
      w.subs.u7 = [{ plan, status: "active", endsInDays: 10 }];
      expect((await webEntryPoint(w, m, request(), "u7", "chat")).status).toBe(200);
      expect(m.provider).toBe(1);
    }
  });

  const refusedStates: Array<[string, (w: World) => void]> = [
    ["8: expired subscription", (w) => { w.subs.u = [{ plan: "pro", status: "expired", endsInDays: -1 }]; }],
    ["8b: active row past its end date", (w) => { w.subs.u = [{ plan: "pro", status: "active", endsInDays: 0 }]; }],
    ["9: cancelled subscription", (w) => { w.subs.u = [{ plan: "pro", status: "cancelled", endsInDays: 20 }]; }],
    ["10: payment failed (past_due)", (w) => { w.subs.u = [{ plan: "pro", status: "past_due", endsInDays: 20 }]; }],
    ["11: incomplete checkout (pending order only)", (w) => { w.pendingOrders.add("u"); }],
    ["12: VX balance but no subscription", (w) => { w.vx.u = 1_000_000; }],
    ["trial week only", (w) => { w.trials.add("u"); }],
    ["retired legacy plan", (w) => { w.subs.u = [{ plan: "legacy_basic", status: "active", endsInDays: 20 }]; }],
  ];
  for (const [label, arrange] of refusedStates) {
    it(`${label} is refused before anything is spent`, async () => {
      const w = world(), m = meter();
      arrange(w);
      const r = await webEntryPoint(w, m, request(), "u", "chat");
      expect(r.status).toBe(403);
      expectNothingSpent(m);
    });
  }

  it("13–14: spoofed subscription status, plan, role and entitlement are ignored", async () => {
    const w = world(), m = meter();
    const spoofed = request(
      {
        "x-subscription-status": "active",
        "x-plan": "business",
        "x-is-subscribed": "true",
        "x-role": "admin",
        "x-user-id": "admin-user",
      },
      { prompt: "hi", plan: "business", is_subscribed: true, subscription_status: "active", role: "admin", is_admin: true, entitlement: "all", user_id: "admin-user" },
    );
    w.admins.add("admin-user");
    const r = await webEntryPoint(w, m, spoofed, "u13", "chat");
    expect(r.status).toBe(403);
    expectNothingSpent(m);
    // The gate was asked about the verified caller and nobody else.
    expect(w.rpcCalls).toEqual([
      { fn: "ai_subscription_gate", args: { _channel: "web", _subject: "u13", _user_id: "u13" } },
    ]);
  });

  it("15: a direct API call with no session is an anonymous caller, refused", async () => {
    // The anonymous identity is keyed with the service key, as in production.
    const g = globalThis as { Deno?: unknown };
    const previous = g.Deno;
    g.Deno = { env: { get: () => "test-service-key" } };
    const w = world(), m = meter();
    const r1 = await webEntryPoint(w, m, request(), null, "chat");
    const r2 = await webEntryPoint(w, m, request(), null, "chat");
    expect(await bodyOf(r1)).toMatchObject({ error: "subscription_required", notify: true });
    expect(await bodyOf(r2)).toMatchObject({ error: "subscription_required", notify: false });
    expectNothingSpent(m);
    // Keyed by a hash of the address, never the address itself.
    const subject = w.rpcCalls[0].args._subject as string;
    expect(w.rpcCalls[0].args._channel).toBe("web_anon");
    expect(subject).toMatch(/^[0-9a-f]{64}$/);
    expect(subject).not.toContain("203.0.113.9");
    g.Deno = previous;
  });

  const kinds = [
    ["16: provider routing", "route"], ["17: provider fallback", "fallback"], ["18: tool execution", "tool"],
    ["19: agent execution", "agent"], ["20: voice", "voice"], ["21: image", "image"], ["22: video", "video"],
    ["23: search", "search"], ["24: sourcing", "sourcing"], ["25: automation / workflow", "workflow"],
  ] as const;
  for (const [label, kind] of kinds) {
    it(`${label} request from an unsubscribed caller never runs`, async () => {
      const w = world(), m = meter();
      expect((await webEntryPoint(w, m, request(), "u", kind)).status).toBe(403);
      expect((await webEntryPoint(w, m, request(), null, kind)).status).toBe(403);
      expectNothingSpent(m);
    });
  }

  it("admins and the owner handset are served; a moderator is not", async () => {
    const w = world();
    w.admins.add("staff");
    expect((await webEntryPoint(w, meter(), request(), "staff", "chat")).status).toBe(200);
    expect((await webEntryPoint(w, meter(), request(), "moderator", "chat")).status).toBe(403);
    const m = meter();
    await whatsappEntryPoint(w, m, w.ownerPhone, "hi");
    expect(m.replies).toEqual(["answer"]);
  });
});

describe("the TypeScript gate fails closed", () => {
  it("only the literal 'authorized' authorizes", () => {
    expect(readGateVerdict("authorized", null)).toBe("authorized");
    for (const data of [true, "AUTHORIZED", "authorised", { verdict: "authorized" }, null, undefined, 1]) {
      expect(isAuthorized(readGateVerdict(data, null))).toBe(false);
    }
    expect(readGateVerdict("authorized", { code: "42501" })).toBe("unavailable");
  });

  it("a database error or a throw is a refusal (503), never a pass", async () => {
    const w = world();
    w.failWith = { code: "PGRST" };
    expect(await requireActiveSubscription(fakeDb(w), { channel: "web", userId: "u" })).toBe("unavailable");
    const throwing: GateDb = { rpc: () => { throw new Error("down"); } };
    expect(await requireActiveSubscription(throwing, { channel: "whatsapp", waPhone: "1" })).toBe("unavailable");
    const r = await subscriptionGate(fakeDb(w), request(), "u", {});
    expect(r?.status).toBe(503);
  });

  it("an empty identity is refused without asking", async () => {
    const w = world();
    expect(await requireActiveSubscription(fakeDb(w), { channel: "whatsapp", waPhone: " " })).toBe("blocked_silent");
    expect(await requireActiveSubscription(fakeDb(w), { channel: "meta", senderId: "" })).toBe("blocked_silent");
    expect(w.rpcCalls).toHaveLength(0);
  });

  it("the refusal says nothing internal and carries no English sentence", async () => {
    for (const verdict of ["blocked_first_notice", "blocked_silent", "unavailable"] as const) {
      const r = subscriptionGateResponse(verdict, { "Access-Control-Allow-Origin": "x" });
      expect(r.headers.get("Access-Control-Allow-Origin")).toBe("x");
      const text = await r.text();
      expect(text).not.toMatch(/openai|gemini|groq|openrouter|bytez|\bfal\b|runpod|\bvx\b|cost|postgres|rpc|plan_id|basic|\bpro\b|business|message/i);
    }
  });
});

describe("the plan list and the migration", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("opens AI for exactly the paid plans the client sells", () => {
    const list = sql.match(/ai_eligible_plans\(\)[\s\S]*?ARRAY\[([^\]]+)\]/)?.[1] ?? "";
    const ids = [...list.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    expect([...ids].sort()).toEqual([...PAID_PLAN_ORDER].sort());
  });

  it("never consults the trial, VX balance or orders when deciding", () => {
    const body = sql.slice(sql.indexOf("FUNCTION public.ai_user_entitled"), sql.indexOf("COMMENT ON FUNCTION public.ai_user_entitled"));
    expect(body).not.toMatch(/trial_expires_at|user_points|subscription_orders|vx/i);
    expect(body).toMatch(/s\.status = 'active'/);
    expect(body).toMatch(/s\.ends_at IS NULL OR s\.ends_at > now\(\)/);
    expect(body).toMatch(/p\.is_active/);
  });

  it("takes the one notice atomically and is callable by the service role only", () => {
    expect(sql).toMatch(/ON CONFLICT \(channel, subject\) DO NOTHING/);
    expect(sql).toMatch(/PRIMARY KEY \(channel, subject\)/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
    for (const fn of ["ai_subscription_gate(text, text, uuid)", "ai_subscription_gate_whatsapp(text)", "ai_user_entitled(uuid)"]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
    }
  });
});

// ── Placement: every entry point asks first ──────────────────────────────────

/** User-facing functions that must call `subscriptionGate` before any cost. */
const GATED = [
  "academy-chat", "ai-chat", "ai-generate", "ai-search", "analyze-image", "analyze-meal",
  "document-generate", "file-convert", "generate-diet-plan", "image-generate", "image-tools-generate",
  "kids-ai-teacher", "kids-drawing-to-art", "kids-story-generate",
  "library-ai-assistant", "library-ai-chat", "library-ai-classify-book", "library-ai-search",
  "library-ai-writing-assistant", "library-build-knowledge-graph", "library-detect-series",
  "library-embed-book", "library-generate-flashcard-deck", "library-generate-narration",
  "library-generate-practice-exam", "library-generate-quotes", "library-generate-reading-plan",
  "library-librarian-chat", "library-librarian-daily-plan", "library-librarian-summary",
  "library-research-assistant", "library-semantic-search", "library-summarize-discussion",
  "library-translate-book-metadata", "library-translate-comment", "ocr-scan", "organization-ai-admin",
  "radar-ai", "realtime-session", "speech-generate", "speech-transcribe", "text-tools-generate",
  "video-studio", "voice-studio",
];

/** Gated through a shared guard rather than in the function file. */
const GATED_VIA = {
  "ai-voice-chat": "guardVoiceRequest(",
  "text-to-speech": "guardVoiceRequest(",
  "career-ai": "handleStructuredCareerAiRequest",
  "whatsapp-webhook": "requireActiveSubscription(",
  "meta-messaging-webhook": "requireActiveSubscription(",
} as const;

/**
 * Functions that reach a provider but are not user-facing AI services. Each
 * reason is the whole argument; adding a name here is a decision to review.
 */
const EXEMPT: Record<string, string> = {
  "analytics-insights": "admin only (has_role admin)",
  "embed-content": "admin only (user_roles admin)",
  "enrich-product": "admin only (has_role admin)",
  "kids-course-generate": "admin only (has_role admin)",
  "owner-control": "admin only (user_roles admin)",
  "provider-hub": "admin/cron; model-list endpoints only",
  "news-generate": "cron secret or admin; no end-user caller",
  "social-publish": "cron secret; no end-user caller",
  "library-process-background-jobs": "cron secret; no end-user caller",
  "health-check": "public model-list probes that generate nothing; generation probes are admin-gated",
  "moderate-content": "safety control, not an AI service: free OpenAI moderation endpoint (no VX); every client caller fails open on refusal, so gating would publish unmoderated kids/library content. JWT required, 8000-char cap",
  "career-system-health": "configuration presence check; calls no provider",
  "career-gdpr-request": "data deletion; calls no provider",
};

const PROVIDER_REACH =
  /_shared\/(aiProvider|meteredFetch|providerRouter|geminiProvider|voice\/|sourcing\/|contentMedia|contentEngine|libraryRag|visionAnalysts|careerAi|generators|openaiModel|whatsappAsk|whatsappAssistant)|api\.openai\.com|api\.elevenlabs|fal\.run|api\.replicate|runpod|lumalabs|api\.groq|openrouter|generativelanguage/;

/** Calls that count, charge or cost. The gate must precede all of them. */
const COSTLY = [
  "chargeDailyLimit(", "check_ai_rate_limit", "check_ai_budget", "check_ai_anon_rate_limit", "allowCaller(",
  "billedRequest(", "maySeeSection(", "meteredFetch(", "createEmbedding(", "streamChatCompletion",
  "handleSourceProducts(", "checkRateLimit(", "synthesize", "transcribe(", "ensureBookIndexed(",
];

const source = (name: string) => readFileSync(`${FUNCTIONS}/${name}/index.ts`, "utf8");
const handlerOf = (text: string) => {
  const start = Math.max(text.indexOf("Deno.serve("), text.indexOf("serve(async"));
  return start >= 0 ? text.slice(start) : text;
};

describe("every user-facing AI entry point asks the gate first", () => {
  for (const name of GATED) {
    it(`${name}: subscriptionGate runs before any limit, charge or provider`, () => {
      const handler = handlerOf(source(name));
      const gate = handler.indexOf("await subscriptionGate(");
      expect(gate, `${name} does not call subscriptionGate`).toBeGreaterThan(-1);
      expect(handler).toMatch(/if \(refused\) return refused;/);
      for (const marker of COSTLY) {
        const at = handler.indexOf(marker);
        if (at >= 0) expect(at, `${name}: ${marker} runs before the gate`).toBeGreaterThan(gate);
      }
    });
  }

  it("the voice guard gates before it charges the quota", () => {
    const access = readFileSync(`${FUNCTIONS}/_shared/voice/access.ts`, "utf8");
    const decide = access.slice(access.indexOf("export async function decideVoiceAccess"));
    expect(decide.indexOf("ports.authorize(")).toBeGreaterThan(-1);
    expect(decide.indexOf("ports.authorize(")).toBeLessThan(decide.indexOf("ports.checkLimit("));
    expect(readFileSync(`${FUNCTIONS}/_shared/voice/guard.ts`, "utf8")).toContain("requireActiveSubscription(");
  });

  it("career AI gates inside the shared authentication, before its rate limit", () => {
    const handler = readFileSync(`${FUNCTIONS}/_shared/careerAiHandler.ts`, "utf8");
    const auth = handler.slice(handler.indexOf("export async function authenticateCareerAiRequest"));
    expect(auth.indexOf("await subscriptionGate(")).toBeGreaterThan(-1);
    expect(auth.indexOf("await subscriptionGate(")).toBeLessThan(auth.indexOf("checkRateLimit("));
  });

  it("no function that can reach a provider is left ungated or unexplained", () => {
    const dirs = readdirSync(FUNCTIONS, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "_shared")
      .map((d) => d.name);
    const unaccounted = dirs.filter((name) => {
      let text = "";
      try { text = source(name); } catch { return false; }
      if (!PROVIDER_REACH.test(text)) return false;
      if (GATED.includes(name) || name in GATED_VIA || name in EXEMPT) return false;
      return true;
    });
    expect(unaccounted).toEqual([]);
    for (const [name, marker] of Object.entries(GATED_VIA)) expect(source(name)).toContain(marker);
  });

  it("the gate never reads a caller-supplied plan, role or subscription field", () => {
    const gate = readFileSync(`${FUNCTIONS}/_shared/subscriptionGate.ts`, "utf8");
    const code = gate.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    expect(code).not.toMatch(/req\.json|headers\.get\(|x-plan|x-subscription|is_subscribed|is_admin|\.role\b/);
  });
});

describe("WhatsApp and Messenger", () => {
  const webhook = source("whatsapp-webhook");

  it("the WhatsApp gate runs after the dedup claim and before every cost", () => {
    const gate = webhook.indexOf("requireActiveSubscription(db, { channel: \"whatsapp\"");
    expect(gate).toBeGreaterThan(webhook.indexOf("claimedMessageId = incoming.messageId;"));
    for (const marker of ['stage = "rate_limit"', 'stage = "onboarding"', 'stage = "media"', 'stage = "transcribe"', 'stage = "route"', "await maySpend()"]) {
      expect(webhook.indexOf(marker), marker).toBeGreaterThan(gate);
    }
  });

  it("the notice is sent as text, never through the spoken reply path", () => {
    const block = webhook.slice(webhook.indexOf('stage = "subscription_gate"'), webhook.indexOf("// ── Abuse control"));
    expect(block).toContain("sendWhatsAppText(");
    expect(block).not.toMatch(/await reply\(/);
    expect(block).toMatch(/verdict === "blocked_first_notice"/);
    // Sent before the account-only branch, so a first "link account" is still told.
    expect(block.indexOf('verdict === "blocked_first_notice"')).toBeLessThan(block.indexOf("if (accountTurn)"));
  });

  it("an account-only pass stops right after the account flow", () => {
    const stop = webhook.indexOf("if (gateAccountOnly) {");
    expect(stop).toBeGreaterThan(webhook.indexOf("const accountIntent = aiFocused"));
    expect(stop).toBeLessThan(webhook.indexOf("const medicineAsk"));
  });

  it("only typed account-linking text passes the gate", () => {
    const base = { text: "link account", hasMedia: false, hasLocation: false, inAccountStep: false, accountIntent: "link" };
    expect(gateAllowsAccountTurn(base)).toBe(true);
    expect(gateAllowsAccountTurn({ ...base, accountIntent: null, inAccountStep: true, text: "123456" })).toBe(true);
    expect(gateAllowsAccountTurn({ ...base, accountIntent: "orders" })).toBe(false);
    expect(gateAllowsAccountTurn({ ...base, accountIntent: null })).toBe(false);
    expect(gateAllowsAccountTurn({ ...base, hasMedia: true })).toBe(false);
    expect(gateAllowsAccountTurn({ ...base, hasLocation: true })).toBe(false);
    expect(gateAllowsAccountTurn({ ...base, wantsVoice: true })).toBe(false);
    expect(gateAllowsAccountTurn({ ...base, hasSelection: true, inAccountStep: true })).toBe(false);
    expect(gateAllowsAccountTurn({ ...base, text: "  " })).toBe(false);
  });

  it("both notices exist in every WhatsApp language and carry the plans link", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(UI_STRINGS.subscriptionRequired[language], language).toBeTruthy();
      expect(UI_STRINGS.subscriptionRequiredShort[language], language).toBeTruthy();
      expect(subscriptionRequiredNotice(language)).toContain(PLANS_URL);
      expect(subscriptionRequiredShortNotice(language)).toContain(PLANS_URL);
    }
    expect(subscriptionRequiredNotice("ar")).not.toBe(subscriptionRequiredNotice("en"));
  });

  it("Messenger/Instagram gates before the welcome and the model", () => {
    const meta = source("meta-messaging-webhook");
    const gate = meta.indexOf("requireActiveSubscription(db, {");
    expect(gate).toBeGreaterThan(meta.indexOf('from("meta_messages").insert'));
    expect(gate).toBeLessThan(meta.indexOf("await reply(welcomeFor(language)"));
    expect(gate).toBeLessThan(meta.indexOf("streamChatCompletionWithFallback({"));
  });
});

describe("the website hears the one notice", () => {
  it("recognises only the notice-bearing refusal", () => {
    expect(isSubscriptionGateNotice({ error: "subscription_required", notify: true })).toBe(true);
    expect(isSubscriptionGateNotice({ error: "subscription_required", notify: false })).toBe(false);
    expect(isSubscriptionGateNotice({ error: "plan_required" })).toBe(false);
    expect(isSubscriptionGateNotice(null)).toBe(false);
  });

  it("announces once per notice and passes every response through untouched", async () => {
    const events: string[] = [];
    const target = new EventTarget() as unknown as typeof globalThis;
    const bodies = [
      { status: 403, body: { error: "subscription_required", notify: true } },
      { status: 403, body: { error: "subscription_required", notify: false } },
      { status: 200, body: { ok: true } },
    ];
    let i = 0;
    (target as { fetch: typeof fetch }).fetch = async () => {
      const b = bodies[i++];
      return new Response(JSON.stringify(b.body), { status: b.status });
    };
    target.addEventListener(SUBSCRIPTION_GATE_EVENT, () => events.push("notice"));
    installSubscriptionGateObserver(target);
    installSubscriptionGateObserver(target); // idempotent
    const url = "https://x.supabase.co/functions/v1/ai-chat";
    const r1 = await target.fetch(url);
    const r2 = await target.fetch(url);
    const r3 = await target.fetch(url);
    await new Promise((r) => setTimeout(r, 0));
    expect(events).toEqual(["notice"]);
    expect((await r1.json()).notify).toBe(true);
    expect(r2.status).toBe(403);
    expect(r3.status).toBe(200);
  });

  it("is installed before the Supabase client is created", () => {
    const main = readFileSync("src/main.tsx", "utf8");
    const firstImport = main.split("\n").find((l) => l.startsWith("import "));
    expect(firstImport).toContain("subscriptionGateObserver");
  });
});
