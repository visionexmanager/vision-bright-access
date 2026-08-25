// Phase 7 — answering exactly once, even when something goes wrong halfway.
//
// The failure being fixed is the worst one this system has, and it is silence.
// A delivery that died mid-flight left the message claimed, Meta redelivered
// it, the claim collided, and the retry was discarded as a duplicate — so the
// mechanism that made retries safe was also the one that made recovery
// impossible. A sighted user rereads the thread and sends it again; a blind
// user has nothing to reread and no way to tell whether to wait.
//
// The decision is a pure function of a row and a clock, so all three of its
// answers are driven here directly, against the real module.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { SessionState } from "../../supabase/functions/_shared/whatsappSession.ts";
import type { ReplyTransport } from "../../supabase/functions/_shared/whatsappVoiceReply.ts";

const reliability = await import("../../supabase/functions/_shared/whatsappReliability.ts");
const sessions = await import("../../supabase/functions/_shared/whatsappSession.ts");
const engine = await import("../../supabase/functions/_shared/whatsappEngine.ts");
const ask = await import("../../supabase/functions/_shared/whatsappAsk.ts");
const voice = await import("../../supabase/functions/_shared/whatsappVoiceReply.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260924000000_whatsapp_processing_recovery.sql",
  "utf8",
);

const NOW = Date.parse("2026-08-25T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

// ── 1. Deduplication still deduplicates ──────────────────────────────────────

describe("deduplication", () => {
  it("skips a redelivery of a message that was fully handled", () => {
    const decision = reliability.claimDecision(
      { processing_state: "done", processing_started_at: ago(5_000) },
      NOW,
    );
    expect(decision).toEqual({ action: "skip", reason: "already_done" });
  });

  it("skips a redelivery while another delivery is still working on it", () => {
    const decision = reliability.claimDecision(
      { processing_state: "processing", processing_started_at: ago(2_000) },
      NOW,
    );
    expect(decision).toEqual({ action: "skip", reason: "in_flight" });
  });

  it("treats a finished message as finished however old it is", () => {
    const decision = reliability.claimDecision(
      { processing_state: "done", processing_started_at: ago(400 * 24 * 3_600_000) },
      NOW,
    );
    expect(decision.action).toBe("skip");
  });

  it("still relies on the unique index, which the migration leaves alone", () => {
    expect(migration).not.toMatch(/drop\s+index/i);
    expect(migration).not.toMatch(/wa_message_id/i.source ? /alter[\s\S]*wa_message_id[\s\S]*drop/i : /$^/);
    expect(webhook).toContain('if (dupe.code !== "23505") throw dupe;');
  });
});

// ── 2. The claim is taken before anything expensive ──────────────────────────

describe("the claim comes first", () => {
  const claimAt = webhook.indexOf("const claimedAt = new Date().toISOString();");

  it("claims before transcription", () => {
    expect(claimAt).toBeGreaterThan(0);
    expect(claimAt).toBeLessThan(webhook.indexOf("voiceToText("));
  });

  it("claims before any model call", () => {
    for (const expensive of [
      "askAssistant(",
      "retrieveKnowledge(",
      "structuredCompletionWithFallback(",
      "streamChatCompletionWithFallback(",
      "understandImage(",
      "understandDocument(",
    ]) {
      expect(claimAt, expensive).toBeLessThan(webhook.indexOf(expensive));
    }
  });

  it("claims before synthesis and before any send", () => {
    expect(claimAt).toBeLessThan(webhook.indexOf("speakReply("));
    expect(claimAt).toBeLessThan(webhook.indexOf("deliverReply("));
  });

  it("claims before the rate limiter, so a throttled message is still recorded", () => {
    expect(claimAt).toBeLessThan(webhook.indexOf("rateLimitDecision({"));
  });
});

// ── 3. Recovery ──────────────────────────────────────────────────────────────

describe("processing recovery", () => {
  it("reprocesses a claim that was abandoned mid-flight", () => {
    const decision = reliability.claimDecision(
      { processing_state: "processing", processing_started_at: ago(reliability.RECOVERY_AFTER_MS + 1_000) },
      NOW,
    );
    expect(decision).toEqual({ action: "process", recovered: true });
  });

  it("is deterministic: the same row and clock give the same answer", () => {
    const row = { processing_state: "processing", processing_started_at: ago(120_000) };
    const answers = new Set(
      Array.from({ length: 50 }, () => JSON.stringify(reliability.claimDecision(row, NOW))),
    );
    expect(answers.size).toBe(1);
  });

  it("waits out the whole window before taking a claim over", () => {
    const justInside = reliability.claimDecision(
      { processing_state: "processing", processing_started_at: ago(reliability.RECOVERY_AFTER_MS - 1) },
      NOW,
    );
    const justOutside = reliability.claimDecision(
      { processing_state: "processing", processing_started_at: ago(reliability.RECOVERY_AFTER_MS + 1) },
      NOW,
    );
    expect(justInside.action).toBe("skip");
    expect(justOutside.action).toBe("process");
  });

  it("leaves the window longer than every deadline in the system", () => {
    const combined = ask.DEFAULT_ASK_TIMEOUT_MS
      + reliability.CLASSIFY_TIMEOUT_MS
      + reliability.SUMMARY_TIMEOUT_MS;
    expect(reliability.RECOVERY_AFTER_MS).toBeGreaterThan(combined);
  });

  it("does not reprocess a row written before the column existed, until it is old", () => {
    // NULL state is "unknown". Reprocessing an unknown row immediately would
    // double-answer every message in flight on release day.
    const fresh = reliability.claimDecision(
      { processing_state: null, processing_started_at: null },
      NOW,
    );
    expect(fresh.action).toBe("skip");
  });

  it("survives a row that is missing, malformed or has an unparseable stamp", () => {
    for (const row of [
      null,
      undefined,
      {},
      { processing_state: "processing", processing_started_at: "not a date" },
      { processing_state: "wat", processing_started_at: ago(1_000) },
      { processing_state: "processing", processing_started_at: "" },
    ]) {
      const decision = reliability.claimDecision(row as never, NOW);
      expect(["skip", "process"]).toContain(decision.action);
    }
  });

  it("does not treat a clock disagreement as an abandonment", () => {
    const future = reliability.claimDecision(
      { processing_state: "processing", processing_started_at: new Date(NOW + 60_000).toISOString() },
      NOW,
    );
    expect(future.action).toBe("skip");
  });

  it("marks the claim finished on every ordinary way out, in one place", () => {
    expect(webhook).toContain("} finally {");
    expect(webhook).toContain('.update({ processing_state: "done" })');
    // And never on the failure path, which is what leaves it recoverable.
    expect(webhook).toContain("if (claimedMessageId && !handlingFailed) {");
    expect(webhook).toContain("handlingFailed = true;");
  });

  it("never lets closing the claim break the batch", () => {
    const block = webhook.slice(webhook.indexOf("if (claimedMessageId && !handlingFailed)"));
    expect(block.slice(0, 500)).toContain("try {");
    expect(block.slice(0, 700)).toContain("catch");
  });

  it("retakes an abandoned claim so a third delivery sees it in flight", () => {
    expect(webhook).toContain('.update({ processing_state: "processing", processing_started_at: claimedAt })');
  });
});

// ── 4. Session state survives recovery ───────────────────────────────────────

describe("recovery does not lose where the sender was", () => {
  const inAsk: SessionState = {
    ...sessions.freshSession(),
    path: ["main", "assistant", "assistant.ask"],
    feature: "assistant.ask",
    step: "ai_processing",
    pending: { operation: "ai_processing", startedAt: ago(1_000) },
    context: { note: "kept" },
    updatedAt: ago(1_000),
  };

  it("reads the same session back out of the row it wrote", () => {
    const columns = sessions.sessionColumns(inAsk, ago(1_000));
    const restored = sessions.readSession(columns as Record<string, unknown>);
    expect(restored.path).toEqual(inAsk.path);
    expect(restored.feature).toBe("assistant.ask");
    expect(restored.step).toBe("ai_processing");
    expect(restored.context).toEqual({ note: "kept" });
  });

  it("clears a stuck processing state rather than stranding somebody in it", () => {
    // The recovered delivery runs the engine, which clears a step that says it
    // is still working long after it could be.
    const outcome = engine.runEngine(
      { text: "are you still there", kind: "text" },
      { ...inAsk, pending: { operation: "ai_processing", startedAt: ago(30 * 60_000) } },
      {
        language: "en",
        nowMs: NOW,
        timeoutMs: 30 * 60_000,
        available: ["ai", "speech_to_text", "text_to_speech", "vision", "location", "bazaar"],
        isNewConversation: false,
      },
    );
    expect(outcome.session.step).not.toBe("ai_processing");
  });

  it("keeps the navigation path across a session write and read", () => {
    for (const path of [["main"], ["main", "services"], ["main", "ocr", "ocr.read"]]) {
      const state = { ...sessions.freshSession(), path };
      const restored = sessions.readSession(
        sessions.sessionColumns(state, ago(0)) as Record<string, unknown>,
      );
      expect(restored.path).toEqual(path);
    }
  });

  it("keeps the claim on the message row, not on the conversation row", () => {
    // Session state and the claim have different lifetimes; putting the claim
    // on the conversation would make a timeout clear it.
    expect(migration).toContain("ALTER TABLE public.whatsapp_messages");
    expect(migration).not.toContain("ALTER TABLE public.whatsapp_conversations");
  });
});

// ── 5. Deadlines, and the provider order behind them ─────────────────────────

describe("provider deadlines", () => {
  it("gives up rather than holding the reply", async () => {
    const started = Date.now();
    const result = await reliability.withDeadline(() => new Promise(() => {}), 30);
    expect(result).toBeNull();
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("reports a timeout and a failure differently to the caller that asked", async () => {
    const seen: boolean[] = [];
    await reliability.withDeadline(() => new Promise(() => {}), 20, (_e, timedOut) => seen.push(timedOut));
    await reliability.withDeadline(async () => { throw new Error("x"); }, 5_000, (_e, timedOut) => seen.push(timedOut));
    expect(seen).toEqual([true, false]);
  });

  it("returns the value when the work finishes in time", async () => {
    expect(await reliability.withDeadline(async () => "done", 5_000)).toBe("done");
  });

  it("never throws, whatever the work does", async () => {
    for (const work of [
      async () => { throw new Error("boom"); },
      () => { throw new Error("sync boom"); },
      async () => { throw "a string"; },
    ]) {
      await expect(reliability.withDeadline(work as () => Promise<unknown>, 500)).resolves.toBeNull();
    }
  });

  it("puts a clock on every secondary provider call in the webhook", () => {
    for (const bounded of [
      "CLASSIFY_TIMEOUT_MS",
      "SUMMARY_TIMEOUT_MS",
      "BRIEFING_TIMEOUT_MS",
    ]) {
      expect(webhook, bounded).toContain(bounded);
    }
    expect(webhook.match(/withDeadline\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("holds the answer to a tighter clock than the recovery window", () => {
    expect(ask.DEFAULT_ASK_TIMEOUT_MS).toBeLessThan(reliability.RECOVERY_AFTER_MS);
  });

  it("leaves the provider order to the registry, unreordered", () => {
    const adapter = readFileSync("supabase/functions/_shared/whatsappAskProvider.ts", "utf8");
    expect(adapter).toContain("targets: assistant.targets");
    // No second opinion about which provider goes first.
    expect(adapter).not.toMatch(/\.sort\(|\.reverse\(|targets\s*=\s*\[/);
    expect(reliability).not.toHaveProperty("PROVIDER_ORDER");
  });

  it("falls back deterministically: the same failure gives the same outcome", async () => {
    const outcomes = [];
    for (let i = 0; i < 5; i++) {
      outcomes.push(await ask.askAssistant(
        { systemParts: ["s"], question: "q" },
        async () => { throw Object.assign(new Error("down"), { status: 503 }); },
      ));
    }
    const shapes = new Set(outcomes.map((o) => `${o.status}:${"reason" in o ? o.reason : ""}:${"httpStatus" in o ? o.httpStatus : ""}`));
    expect(shapes.size).toBe(1);
    expect([...shapes][0]).toBe("failed:provider_error:503");
  });

  it("distinguishes a timeout from a provider failure in the ask itself", async () => {
    const timedOut = await ask.askAssistant(
      { systemParts: ["s"], question: "q", timeoutMs: 20 },
      () => new Promise(() => {}),
    );
    expect(timedOut.status === "failed" && timedOut.reason).toBe("timeout");
  });
});

// ── 6. Never nothing, never twice ────────────────────────────────────────────

describe("empty and duplicate replies", () => {
  it("knows what is sendable", () => {
    expect(reliability.isSendable("hello")).toBe(true);
    expect(reliability.isSendable("")).toBe(false);
    expect(reliability.isSendable("   \n\t ")).toBe(false);
    expect(reliability.isSendable(null)).toBe(false);
    expect(reliability.isSendable(undefined)).toBe(false);
  });

  it("knows a repeat when it sees one", () => {
    expect(reliability.isRepeatOf("same", "same")).toBe(true);
    expect(reliability.isRepeatOf("same ", "same")).toBe(true);
    expect(reliability.isRepeatOf("different", "same")).toBe(false);
    expect(reliability.isRepeatOf("first", null)).toBe(false);
  });

  it("guards both in the one function every reply goes through", () => {
    const replyFn = webhook.slice(
      webhook.indexOf("const reply = async (body: string, kind: string) => {"),
      webhook.indexOf("const medium = replyMedium({ spokenInput, body });"),
    );
    expect(replyFn).toContain("if (!isSendable(body))");
    expect(replyFn).toContain("if (isRepeatOf(body, lastSentBody))");
  });

  it("records why a reply was suppressed, without recording the reply", () => {
    expect(webhook).toContain('log("reply_suppressed", { replyKind: kind, reason: "empty" });');
    expect(webhook).toContain('log("reply_suppressed", { replyKind: kind, reason: "duplicate" });');
  });

  it("still treats an empty provider answer as its own outcome", async () => {
    const outcome = await ask.askAssistant(
      { systemParts: ["s"], question: "q" },
      async () => ({ text: "   ", provider: "p", model: "m" }),
    );
    expect(outcome.status).toBe("empty");
  });
});

// ── 7. A failure never sends the answer through the wrong medium ─────────────

describe("transport and synthesis failures", () => {
  const transport = (over: Partial<ReplyTransport> = {}): ReplyTransport => ({
    sendText: async () => true,
    speak: async () => true,
    ...over,
  });

  it("never sends the AI answer as text when synthesis fails", async () => {
    const sent: string[] = [];
    const delivered = await voice.deliverReply(
      {
        body: "The full answer, which must not be dumped as a wall of text.",
        kind: "reply",
        spokenInput: true,
        failureNotice: "Sorry — that didn't go through.",
      },
      transport({ speak: async () => false, sendText: async (b) => { sent.push(b); return true; } }),
    );
    expect(delivered.spokenFailed).toBe(true);
    expect(sent).toEqual(["Sorry — that didn't go through."]);
    expect(sent[0]).not.toContain("wall of text");
  });

  it("writes a short notice out as itself, since it is already safe", async () => {
    const sent: string[] = [];
    await voice.deliverReply(
      { body: "I couldn't hear that voice note.", kind: "unsupported", spokenInput: true, failureNotice: "x" },
      transport({ speak: async () => false, sendText: async (b) => { sent.push(b); return true; } }),
    );
    expect(sent).toEqual(["I couldn't hear that voice note."]);
  });

  it("reports a transport failure rather than claiming a send", async () => {
    const delivered = await voice.deliverReply(
      { body: "hello", kind: "reply", spokenInput: false, failureNotice: "x" },
      transport({ sendText: async () => false }),
    );
    expect(delivered).toEqual({ medium: "text", sent: false, spokenFailed: false });
  });

  it("never sends both a voice note and the text of the same answer", async () => {
    let spoke = 0;
    let wrote = 0;
    const delivered = await voice.deliverReply(
      { body: "One answer.", kind: "reply", spokenInput: true, failureNotice: "x" },
      transport({ speak: async () => { spoke++; return true; }, sendText: async () => { wrote++; return true; } }),
    );
    expect(delivered.medium).toBe("voice");
    expect(spoke).toBe(1);
    expect(wrote).toBe(0);
  });

  it("corrects the transcript when a claimed voice reply never travelled", () => {
    expect(webhook).toContain("if (delivered.spokenFailed && written?.id)");
    expect(webhook).toContain('.update({ medium: "text" })');
  });
});

// ── 8. The migration ─────────────────────────────────────────────────────────

describe("the migration is additive and safe", () => {
  it("only adds nullable columns and one index", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS processing_state");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS processing_started_at");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS");
    expect(migration).not.toMatch(/NOT NULL/);
  });

  it("drops nothing and rewrites nothing", () => {
    for (const destructive of ["DROP TABLE", "DROP COLUMN", "TRUNCATE", "DELETE FROM", "ALTER COLUMN"]) {
      expect(migration.toUpperCase(), destructive).not.toContain(destructive);
    }
  });

  it("backfills nothing, so it takes no lock on a live table", () => {
    expect(migration.toUpperCase()).not.toContain("UPDATE PUBLIC.");
  });

  it("is safe to run twice", () => {
    expect(migration.match(/IF NOT EXISTS/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("constrains the state to the two values the code writes", () => {
    expect(migration).toContain("processing_state IN ('processing', 'done')");
  });

  it("does not collide with an existing migration version or name", () => {
    const files = readdirSync("supabase/migrations");
    const versions = files.map((f) => f.split("_")[0]);
    expect(new Set(versions).size).toBe(versions.length);
    expect(new Set(files).size).toBe(files.length);
  });
});
