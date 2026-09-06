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
const triage = await import("../../supabase/functions/_shared/whatsappTriage.ts");

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

// ── A delivery that threw used to say nothing at all ────────────────────────
//
// Two voice notes arrived on 2026-09-06 and were answered with silence. The
// transcript showed them arriving; the structured log showed `received` and
// then nothing; the only other trace was the outer catch's `console.error`,
// which the diagnose workflow withholds because it cannot vouch for what a
// console line carries. So the sender got nothing and the operator learned
// nothing, which is the pair this block exists to break.

describe("a delivery that fails still answers", () => {
  const catchBlock = (() => {
    // From the top of the catch, not from the message inside it: half of what
    // this block asserts sits above that line.
    const start = webhook.indexOf("One bad message must not drop the rest of the batch");
    const end = webhook.indexOf("} finally {", start);
    expect(start, "the outer catch").toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    return webhook.slice(start, end);
  })();

  it("says something to the sender rather than nothing", () => {
    // The whole point. Everything else in this block is about the next failure
    // being diagnosable; this is about the person waiting for an answer.
    expect(catchBlock).toContain("await answerFailure?.()");
    expect(webhook).toContain('await reply(featureErrorNotice(answerLanguage), "unsupported")');
  });

  it("stays quiet when an answer already went out", () => {
    // A metering write or a background drain failing *after* the reply is not a
    // question left hanging, and "something went wrong" underneath a real
    // answer would turn a delivery that worked into one that reads as broken.
    const notice = webhook.slice(webhook.indexOf("answerFailure = async () => {"));
    expect(notice.slice(0, 200)).toContain("if (lastSentBody !== null) return;");
  });

  it("is allowed to fail at apologising, without failing the batch", () => {
    // If the send is what threw, this throws too — and a failure to apologise
    // must not drop every message after it in the same delivery.
    expect(catchBlock).toMatch(/try \{\s*await answerFailure\?\.\(\);\s*\} catch/);
  });

  it("leaves one structured line, with the code and where it got to", () => {
    expect(catchBlock).toContain('report?.("handling_failed"');
    for (const field of ["state: stage", "problem", "kind:"]) {
      expect(catchBlock, field).toContain(field);
    }
  });

  it("logs only fields both allowlists already carry", () => {
    // A new field name is dropped by `whatsappTelemetry.ts` and then dropped
    // again by the workflow, so a line that needed one would be invisible in
    // exactly the situation it was added for.
    const telemetry = readFileSync("supabase/functions/_shared/whatsappTelemetry.ts", "utf8");
    const workflow = readFileSync(".github/workflows/whatsapp-diagnose.yml", "utf8");
    for (const field of ["state", "problem", "kind"]) {
      expect(telemetry, `${field} in TELEMETRY_FIELDS`).toContain(`"${field}"`);
      expect(workflow, `${field} in the workflow's FIELDS`).toContain(`"${field}"`);
    }
  });

  it("marks every stage a delivery can die in", () => {
    // The code says *what* went wrong and never *where*, and "unknown" is what
    // a plain Error becomes — so without this the same three words could be the
    // claim, the rate limiter, the transcription or the answer.
    const stages = [...webhook.matchAll(/stage = "([a-z_]+)"/g)].map((m) => m[1]);
    expect(new Set(stages)).toEqual(
      new Set(["start", "received", "claimed", "rate_limit", "onboarding", "media", "transcribe", "route"]),
    );
    // Assigned before the work each one names, never after it.
    expect(webhook.indexOf('stage = "media"')).toBeLessThan(webhook.indexOf('stage = "transcribe"'));
    expect(webhook.indexOf('stage = "transcribe"')).toBeLessThan(webhook.indexOf('stage = "route"'));
  });

  it("keeps the claim open so Meta's redelivery can still rescue the message", () => {
    // Answering the failure must not also mark it finished: the apology is a
    // courtesy, and the redelivery is the actual second chance.
    expect(catchBlock).toContain("handlingFailed = true;");
    expect(webhook).toContain("if (claimedMessageId && !handlingFailed)");
  });
});

// ── An outage is not a handover ─────────────────────────────────────────────
//
// `escalated` is the webhook's one completely silent path, and nothing in the
// product clears it. That is right when a person now owns the conversation. It
// was also being applied to `ai_unavailable`, which says only that a provider
// was unreachable for one message — and a production thread sat silent from
// 12:51 on 2026-09-06 because of it, dropping every question that sender asked
// afterwards without a word.

describe("when the assistant must stay quiet", () => {
  const NOW = Date.parse("2026-09-06T18:00:00Z");
  const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

  it("says nothing while a person owns the conversation, however long it has been", () => {
    for (const minutes of [0, 60, 60 * 24 * 30]) {
      expect(
        triage.assistantIsSilenced({ control: "human", escalated: false, escalated_at: at(minutes) }, NOW),
        `${minutes} minutes`,
      ).toBe(true);
    }
  });

  it("stays silent for every escalation that is about the conversation", () => {
    // Somebody asked for a person, or complained, or said something about a
    // payment. A second voice in any of those is worse than one.
    for (const reason of ["user_request", "assistant_handover", "complaint", "repeated_failure", "sensitive"]) {
      expect(
        triage.assistantIsSilenced(
          { escalated: true, escalation_reason: reason, escalated_at: at(60 * 24 * 7) },
          NOW,
        ),
        reason,
      ).toBe(true);
    }
  });

  it("answers again once a provider outage is over", () => {
    const row = (minutesAgo: number) => ({
      escalated: true,
      escalation_reason: "ai_unavailable",
      escalated_at: at(minutesAgo),
    });
    // Inside the window a person may still be picking it up.
    expect(triage.assistantIsSilenced(row(1), NOW)).toBe(true);
    expect(triage.assistantIsSilenced(row(29), NOW)).toBe(true);
    // Past it there is nothing left for a person to own, and a sender who is
    // still being ignored.
    expect(triage.assistantIsSilenced(row(31), NOW)).toBe(false);
    expect(triage.assistantIsSilenced(row(60 * 24), NOW)).toBe(false);
    expect(triage.TECHNICAL_ESCALATION_COOLDOWN_MS).toBe(30 * 60 * 1000);
  });

  it("keeps an escalation nobody can date, rather than guessing it is over", () => {
    for (const escalated_at of [null, undefined, "", "not a date"]) {
      expect(
        triage.assistantIsSilenced(
          { escalated: true, escalation_reason: "ai_unavailable", escalated_at },
          NOW,
        ),
        String(escalated_at),
      ).toBe(true);
    }
  });

  it("does not silence an ordinary conversation", () => {
    expect(triage.assistantIsSilenced({ escalated: false, control: "ai" }, NOW)).toBe(false);
    expect(triage.assistantIsSilenced({}, NOW)).toBe(false);
    expect(triage.assistantIsSilenced(null, NOW)).toBe(false);
    expect(triage.assistantIsSilenced(undefined, NOW)).toBe(false);
  });

  it("is the only thing the webhook asks, in both of the places it used to ask twice", () => {
    // Two conditions written out separately is two chances to fix one of them.
    expect(webhook).toContain("const humanOwnsThis = assistantIsSilenced(");
    expect(webhook).toContain("if (assistantIsSilenced(existing as Record<string, unknown> | null, Date.now())) continue;");
    expect(webhook).not.toContain('existing?.control === "human" || existing?.escalated');
  });

  it("reads the columns the rule needs off the conversation", () => {
    // The rule reads `escalated_at` and `escalation_reason`. A row that does not
    // carry them makes every technical escalation permanent again, silently.
    const select = webhook.slice(webhook.indexOf('"escalated,'), webhook.indexOf("last_location_at") + 20);
    for (const column of ["escalated", "escalated_at", "escalation_reason", "control"]) {
      expect(select, column).toContain(column);
    }
  });

  it("clears the flag once it stops meaning anything", () => {
    // Left standing it would keep the thread in the escalated queue for ever,
    // telling whoever reads that queue a conversation needs a person when it
    // does not.
    expect(webhook).toContain('.update({ escalated: false, escalation_reason: null })');
    expect(webhook).toContain('log("escalation_cleared"');
  });
});

// ── The gate that lets a boot-class fault through ───────────────────────────
//
// `whatsapp-deno-check.yml` runs `deno check` on every entry point and fails on
// the diagnostics that are *runtime* failures rather than type complaints. The
// entry points carry long-standing type errors from stale generated types, so a
// blanket check is red before anybody touches anything — which is why the fatal
// set is a list, and why the list is the thing worth pinning.
//
// It has been wrong twice. First it matched nothing at all, because Deno colours
// its output and the escape sequence sat in front of the code. Then it matched
// the wrong codes: `aiFocused` and `featureOn` were read five hundred lines
// above their own declarations, `deno check` reported TS2448 and TS2454 for a
// day, and every message carrying a voice note, a photograph or a document was
// answered with silence while the gate stayed green.

describe("the boot gate's fatal set", () => {
  const workflow = readFileSync(".github/workflows/whatsapp-deno-check.yml", "utf8");
  const fatal = /FATAL='(\^TS\([^']+\) )'/.exec(workflow)?.[1];

  it("is a real pattern, read out of the workflow", () => {
    // Two undefineds compare equal, and a test that cannot find the line would
    // pass for ever while the line said anything at all.
    expect(fatal, "FATAL=... in the workflow").toBeTruthy();
  });

  it("covers every diagnostic that means the code cannot run", () => {
    const cover = (code: string) => new RegExp(fatal!).test(`${code} [ERROR]: something`);
    // The parse family: the module never becomes a module.
    for (const code of ["TS1005", "TS1308", "TS1109"]) expect(cover(code), code).toBe(true);
    // A duplicate import — a SyntaxError at load. Took the webhook down for
    // four hours on 2026-09-05.
    expect(cover("TS2300")).toBe(true);
    // A name that does not exist, and a name that exists later — both are a
    // ReferenceError the moment the line runs. The second is the worse of the
    // two: it type-checks as a real binding and fails only on the paths that
    // reach it before its declaration, so the function starts, the health check
    // is green, and one kind of message quietly stops working.
    for (const code of ["TS2304", "TS2552", "TS2448", "TS2454"]) {
      expect(cover(code), code).toBe(true);
    }
  });

  it("still lets an ordinary type complaint through", () => {
    const cover = (code: string) => new RegExp(fatal!).test(`${code} [ERROR]: something`);
    // These are the stale generated types, and failing on them would make the
    // gate red on every branch until they are regenerated — which is how a gate
    // ends up being switched off.
    for (const code of ["TS2339", "TS2345", "TS18046", "TS2551"]) {
      expect(cover(code), code).toBe(false);
    }
  });

  it("keeps the space that stops TS1804 matching TS18046", () => {
    // Load-bearing: without it the pattern matches any code that merely starts
    // with one of these, and two healthy functions fail.
    expect(fatal!.endsWith(") ")).toBe(true);
  });
});

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
