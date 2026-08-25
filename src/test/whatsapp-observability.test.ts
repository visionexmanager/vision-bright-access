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

import { readdirSync, readFileSync } from "node:fs";
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
      // No closing brace: the call now also carries `cache`, and what this
      // leg is about is that the correlation id reaches it.
      "speakReply({ phoneNumberId, token, to: incoming.from, text, trace: correlationId",
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

// ── 8. Meta's message id, which is a phone number in disguise ────────────────
//
// A `wamid` is base64. Decoding one yields bytes containing the sender's E.164
// number. It sat on the allowlist as a "machine identifier" — the comment said
// these ids "name a record rather than a person" — until a diagnostic run
// published one into a world-readable job summary.
//
// The number used throughout this section is fabricated. The real one belonged
// to a customer, and repeating it here to test that it is not published would
// be its own small joke at their expense.

describe("a WhatsApp message id never reaches a log", () => {
  /** Build a wamid the way Meta does: base64 over bytes carrying the number. */
  const wamidFor = (e164: string): string => {
    const prefix = String.fromCharCode(0x1c, 0x18, e164.length);
    const body = `${prefix}${e164}\u0015\u0002\u0000\u0012\u0018\u00142AB953DDDDB767DFF5AA\u0000`;
    let binary = "";
    for (const character of body) binary += character;
    return "wamid." + btoa(binary);
  };

  const PHONE = "962790001234";           // fabricated, not a real customer
  const WAMID = wamidFor(PHONE);

  it("really does encode the number, or this suite proves nothing", () => {
    // If this ever stops being true the tests below become vacuous, so the
    // premise is checked rather than assumed.
    const decoded = atob(WAMID.slice("wamid.".length));
    expect(decoded).toContain(PHONE);
  });

  it("is not on the allowlist", () => {
    expect(telemetry.TELEMETRY_FIELDS).not.toContain("message");
    expect(telemetry.TELEMETRY_FIELDS).not.toContain("messageId");
    expect(telemetry.TELEMETRY_FIELDS).not.toContain("wa_message_id");
    expect(telemetry.TELEMETRY_FIELDS).not.toContain("wamid");
  });

  it("is dropped when offered as a field, under any name", () => {
    for (const name of ["message", "messageId", "wamid", "wa_message_id", "id", "external_message_id"]) {
      const published = JSON.stringify(telemetry.sanitiseFields({ [name]: WAMID }));
      expect(published, name).toBe("{}");
      expect(published, name).not.toContain("wamid");
      expect(published, name).not.toContain(PHONE);
    }
  });

  it("is dropped when smuggled into a field that IS allowed", () => {
    // The allowlist is the first gate; the value rules are the second. A wamid
    // carries a long run of digits and fails them whatever it is called.
    for (const name of telemetry.TELEMETRY_FIELDS) {
      const published = JSON.stringify(telemetry.sanitiseFields({ [name]: WAMID }));
      expect(published, name).not.toContain("wamid");
      expect(published, name).not.toContain(PHONE);
    }
  });

  it("cannot be put on the base of a logger", () => {
    // Not merely dropped — absent from `TelemetryBase`, so this does not
    // typecheck without the cast, and does not publish with it either.
    const lines: string[] = [];
    const log = telemetry.createTelemetry(
      { correlation: "cid0123456789ab", message: WAMID } as unknown as TelemetryBase,
      { write: (line) => lines.push(line) },
    );
    log("received", { chars: 4 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("wamid");
    expect(lines[0]).not.toContain(PHONE);
    expect(lines[0]).toContain("cid0123456789ab");
  });

  it("cannot be logged as an event name or a nested value", () => {
    const lines: string[] = [];
    const log = telemetry.createTelemetry(
      { correlation: "cid0123456789ab" },
      { write: (line) => lines.push(line) },
    );
    log(WAMID, { reason: WAMID, node: WAMID, code: WAMID, conversation: WAMID });
    log("replied", { reason: { nested: WAMID } as unknown as string });
    for (const line of lines) {
      expect(line).not.toContain("wamid");
      expect(line).not.toContain(PHONE);
    }
  });

  it("is absent from the production telemetry base", () => {
    const start = webhook.indexOf("const log = createTelemetry(");
    const base = webhook.slice(start, webhook.indexOf(");", start));
    expect(base).not.toContain("incoming.messageId");
    expect(base).toContain("correlation: correlationId");
    expect(base).toContain("conversation: conversationId");
  });

  it("is absent from the diagnostic workflow's own field list", () => {
    const declared = diagnose.slice(diagnose.indexOf("FIELDS='["));
    const list: string[] = JSON.parse(declared.slice(declared.indexOf("["), declared.indexOf("]") + 1));
    expect(list).not.toContain("message");
    expect(list).not.toContain("messageId");
    expect(list).not.toContain("wamid");
    // And the two that replaced it are still there, or tracing is gone.
    expect(list).toContain("correlation");
    expect(list).toContain("conversation");
  });

  it("survives the workflow's filter even if something upstream emits it", () => {
    // The workflow is the second gate. Re-implemented here exactly as the jq
    // filter does it, so a future edit that widens the list is caught.
    const declared = diagnose.slice(diagnose.indexOf("FIELDS='["));
    const allowed: string[] = JSON.parse(declared.slice(declared.indexOf("["), declared.indexOf("]") + 1));
    const emitted = {
      at: "whatsapp", event: "replied", correlation: "cid0123456789ab",
      conversation: "26ce09de-db97", message: WAMID, kind: "text", ms: 812,
    } as Record<string, unknown>;

    const shown = Object.fromEntries(
      Object.entries(emitted).filter(([key]) => allowed.includes(key)),
    );
    const rendered = JSON.stringify(shown);
    expect(rendered).not.toContain("wamid");
    expect(rendered).not.toContain(PHONE);
    expect(rendered).toContain("cid0123456789ab");
  });

  it("still lives in the database, where deduplication needs the real value", () => {
    // The fix is about *publication*, not about losing the id. The unique index
    // on wa_message_id is what makes a Meta retry a no-op, and the column is
    // service-role only with admin-only RLS.
    expect(webhook).toContain("wa_message_id: incoming.messageId");
    expect(webhook).toContain('.eq("wa_message_id", incoming.messageId)');
  });

  it("is not printed by any console line in the WhatsApp code", () => {
    const files = ["supabase/functions/whatsapp-webhook/index.ts"];
    for (const file of readdirSync("supabase/functions/_shared").filter((f) => f.startsWith("whatsapp"))) {
      files.push(`supabase/functions/_shared/${file}`);
    }
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const line of source.split(NL).filter((l) => l.includes("console."))) {
        expect(line, `${file}: ${line.trim()}`).not.toMatch(/messageId|wamid|wa_message_id/i);
      }
    }
  });
});

// ── 9. Correlation still does the job the message id was doing ───────────────

describe("correlation ids still provide tracing", () => {
  it("ties every line of one delivery together", () => {
    const { log, parsed } = recorder();
    // The full shape of a delivery: received, routed, retrieved, asked, replied.
    log("received", { chars: 12, selection: false });
    log("route", { outcome: "delegate", reason: "selection", node: "assistant.ask" });
    log("grounding", { status: "grounded", passages: 3, candidates: 15 });
    log("ai_answered", { provider: "groq", model: "llama-3.3-70b-versatile", chars: 240 });
    log("replied", { replyKind: "reply", medium: "text", sent: true });

    const lines = parsed();
    expect(lines).toHaveLength(5);
    const ids = new Set(lines.map((line) => line.correlation));
    expect(ids.size, "one delivery must have exactly one correlation id").toBe(1);
    // And the sequence is readable end to end from that one id.
    expect(lines.map((line) => line.event))
      .toEqual(["received", "route", "grounding", "ai_answered", "replied"]);
  });

  it("keeps two deliveries apart", () => {
    const a = recorder({ correlation: "aaaaaaaaaaaaaaaa" });
    const b = recorder({ correlation: "bbbbbbbbbbbbbbbb" });
    a.log("received", { chars: 1 });
    b.log("received", { chars: 1 });
    expect(a.parsed()[0].correlation).not.toBe(b.parsed()[0].correlation);
  });

  it("groups a thread by conversation without naming anybody", () => {
    const { log, parsed } = recorder({ conversation: "26ce09de-db97-4dc6" });
    log("received", { chars: 1 });
    expect(parsed()[0].conversation).toBe("26ce09de-db97-4dc6");
  });

  it("reaches the modules that print their own lines", () => {
    expect(telemetry.trace("cid0123456789ab")).toBe(" cid=cid0123456789ab");
    for (const name of ["whatsappVoiceReply", "whatsappTranscribe", "whatsappMedia", "whatsappInteractive"]) {
      const source = readFileSync(`supabase/functions/_shared/${name}.ts`, "utf8");
      expect(source, name).toContain("trace(");
    }
  });

  it("is what the diagnostic tells a reader to follow", () => {
    expect(diagnose).toContain("correlation");
    expect(diagnose).toMatch(/Follow one delivery end to end with its/);
  });
});
