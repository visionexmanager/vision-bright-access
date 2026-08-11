import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The webhook cannot be exercised end to end without a Meta account, so the
// decisions that do not need one are tested directly: language detection,
// payload parsing, handover triggers, reply clamping, and signature
// verification. The rest is pinned by reading the source.

const helpers = readFileSync("supabase/functions/_shared/whatsapp.ts", "utf8");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const assistants = readFileSync("supabase/functions/_shared/assistants.ts", "utf8");

// The helper module is Deno-flavoured only in its I/O; the pure functions are
// plain TypeScript. Load them by evaluating the module with its fetch-using
// exports stripped, which keeps the test honest about what it covers.
async function loadHelpers() {
  return await import("../../supabase/functions/_shared/whatsapp.ts");
}

describe("language handling", () => {
  it("answers Arabic in Arabic and everything else in English", async () => {
    const { detectLanguage } = await loadHelpers();
    expect(detectLanguage("مرحبا، عندي مشكلة بالدفع")).toBe("ar");
    expect(detectLanguage("Hello, I have a billing problem")).toBe("en");
    // Mixed input containing Arabic is answered in Arabic.
    expect(detectLanguage("hello مرحبا")).toBe("ar");
  });

  it("uses the agreed Arabic welcome verbatim", async () => {
    const { welcomeFor } = await loadHelpers();
    const welcome = welcomeFor("ar");
    expect(welcome).toContain("أهلاً وسهلاً في Visionex 👋");
    expect(welcome).toContain("أنا المساعد الذكي لـVisionex، وفيني ساعدك مباشرة.");
    expect(welcome).toContain("اكتب طلبك مباشرة وأنا رح ساعدك.");
  });
});

describe("webhook payload parsing", () => {
  it("reads text messages out of the Cloud API envelope", async () => {
    const { extractMessages } = await loadHelpers();
    const parsed = extractMessages({
      entry: [{ changes: [{ value: { messages: [
        { from: "96170000000", id: "wamid.1", type: "text", text: { body: "مرحبا" } },
      ] } }] }],
    });
    expect(parsed).toEqual([{ from: "96170000000", messageId: "wamid.1", text: "مرحبا" }]);
  });

  it("ignores delivery receipts instead of throwing on them", async () => {
    const { extractMessages } = await loadHelpers();
    expect(extractMessages({ entry: [{ changes: [{ value: { statuses: [{ status: "read" }] } }] }] })).toEqual([]);
    expect(extractMessages({})).toEqual([]);
    expect(extractMessages(null)).toEqual([]);
  });

  it("flags non-text messages rather than dropping them silently", async () => {
    const { extractMessages } = await loadHelpers();
    const [message] = extractMessages({
      entry: [{ changes: [{ value: { messages: [{ from: "9617", id: "wamid.2", type: "image" }] } }] }],
    });
    expect(message.unsupportedType).toBe("image");
    expect(message.text).toBe("");
  });
});

describe("handing over to a person", () => {
  it("honours an explicit request in either language", async () => {
    const { userAskedForHuman } = await loadHelpers();
    expect(userAskedForHuman("I want to speak to a person")).toBe(true);
    expect(userAskedForHuman("can I talk to an agent?")).toBe(true);
    expect(userAskedForHuman("بدي احكي مع حدا من الفريق")).toBe(true);
    expect(userAskedForHuman("بدي موظف")).toBe(true);
    expect(userAskedForHuman("how much does a course cost?")).toBe(false);
  });

  it("detects the assistant's own handover sentence", async () => {
    const { replySignalsHandover, handoverNotice } = await loadHelpers();
    expect(replySignalsHandover(handoverNotice("en"))).toBe(true);
    expect(replySignalsHandover(handoverNotice("ar"))).toBe(true);
    expect(replySignalsHandover("Here is the link: https://visionex.app/services")).toBe(false);
  });

  it("never promises a timeline or a ticket number", async () => {
    const { handoverNotice } = await loadHelpers();
    for (const language of ["en", "ar"] as const) {
      expect(handoverNotice(language)).not.toMatch(/\d+\s*(hours?|hrs?|days?|ساعة|ساعات|يوم|أيام)/i);
      expect(handoverNotice(language)).not.toMatch(/ticket|#\d+|رقم الطلب/i);
    }
  });
});

describe("reply clamping", () => {
  it("leaves a normal reply untouched", async () => {
    const { clampReply } = await loadHelpers();
    expect(clampReply("Short answer.")).toBe("Short answer.");
  });

  it("stays under the WhatsApp limit and does not cut mid-word", async () => {
    const { clampReply } = await loadHelpers();
    const long = ("This is a full sentence about Visionex services. ").repeat(200);
    const clamped = clampReply(long);
    expect(clamped.length).toBeLessThanOrEqual(3901);
    expect(clamped.endsWith("…")).toBe(true);
    expect(clamped).toMatch(/\.…$/);
  });
});

describe("signature verification", () => {
  it("accepts a correct signature and rejects tampering", async () => {
    const { verifySignature } = await loadHelpers();
    const secret = "test-app-secret";
    const body = JSON.stringify({ entry: [] });

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

    expect(await verifySignature(body, `sha256=${hex}`, secret)).toBe(true);
    expect(await verifySignature(body + " ", `sha256=${hex}`, secret)).toBe(false);
    expect(await verifySignature(body, `sha256=${hex}`, "wrong-secret")).toBe(false);
    expect(await verifySignature(body, null, secret)).toBe(false);
    expect(await verifySignature(body, "sha256=notahexdigest", secret)).toBe(false);
    expect(await verifySignature(body, hex, secret)).toBe(false);
  });
});

describe("webhook safety contract", () => {
  it("refuses any delivery it cannot attribute to Meta", () => {
    expect(webhook).toContain('req.headers.get("x-hub-signature-256")');
    // Signature is checked before the payload is parsed or acted on.
    const verifyAt = webhook.indexOf("const signed = await verifySignature");
    const parseAt = webhook.indexOf("payload = JSON.parse(rawBody)");
    expect(verifyAt).toBeGreaterThan(-1);
    expect(parseAt).toBeGreaterThan(verifyAt);
    // A missing app secret fails closed rather than skipping the check.
    expect(webhook).toContain('if (!appSecret)');
    expect(webhook).toContain("503");
  });

  it("signs over the raw body, not a re-serialised object", () => {
    expect(webhook).toContain("const rawBody = await req.text()");
    expect(webhook).toContain("verifySignature(rawBody");
  });

  it("makes a Meta retry a no-op instead of a duplicate reply", () => {
    expect(webhook).toContain('dupe.code === "23505"');
    expect(readFileSync("supabase/migrations/20260831010000_whatsapp_conversations.sql", "utf8"))
      .toContain("wa_message_id   text UNIQUE");
  });

  it("stops answering once a human owns the conversation", () => {
    // Phase 4 added an explicit owner-set `control` state alongside the
    // automatic `escalated` flag. Either one must silence the assistant, so
    // this asserts the guard rather than one particular spelling of it.
    expect(webhook).toMatch(/if \(existing\?\.control === "human" \|\| existing\?\.escalated\) continue;/);
  });

  it("reuses the existing assistant registry and provider layer", () => {
    expect(webhook).toContain('getAssistant("whatsapp-support")');
    expect(webhook).toContain("streamChatCompletion");
    expect(assistants).toContain('"whatsapp-support": assistant(');
    // No second AI vendor, and no provider key read here — the shared provider
    // layer owns key handling, so the webhook must never reach for one itself.
    expect(helpers).not.toMatch(/api\.openai\.com|api\.anthropic\.com|generativelanguage/);
    expect(webhook).not.toMatch(/Deno\.env\.get\(\s*["'](OPENAI|ANTHROPIC|GEMINI|GROQ|MISTRAL)_API_KEY/);
  });

  it("keeps every credential in the environment", () => {
    for (const name of [
      "WHATSAPP_VERIFY_TOKEN",
      "WHATSAPP_APP_SECRET",
      "WHATSAPP_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
    ]) {
      expect(webhook).toContain(`Deno.env.get("${name}")`);
    }
    // No literal token, phone number id, or bearer value committed.
    expect(webhook).not.toMatch(/EAA[A-Za-z0-9]{20,}/);
    expect(helpers).not.toMatch(/EAA[A-Za-z0-9]{20,}/);
  });

  it("is exempt from gateway JWT verification, or Meta could never reach it", () => {
    // Meta sends no Supabase JWT. With the default verify_jwt = true the
    // gateway answers 401 before the function runs, so the webhook looks
    // deployed and silently never receives a message. The signature check
    // above is what actually authenticates the caller.
    //
    // The exemption has to be declared twice: config.toml drives
    // `supabase functions serve` locally, while the deploy script passes
    // --no-verify-jwt from its own list and is what production gets. Setting
    // only one of them fails in a way nothing surfaces.
    const config = readFileSync("supabase/config.toml", "utf8");
    const deployScript = readFileSync("scripts/deploy-changed-supabase-functions.sh", "utf8");

    expect(config).toMatch(/\[functions\.whatsapp-webhook\][\s\S]*?verify_jwt\s*=\s*false/);
    expect(deployScript).toMatch(/NO_VERIFY_JWT=\([\s\S]*?\[whatsapp-webhook\]=1[\s\S]*?\)/);
  });

  it("tells the user something even when the provider is down", () => {
    expect(webhook).toContain("failureNotice(language)");
    expect(webhook).toContain('escalation_reason: "ai_unavailable"');
  });
});
