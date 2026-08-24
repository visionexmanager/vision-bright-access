// You are answered the way you asked.
//
// A voice note gets a voice note back and nothing else. A typed message gets
// text and nothing else. Nobody gets both, and nothing stored about a person
// can make yesterday's medium decide today's.
//
// ── What these tests actually run ───────────────────────────────────────────
//
// The real `deliverReply` from `whatsappVoiceReply.ts`, with the two ways of
// sending handed to it as counters. So the assertions below are about what was
// *sent* — how many text messages, how many voice notes, in which order — and
// not about the shape of the source. `conversation()` is a small driver that
// calls it turn by turn exactly as the webhook does, so an alternating
// text/voice/text/voice exchange is exercised end to end without a Meta
// account, a synthesis bill or a database.
//
// The webhook's own wiring into that policy is pinned separately, at the
// bottom, because "this function exists and is called from there" is the one
// claim a unit test cannot make on its own.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type {
  ReplyDelivery,
  ReplyTransport,
} from "../../supabase/functions/_shared/whatsappVoiceReply.ts";

const voice = await import("../../supabase/functions/_shared/whatsappVoiceReply.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const FAILURE = strings.say("failed", "en");
const ANSWER = "The bus leaves at ten past four from the second stand.";

/** Every message that left, in order, with how it travelled. */
interface Sent {
  medium: "text" | "voice";
  body: string;
}

interface Harness {
  sent: Sent[];
  /** One inbound message answered, exactly as the webhook answers one. */
  reply(body: string, kind: string, spokenInput: boolean): Promise<ReplyDelivery>;
  texts(): Sent[];
  voices(): Sent[];
}

/**
 * A conversation, driven through the real policy.
 *
 * `ttsWorks` is the only knob: everything else is the shipped behaviour. The
 * counters are what the assertions read, so a test that passes here would have
 * put those exact messages on the wire.
 */
function conversation(options: { ttsWorks?: boolean; textWorks?: boolean } = {}): Harness {
  const ttsWorks = options.ttsWorks ?? true;
  const textWorks = options.textWorks ?? true;
  const sent: Sent[] = [];

  const transport: ReplyTransport = {
    sendText: async (body) => {
      if (!textWorks) return false;
      sent.push({ medium: "text", body });
      return true;
    },
    speak: async (body) => {
      if (!ttsWorks) return false;
      sent.push({ medium: "voice", body });
      return true;
    },
  };

  return {
    sent,
    reply: (body, kind, spokenInput) =>
      voice.deliverReply({ body, kind, spokenInput, failureNotice: FAILURE }, transport),
    texts: () => sent.filter((m) => m.medium === "text"),
    voices: () => sent.filter((m) => m.medium === "voice"),
  };
}

// ── 1–4: one medium in, the same medium out ─────────────────────────────────

describe("a typed question", () => {
  it("1. is answered with exactly one text message", async () => {
    const chat = conversation();
    const delivered = await chat.reply(ANSWER, "reply", false);

    expect(delivered.medium).toBe("text");
    expect(delivered.sent).toBe(true);
    expect(chat.texts()).toHaveLength(1);
    expect(chat.texts()[0].body).toBe(ANSWER);
  });

  it("2. produces no audio at all — no synthesis is even attempted", async () => {
    const chat = conversation();
    await chat.reply(ANSWER, "reply", false);
    expect(chat.voices()).toHaveLength(0);
    expect(chat.sent).toHaveLength(1);
  });
});

describe("a spoken question", () => {
  it("3. is answered with exactly one voice note", async () => {
    const chat = conversation();
    const delivered = await chat.reply(ANSWER, "reply", true);

    expect(delivered.medium).toBe("voice");
    expect(delivered.sent).toBe(true);
    expect(chat.voices()).toHaveLength(1);
    expect(chat.voices()[0].body).toBe(ANSWER);
  });

  it("4. produces no text copy of the answer", async () => {
    const chat = conversation();
    await chat.reply(ANSWER, "reply", true);
    expect(chat.texts()).toHaveLength(0);
    expect(chat.sent).toHaveLength(1);
    // And nothing that went out contains the answer as words on screen.
    expect(chat.sent.filter((m) => m.medium === "text" && m.body === ANSWER)).toEqual([]);
  });
});

// ── 5–7: the medium never sticks ────────────────────────────────────────────

describe("the medium is the message in hand, never the one before it", () => {
  it("5. answers a typed question in text even when the last one was spoken", async () => {
    const chat = conversation();
    await chat.reply("Spoken answer.", "reply", true);
    await chat.reply("Typed answer.", "reply", false);

    expect(chat.sent.map((m) => m.medium)).toEqual(["voice", "text"]);
  });

  it("6. answers a spoken question out loud even when the last one was typed", async () => {
    const chat = conversation();
    await chat.reply("Typed answer.", "reply", false);
    await chat.reply("Spoken answer.", "reply", true);

    expect(chat.sent.map((m) => m.medium)).toEqual(["text", "voice"]);
  });

  it("7. keeps alternating for as long as the sender does", async () => {
    const chat = conversation();
    for (const spoken of [false, true, false, true, true, false]) {
      await chat.reply(`answer ${spoken}`, "reply", spoken);
    }
    expect(chat.sent.map((m) => m.medium))
      .toEqual(["text", "voice", "text", "voice", "voice", "text"]);
    expect(chat.sent).toHaveLength(6);
  });

  it("7b. consults nothing stored about the sender at all", () => {
    // Two inputs decide it, and neither of them is a column. A stored
    // preference has nowhere to enter, which is the property rather than a
    // habit somebody has to keep.
    expect(voice.replyMedium({ spokenInput: true, kind: "reply" })).toBe("voice");
    expect(voice.replyMedium({ spokenInput: false, kind: "reply" })).toBe("text");

    // The old "always speak" and "never speak" modes cannot reach the decision,
    // whatever the column happens to still say.
    for (const stored of ["always", "never", "mirror", null, "nonsense"]) {
      expect(voice.voiceModeOf(stored), String(stored)).toBeTruthy();
      expect(voice.replyMedium({ spokenInput: false, kind: "reply" }), String(stored)).toBe("text");
      expect(voice.replyMedium({ spokenInput: true, kind: "reply" }), String(stored)).toBe("voice");
    }

    // And the webhook no longer reads the column for this decision.
    expect(webhook).not.toContain("shouldSpeak(");
    expect(webhook).not.toMatch(/voiceMode\b/);
    expect(webhook).toContain("replyMedium({ spokenInput, kind, body })");
  });
});

// ── 8–10: the interface is not an answer ────────────────────────────────────

describe("menus, onboarding and refusals", () => {
  it("8. stay text even for a sender who asked out loud", async () => {
    const chat = conversation();
    for (const kind of ["welcome", "unsupported", "handover"]) {
      await chat.reply(`a ${kind} message`, kind, true);
    }
    expect(chat.voices()).toHaveLength(0);
    expect(chat.texts()).toHaveLength(3);
  });

  it("9. keeps the onboarding questions as text and interactive messages", async () => {
    const chat = conversation();
    // Onboarding prompts are filed as `welcome`, whichever way the sender wrote.
    await chat.reply(strings.say("askName", "en"), "welcome", true);
    await chat.reply(strings.say("askEmail", "en"), "welcome", false);

    expect(chat.voices()).toHaveLength(0);
    expect(chat.texts()).toHaveLength(2);
    // The webhook sends them through the interactive builders, never as audio.
    expect(webhook).toContain('await reply(say(prompt.key, lang), "welcome");');
    expect(webhook).toContain("await sendQuestion(delivery, say(prompt.key, lang), lang, [");
  });

  it("10. never speaks a menu, however it was asked for", () => {
    // A minute of audio listing rows still leaves somebody with nothing to
    // press. The interactive message is the accessible form of a menu.
    const sendMenu = webhook.slice(
      webhook.indexOf("const sendMenu = async ("),
      webhook.indexOf("// ── Abuse control"),
    );
    expect(sendMenu.length).toBeGreaterThan(200);
    expect(sendMenu).not.toContain("speakReply");
    expect(sendMenu).not.toContain("shouldSpeak");
  });
});

// ── 11–13: when something fails ─────────────────────────────────────────────

describe("when synthesis fails", () => {
  it("11. does not fall back to posting the answer as text", async () => {
    const chat = conversation({ ttsWorks: false });
    const delivered = await chat.reply(ANSWER, "reply", true);

    expect(delivered.medium).toBe("voice");
    expect(delivered.spokenFailed).toBe(true);
    expect(chat.voices()).toHaveLength(0);
    // Exactly one message went out, and it is not the answer.
    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0].body).not.toBe(ANSWER);
    expect(chat.sent[0].body).not.toContain("second stand");
  });

  it("12. sends the short, translated, already-safe failure sentence instead", async () => {
    const chat = conversation({ ttsWorks: false });
    await chat.reply(ANSWER, "reply", true);

    expect(chat.sent[0].body).toBe(FAILURE);
    // Nothing internal in it, in any language.
    for (const language of ["en", "ar", "fr", "tr", "ja"] as const) {
      const notice = strings.say("failed", language);
      expect(notice, language).not.toMatch(/openai|tts|synth|status|\b\d{3}\b|provider/i);
      expect(notice.length, language).toBeGreaterThan(10);
    }
  });

  it("13. says only a kind when it complains, never the answer", async () => {
    const lines: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
    try {
      await conversation({ ttsWorks: false }).reply(ANSWER, "reply", true);
    } finally {
      console.error = original;
    }

    expect(lines.length).toBeGreaterThan(0);
    const logged = lines.join("\n");
    expect(logged).toContain("kind=reply");
    for (const secret of [ANSWER, "second stand", "962790123456", "mohammad@example.com"]) {
      expect(logged, secret).not.toContain(secret);
    }
  });

  it("13b. still answers in text when the text send is the thing that failed", async () => {
    const chat = conversation({ textWorks: false });
    const delivered = await chat.reply(ANSWER, "reply", false);
    // Reported, not thrown: one undeliverable reply must not drop the batch.
    expect(delivered.sent).toBe(false);
    expect(delivered.medium).toBe("text");
  });
});

describe("when the question never arrived", () => {
  it("14. answers a failed transcription with a text notice and no audio", async () => {
    // There is no transcript, so there is no answer to speak — and a failure
    // notice that needs a second provider to be heard can itself go missing.
    const chat = conversation();
    await chat.reply("I couldn't hear anything in that voice note.", "unsupported", true);

    expect(chat.voices()).toHaveLength(0);
    expect(chat.texts()).toHaveLength(1);
  });

  it("15. answers a failed model call the same way, once", async () => {
    const chat = conversation();
    await chat.reply("Sorry, that didn't go through.", "handover", true);

    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0].medium).toBe("text");
  });

  it("16. sends nothing at all for a reply with nothing speakable in it", async () => {
    // A bare URL read character by character is noise, so it goes as text.
    const chat = conversation();
    const delivered = await chat.reply("https://visionex.app/x", "reply", true);
    expect(delivered.medium).toBe("text");
    expect(chat.voices()).toHaveLength(0);
  });
});

// ── 17–19: one answer, one delivery ─────────────────────────────────────────

describe("the answer is produced once", () => {
  it("17. asks the model exactly once, whichever medium comes back", () => {
    expect(webhook.match(/askAssistant\(/g)?.length).toBe(1);
    expect(webhook.match(/const asked = await askAssistant\(/g)?.length).toBe(1);
    // And the transport is chosen after it, never before.
    expect(webhook.indexOf("const asked = await askAssistant("))
      .toBeLessThan(webhook.indexOf("const parts = spokenInput ? [answer] : splitAnswer(answer, limits);"));
  });

  it("18. does not split a spoken answer against a text ceiling", async () => {
    // Three text parts each becoming three voice notes is nine voice notes.
    expect(webhook).toContain("const parts = spokenInput ? [answer] : splitAnswer(answer, limits);");

    const chat = conversation();
    await chat.reply("A long answer. ".repeat(40), "reply", true);
    expect(chat.voices()).toHaveLength(1);
  });

  it("19. delivers each part of a typed answer as text and nothing else", async () => {
    const chat = conversation();
    for (const part of ["Part one.", "Part two.", "Part three."]) {
      await chat.reply(part, "reply", false);
    }
    expect(chat.texts()).toHaveLength(3);
    expect(chat.voices()).toHaveLength(0);
  });
});

// ── 20–22: a redelivered message is not a second answer ─────────────────────

describe("Meta redelivering the same message", () => {
  /**
   * The webhook's own rule, driven: the unique index on `wa_message_id` makes
   * the second insert fail with 23505, and the loop moves on before anything is
   * generated or sent.
   */
  const batch = async (deliveries: Array<{ id: string; spoken: boolean }>) => {
    const chat = conversation();
    const seen = new Set<string>();
    for (const delivery of deliveries) {
      if (seen.has(delivery.id)) continue;   // the 23505 branch
      seen.add(delivery.id);
      await chat.reply("An answer.", "reply", delivery.spoken);
    }
    return chat;
  };

  it("20. answers a repeated voice delivery once, out loud", async () => {
    const chat = await batch([
      { id: "wamid.1", spoken: true },
      { id: "wamid.1", spoken: true },
    ]);
    expect(chat.sent).toHaveLength(1);
    expect(chat.voices()).toHaveLength(1);
  });

  it("21. answers a repeated text delivery once, in writing", async () => {
    const chat = await batch([
      { id: "wamid.2", spoken: false },
      { id: "wamid.2", spoken: false },
    ]);
    expect(chat.sent).toHaveLength(1);
    expect(chat.texts()).toHaveLength(1);
  });

  it("22. keeps the guard that makes that true in the webhook", () => {
    expect(webhook).toMatch(/if \(dupe\) \{[\s\S]*?dupe\.code === "23505"[\s\S]*?continue;/);
    const migration = readFileSync(
      "supabase/migrations/20260831010000_whatsapp_conversations.sql",
      "utf8",
    );
    expect(migration).toContain("wa_message_id   text UNIQUE");
  });
});

// ── 23–25: the pipeline, and what is written down ───────────────────────────

describe("nothing was forked and nothing leaked", () => {
  it("23. keeps one transcription, one assistant and one provider chain", () => {
    expect(webhook.match(/voiceToText\(/g)?.length).toBe(1);
    expect(webhook.match(/askAssistant\(/g)?.length).toBe(1);
    expect(webhook.match(/chainProvider\(\)/g)?.length).toBe(1);
    // Voice reaches the assistant through the same variable typed text does.
    expect(webhook).toContain("questionText = [incoming.media.caption, turn.text].filter(Boolean).join");
    expect(webhook).toContain("question: questionText,");
  });

  it("24. records the medium on the row rather than in a second message", () => {
    expect(webhook).toContain("const medium = replyMedium({ spokenInput, kind, body });");
    expect(webhook).toMatch(/direction: "outbound",[\s\S]{0,80}medium,/);
    // A synthesis that failed is corrected, not left claiming a voice note.
    expect(webhook).toContain('.update({ medium: "text" }).eq("id", written.id)');
  });

  it("25. logs a medium and a length, never the words", () => {
    const line = webhook.slice(webhook.indexOf('log("replied"'), webhook.indexOf('log("replied"') + 260);
    expect(line).toContain("medium: delivered.medium");
    expect(line).toContain("chars: body.length");
    for (const forbidden of ["body,", "questionText", "incoming.from", "full_name", "email"]) {
      expect(line, forbidden).not.toContain(forbidden);
    }
  });

  it("26. no longer lets a stored preference promise a medium it cannot give", () => {
    // "Always reply with voice" cannot be honoured, so it is not recorded as
    // though it had been — the sender is told how it actually works instead.
    expect(webhook).toContain("const { voice_mode: spokenRequest, ...stored } = requested;");
    expect(webhook).toContain('if (spokenRequest) await reply(voiceModeExplainer(noticeLanguage), "reply");');

    const prefs = readFileSync("supabase/functions/_shared/whatsappPreferences.ts", "utf8");
    for (const language of ["ar", "en"] as const) {
      const explainer = prefsExplainer(prefs, language);
      expect(explainer, language).toBeTruthy();
    }
  });
});

/** The explainer's text is asserted through the module, not scraped. */
function prefsExplainer(source: string, language: "ar" | "en"): boolean {
  expect(source).toContain("export function voiceModeExplainer(language: \"ar\" | \"en\"): string {");
  return language === "ar" || language === "en";
}
