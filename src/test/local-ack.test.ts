// Answering a spoken greeting or farewell with the recording of the same word.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ACK_FLAG, ackClipActive, ackFor, localAckEnabled, matchAck, normaliseAck } from "../../supabase/functions/_shared/localAck";
import { matchPhrase } from "../../supabase/functions/_shared/localAudio";
import { LOCAL_AUDIO_ASSETS, LOCAL_RESPONSES } from "../../supabase/functions/_shared/localAudioManifest";

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const env = (vars: Record<string, string>) => (name: string) => vars[name];
const BOTH = { [ACK_FLAG]: "1", WHATSAPP_LOCAL_AUDIO: "1" };

// The shipped clips are disabled, so to exercise the active path a test marks one active and always restores it.
const assets = LOCAL_AUDIO_ASSETS as Record<string, { status: string }>;
const saved = new Map<string, string>();
const activate = (...names: string[]) => names.forEach((n) => { saved.set(n, assets[n].status); assets[n].status = "active"; });
afterEach(() => { for (const [n, s] of saved) assets[n].status = s; saved.clear(); });

describe("matching", () => {
  it("matches only a whole-message pleasantry, whatever the case or punctuation", () => {
    for (const heard of ["hello", "Hello.", "  HI!  ", "hey", "Hello?"]) expect(matchAck(heard)?.id, heard).toBe("ack_hello");
    for (const heard of ["goodbye", "Bye.", "bye bye"]) expect(matchAck(heard)?.id, heard).toBe("ack_goodbye");
    expect(matchAck("سلام")).toMatchObject({ id: "ack_hello", language: "ar", reply: "سلام." });
    expect(matchAck("مَرْحَباً")?.id).toBe("ack_hello");
    expect(matchAck("Hello")).toMatchObject({ language: "en", reply: "Hello." });
  });

  it("never matches a greeting that carries anything else", () => {
    for (const heard of [
      "hello what are your prices", "hello, I need help with my plan", "hi there", "say hello to support",
      "no hello", "bye the way how do I subscribe", "goodbye I want to cancel", "hello hello hello",
      "السلام عليكم", "سلام عليكم ورحمة الله", "مرحبا كيف حال اشتراكي", "hello\nI want a refund",
    ]) expect(matchAck(heard), heard).toBeNull();
  });

  it("ignores empty, missing, oversized and unrelated input, including thanks", () => {
    for (const heard of ["", "   ", null, undefined, "x".repeat(500), "thanks", "thank you", "yes", "no", "okay", "sorry", "شكرا", "لا"]) {
      expect(matchAck(heard as never), String(heard)).toBeNull();
    }
  });

  it("does not turn a negation or a different word into a greeting", () => {
    expect(matchAck("not hello")).toBeNull();
    expect(matchAck("hell")).toBeNull();
    expect(matchAck("hi-fi")).toBeNull();
    expect(normaliseAck("Hello!")).toBe("hello");
  });

  it("replies with the exact registered text, which the speaking path resolves to the same clip", () => {
    for (const heard of ["hello", "bye", "سلام"]) {
      const ack = matchAck(heard)!;
      expect(ack.reply).toBe(LOCAL_RESPONSES[ack.id].text![ack.language]);
      expect(matchPhrase(ack.reply, ack.language), heard).toEqual({ id: ack.id, language: ack.language });
    }
  });
});

describe("switches", () => {
  it("is off unless BOTH flags are exactly 1", () => {
    expect(localAckEnabled(env({}))).toBe(false);
    expect(localAckEnabled(env({ [ACK_FLAG]: "1" }))).toBe(false);
    expect(localAckEnabled(env({ WHATSAPP_LOCAL_AUDIO: "1" }))).toBe(false);
    expect(localAckEnabled(env({ [ACK_FLAG]: "true", WHATSAPP_LOCAL_AUDIO: "1" }))).toBe(false);
    expect(localAckEnabled(env(BOTH))).toBe(true);
  });

  it("answers nothing with the flag off, even for a perfect match and an active clip", () => {
    activate("ack_hello.en.ogg");
    expect(ackFor("hello", env({}))).toBeNull();
    expect(ackFor("hello", env({ WHATSAPP_LOCAL_AUDIO: "1" }))).toBeNull();
  });
});

describe("clip approval", () => {
  it("falls through while the clip is disabled, which is every clip today", () => {
    expect(Object.values(LOCAL_AUDIO_ASSETS).every((c) => c.status === "disabled")).toBe(true);
    expect(ackFor("hello", env(BOTH))).toBeNull();
    expect(ackFor("سلام", env(BOTH))).toBeNull();
  });

  it("answers only the language and word whose own clip is active", () => {
    activate("ack_hello.en.ogg");
    expect(ackFor("hello", env(BOTH))).toMatchObject({ id: "ack_hello", language: "en" });
    expect(ackFor("goodbye", env(BOTH))).toBeNull();
    expect(ackFor("سلام", env(BOTH))).toBeNull();
    expect(ackClipActive(matchAck("hello")!)).toBe(true);
  });

  it("never offers an Arabic farewell: no recording exists for it", () => {
    activate("ack_goodbye.en.ogg", "ack_hello.ar.ogg");
    for (const heard of ["مع السلامة", "وداعا", "باي"]) expect(ackFor(heard, env(BOTH)), heard).toBeNull();
  });
});

describe("the webhook", () => {
  const at = (needle: string) => webhook.indexOf(needle);

  it("applies the reply only to a voice note with no caption, behind the helper", () => {
    expect(webhook).toContain('import { ackFor } from "../_shared/localAck.ts";');
    expect(webhook).toMatch(/if \(spokenInput && incoming\.media && !incoming\.media\.caption\) \{\s*const ack = ackFor\(questionText,/);
  });

  it("sits after the plan check and the local text answers, and before triage and the assistant", () => {
    const ack = at("const ack = ackFor(");
    expect(ack).toBeGreaterThan(at("const local = answerLocally("));
    expect(ack).toBeGreaterThan(at("(await entitlement()).allowed"));
    expect(ack).toBeLessThan(at("const askedForHuman = userAskedForHuman("));
    expect(ack).toBeLessThan(at("toolName: \"classify_message\""));
  });

  it("checks entitlement itself and answers through the ordinary reply, so metering, history and idempotency are shared", () => {
    const block = webhook.slice(at("const ack = ackFor("), at("const askedForHuman = userAskedForHuman("));
    expect(block).toContain("(await entitlement()).allowed");
    expect(block).toContain("await reply(ack.reply");
    expect(block).not.toMatch(/sendWhatsApp|speakReply|synthesise|spent\(|db\.from|insert/);
  });

  it("leaves the typed-message local answers untouched", () => {
    expect(webhook).toMatch(/if \(!spokenInput && !incoming\.media\) \{\s+const local = answerLocally\(/);
  });
});
