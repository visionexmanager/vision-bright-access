// Phase 6 — what this channel is allowed to say about itself.
//
// The constraint is not hypothetical. This repository is public, its CI logs
// are world-readable, and the diagnose workflow prints function logs into a job
// summary anybody can open. A log line here is a publication.
//
// So these tests come in two halves. The first proves the allowlist actually
// drops things — including things nobody has thought of yet, which is the whole
// reason it is an allowlist. The second proves the correlation id reaches every
// leg of a delivery, because a privacy-safe log that cannot be followed end to
// end is a log nobody will use.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TelemetryBase } from "../../supabase/functions/_shared/whatsappTelemetry.ts";

const telemetry = await import("../../supabase/functions/_shared/whatsappTelemetry.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const diagnose = readFileSync(".github/workflows/whatsapp-diagnose.yml", "utf8");
const NL = String.fromCharCode(10);

/** A logger writing into an array, so a test can read exactly what shipped. */
const recorder = (base: Partial<TelemetryBase> = {}) => {
  const lines: string[] = [];
  const log = telemetry.createTelemetry(
    { correlation: "cid0123456789ab", conversation: "conv-1", ...base },
    { write: (line) => lines.push(line), now: () => 1_000, startedAt: 900 },
  );
  return { log, lines, parsed: () => lines.map((l) => JSON.parse(l)) };
};

// ── 1. Correlation ───────────────────────────────────────────────────────────

describe("correlation ids", () => {
  it("makes a fresh one every time", () => {
    const ids = new Set(Array.from({ length: 200 }, () => telemetry.newCorrelationId()));
    expect(ids.size).toBe(200);
  });

  it("is short, opaque and safe to publish", () => {
    for (let i = 0; i < 50; i++) {
      const id = telemetry.newCorrelationId();
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it("is derived from nothing about the sender", () => {
    // A correlation id built from the phone number would link every delivery a
    // person ever made, which is the opposite of what this is for. It takes no
    // arguments, so there is nothing about the sender it *could* be derived
    // from — and that is a stronger guarantee than reading its body.
    expect(telemetry.newCorrelationId).toHaveLength(0);

    const source = readFileSync("supabase/functions/_shared/whatsappTelemetry.ts", "utf8");
    const fn = source.slice(source.indexOf("export function newCorrelationId"));
    const body = fn.slice(0, fn.indexOf(NL + "}"));
    for (const forbidden of ["phone", "wa_phone", "sha256", "incoming"]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it("appears on every line a delivery writes", () => {
    const { log, parsed } = recorder();
    log("received", { chars: 12 });
    log("route", { outcome: "delegate", node: "services.weather" });
    log("replied", { medium: "text", sent: true });
    for (const line of parsed()) expect(line.correlation).toBe("cid0123456789ab");
  });

  it("is generated per message, not per request", () => {
    // A Meta payload can carry several messages; two sharing one id would be
    // exactly the confusion the id exists to remove.
    const loop = webhook.slice(webhook.indexOf("for (const incoming of messages)"));
    expect(loop.slice(0, 800)).toContain("const correlationId = newCorrelationId();");
  });
});

// ── 2. The allowlist ─────────────────────────────────────────────────────────

describe("the field allowlist", () => {
  it("keeps a field it knows", () => {
    expect(telemetry.sanitiseFields({ chars: 42, provider: "groq", sent: true }))
      .toEqual({ chars: 42, provider: "groq", sent: true });
  });

  it("drops a field nobody vouched for", () => {
    expect(telemetry.sanitiseFields({ body: "what the customer wrote" })).toEqual({});
    expect(telemetry.sanitiseFields({ phone: "+962790000000" })).toEqual({});
    expect(telemetry.sanitiseFields({ email: "a@b.com" })).toEqual({});
    expect(telemetry.sanitiseFields({ prompt: "the whole system prompt" })).toEqual({});
    expect(telemetry.sanitiseFields({ transcript: "what they said" })).toEqual({});
  });

  it("MUTATION: a denylist would have let each of those through", () => {
    // The point of an allowlist is the field nobody thought of. These are
    // plausible names a future log call might use, and every one is refused
    // without anybody having had to predict it.
    for (const invented of ["answer", "passage", "mediaUrl", "token", "dob", "gender", "note", "raw"]) {
      expect(telemetry.sanitiseFields({ [invented]: "anything at all" }), invented).toEqual({});
    }
  });

  it("drops an allowed field whose value is unsafe anyway", () => {
    // The name is fine; the value is a phone number.
    expect(telemetry.sanitiseFields({ reason: "962790000000" })).toEqual({});
    expect(telemetry.sanitiseFields({ reason: "user@example.com" })).toEqual({});
    expect(telemetry.sanitiseFields({ reason: "a whole sentence of what they said" })).toEqual({});
    expect(telemetry.sanitiseFields({ reason: "ما هو الطقس اليوم" })).toEqual({});
  });

  it("drops a one-time code hiding in an allowed field", () => {
    expect(telemetry.sanitiseFields({ status: "483920" })).toEqual({});
    expect(telemetry.sanitiseFields({ category: "4111111111111111" })).toEqual({});
  });

  it("keeps a numeric status, which is what that field is for", () => {
    expect(telemetry.sanitiseFields({ status: 429 })).toEqual({ status: 429 });
  });

  it("keeps a date-stamped model id, which is written by us and not by anyone", () => {
    expect(telemetry.sanitiseFields({ model: "claude-haiku-4-5-20251001" }))
      .toEqual({ model: "claude-haiku-4-5-20251001" });
    expect(telemetry.sanitiseFields({ provider: "groq", model: "llama-3.3-70b-versatile" }))
      .toEqual({ provider: "groq", model: "llama-3.3-70b-versatile" });
  });

  it("still refuses an email or a space in one of those fields", () => {
    expect(telemetry.sanitiseFields({ model: "a@b.com" })).toEqual({});
    expect(telemetry.sanitiseFields({ node: "two words" })).toEqual({});
  });

  it("never lets an object into a log line", () => {
    // An object is how an entire provider response body ends up published.
    expect(telemetry.sanitiseFields({ reason: { body: "everything" } })).toEqual({});
    expect(telemetry.sanitiseFields({ reason: ["a", "b"] })).toEqual({});
    expect(telemetry.sanitiseFields({ reason: () => "x" })).toEqual({});
  });

  it("refuses an over-long value", () => {
    expect(telemetry.sanitiseFields({ reason: "x".repeat(telemetry.MAX_FIELD_CHARS + 1) })).toEqual({});
  });

  it("refuses a value that is not finite", () => {
    expect(telemetry.sanitiseFields({ ms: Number.NaN })).toEqual({});
    expect(telemetry.sanitiseFields({ ms: Number.POSITIVE_INFINITY })).toEqual({});
  });

  it("lists no field that could hold what somebody wrote", () => {
    for (const forbidden of ["body", "text", "question", "answer", "prompt", "phone", "email", "name", "transcript", "passage", "token", "url"]) {
      expect(telemetry.TELEMETRY_FIELDS, forbidden).not.toContain(forbidden);
    }
  });
});

// ── 3. Errors are codes, never bodies ────────────────────────────────────────

describe("failures are recorded as codes", () => {
  it("records a normalised code and a status", () => {
    const { log, parsed } = recorder();
    log.fail("ai_failed", Object.assign(new Error("prompt echoed: my card is 4111111111111111"), { status: 429 }));
    const [line] = parsed();
    expect(line.code).toBe("rate_limited");
    expect(line.status).toBe(429);
    expect(JSON.stringify(line)).not.toContain("4111");
    expect(JSON.stringify(line)).not.toContain("prompt echoed");
  });

  it("records something useful even for an error it cannot classify", () => {
    const { log, parsed } = recorder();
    log.fail("x", "a bare string");
    expect(parsed()[0].code).toBe("unknown");
  });
});

// ── 4. Logging can never break the reply ─────────────────────────────────────

describe("a log call cannot take down a delivery", () => {
  it("survives a circular object", () => {
    const circular: Record<string, unknown> = { reason: "ok" };
    circular.self = circular;
    const { log, lines } = recorder();
    expect(() => log("event", circular)).not.toThrow();
    expect(lines).toHaveLength(1);
  });

  it("survives a getter that throws", () => {
    const hostile = {} as Record<string, unknown>;
    Object.defineProperty(hostile, "reason", { get() { throw new Error("nope"); }, enumerable: true });
    const { log, lines } = recorder();
    expect(() => log("event", hostile)).not.toThrow();
    expect(lines).toHaveLength(1);
  });

  it("survives a null-prototype object and a symbol value", () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare.reason = "fine";
    const { log } = recorder();
    expect(() => log("event", bare)).not.toThrow();
    expect(() => log("event", { reason: Symbol("x") as unknown as string })).not.toThrow();
  });

  it("survives a writer that throws", () => {
    const log = telemetry.createTelemetry(
      { correlation: "abc" },
      { write: () => { throw new Error("stdout is gone"); } },
    );
    expect(() => log("event", { chars: 1 })).not.toThrow();
    expect(() => log.fail("event", new Error("x"))).not.toThrow();
  });

  it("survives being handed nothing at all", () => {
    const { log } = recorder();
    expect(() => log("event")).not.toThrow();
    expect(() => log("event", undefined as unknown as Record<string, unknown>)).not.toThrow();
    expect(() => telemetry.sanitiseFields(null as unknown as Record<string, unknown>)).not.toThrow();
  });

  it("still writes one parseable line per call", () => {
    const { log, lines } = recorder();
    log("a", { chars: 1 });
    log("b", { unknown_field: "dropped" });
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
  });
});

// ── 5. The shape of every line ───────────────────────────────────────────────

describe("every line has the same shape", () => {
  it("carries a source, an event, a correlation and a duration", () => {
    const { log, parsed } = recorder();
    log("route", { outcome: "delegate" });
    expect(parsed()[0]).toMatchObject({ at: "whatsapp", event: "route", correlation: "cid0123456789ab", ms: 100 });
  });

  it("lets an operation report its own duration over the delivery's", () => {
    const { log, parsed } = recorder();
    log("ai_answered", { ms: 4_200 });
    expect(parsed()[0].ms).toBe(4_200);
  });

  it("never emits an unsafe event name", () => {
    const { log, parsed } = recorder();
    log("what the user said: hello there");
    expect(parsed()[0].event).toBe("unknown");
  });
});

// ── 6. The production path ───────────────────────────────────────────────────

describe("the webhook logs through the allowlist", () => {
  it("builds its logger from the shared module", () => {
    expect(webhook).toContain("const log = createTelemetry(");
    expect(webhook).toContain("correlation: correlationId,");
  });

  it("no longer hand-rolls a log line", () => {
    // The old version spread arbitrary caller fields straight into JSON.
    expect(webhook).not.toContain('at: "whatsapp",' + NL + "          event,");
  });

  it("uses only allowlisted field names in every log call", () => {
    const allowed = new Set(telemetry.TELEMETRY_FIELDS);
    const calls = [...webhook.matchAll(/\blog\("([a-z_]+)",\s*\{([^}]*)\}/g)];
    expect(calls.length).toBeGreaterThan(8);
    for (const [, event, body] of calls) {
      for (const [, key] of body.matchAll(/(?:^|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) {
        expect(allowed.has(key), `${event} → ${key}`).toBe(true);
      }
    }
  });

  it("propagates the correlation id into every leg of a delivery", () => {
    // Routing, retrieval and the provider call report through `log`, which
    // carries it. Transcription, media and delivery print lines of their own,
    // so they are handed it explicitly.
    for (const leg of [
      "transcribe: (input) => transcribeVoice({ ...input, trace: correlationId })",
      'download: (mediaId) => downloadMedia({ mediaId, kind: "audio", token, trace: correlationId })',
      "speakReply({ phoneNumberId, token, to: incoming.from, text, trace: correlationId })",
      "trace: correlationId,",
    ]) {
      expect(webhook, leg).toContain(leg);
    }
    expect(webhook).toContain('log("grounding"');
    expect(webhook).toContain('log("route"');
    expect(webhook).toContain('log("ai_answered"');
    expect(webhook).toContain('log("replied"');
  });

  it("suffixes a transport module's own lines with the id and nothing else", () => {
    for (const name of ["whatsappVoiceReply", "whatsappTranscribe", "whatsappMedia", "whatsappInteractive"]) {
      const source = readFileSync(`supabase/functions/_shared/${name}.ts`, "utf8");
      expect(source, name).toContain('from "./whatsappTelemetry.ts"');
      expect(source, name).toContain("trace(");
    }
  });

  it("keeps the trace helper incapable of carrying anything but an id", () => {
    expect(telemetry.trace("abc123")).toBe(" cid=abc123");
    expect(telemetry.trace(undefined)).toBe("");
    expect(telemetry.trace("")).toBe("");
  });
});

// ── 7. Diagnostics show a summary, never a dump ──────────────────────────────

describe("the diagnose workflow", () => {
  it("no longer prints raw log lines into a public job summary", () => {
    expect(diagnose).not.toContain('jq -c \'[.result[]? | select(.event_message | test("whatsapp"))]\'');
  });

  it("shows only structured events, filtered by the same allowlist", () => {
    expect(diagnose).toContain('select(type == "object" and .at == "whatsapp")');
    expect(diagnose).toContain("with_entries(select(.key as $k | $fields | index($k)))");
  });

  it("keeps its field list in step with the module's", () => {
    const declared = diagnose.slice(diagnose.indexOf("FIELDS='["));
    const list = declared.slice(declared.indexOf("["), declared.indexOf("]") + 1);
    const fields: string[] = JSON.parse(list);
    // `at` and `event` are the envelope every line carries; everything else has
    // to be on the module's own allowlist, or the workflow would be publishing
    // a field the function never vouched for.
    const envelope = ["at", "event"];
    for (const field of fields) {
      if (envelope.includes(field)) continue;
      expect(telemetry.TELEMETRY_FIELDS, field).toContain(field);
    }
    // And the other direction: nothing the function emits is silently hidden.
    for (const field of telemetry.TELEMETRY_FIELDS) {
      expect(fields, field).toContain(field);
    }
  });

  it("counts what it withheld rather than pretending there was nothing", () => {
    expect(diagnose).toContain("are withheld");
    expect(diagnose).toContain("structured WhatsApp events out of");
  });

  it("stays read-only", () => {
    for (const statement of ["insert ", "update ", "delete ", "drop "]) {
      expect(diagnose.toLowerCase().split("say ").join(""), statement).not.toContain(statement + "into");
    }
    expect(diagnose).toContain("every statement is a SELECT");
  });
});
