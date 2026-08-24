// You are answered the way you asked, and only that way.
//
//   inbound text   →  on-screen only, zero audio
//   inbound voice  →  audio only, zero on-screen
//
// One invariant, `expectMediumContract`, is applied to every scenario below —
// an AI answer, a menu, Back, Help, a provider timeout, a failed
// transcription, a six-turn alternating conversation. Nothing stored about a
// person can bend it, because nothing stored is consulted.
//
// ── What these tests actually run ───────────────────────────────────────────
//
// The real `deliverReply` and `deliverMenu`, with the ways of sending handed to
// them as counters. So every assertion is about what was *sent* — how many
// on-screen messages, how many voice notes, in which order — rather than about
// the shape of the source. The webhook's wiring into those functions is pinned
// separately at the bottom, because "this is what production calls" is the one
// claim a unit test cannot make about itself.
//
// ── The guards are checked against known-bad input ──────────────────────────
//
// The last block feeds `expectMediumContract` the three regressions this work
// exists to prevent — text plus voice, a text processing notice for a voice
// sender, a text menu for a voice sender — and asserts it rejects each one. A
// guard that has never been shown a failure is not a guard.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type {
  ReplyDelivery,
  ReplyTransport,
} from "../../supabase/functions/_shared/whatsappVoiceReply.ts";
import type { MenuTransport } from "../../supabase/functions/_shared/whatsappInteractive.ts";
import type { OnboardingPrompt } from "../../supabase/functions/_shared/whatsappOnboarding.ts";

const voice = await import("../../supabase/functions/_shared/whatsappVoiceReply.ts");
const interactive = await import("../../supabase/functions/_shared/whatsappInteractive.ts");
const onboarding = await import("../../supabase/functions/_shared/whatsappOnboarding.ts");
const assistant = await import("../../supabase/functions/_shared/whatsappAssistant.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const FAILURE = strings.say("failed", "en");
const ANSWER = "The bus leaves at ten past four from the second stand.";
const PHONE = "962790123456";

// ── The harness ─────────────────────────────────────────────────────────────

/**
 * How one outgoing message reached the sender.
 *
 * `interactive` is its own value rather than a flavour of text, because the two
 * are different products — but for the contract they count the same: both are
 * something a person has to look at, and neither may reach somebody who spoke.
 */
type Medium = "text" | "interactive" | "voice";

interface Sent {
  medium: Medium;
  body: string;
}

const onScreen = (sent: readonly Sent[]) => sent.filter((m) => m.medium !== "voice");
const audio = (sent: readonly Sent[]) => sent.filter((m) => m.medium === "voice");

/**
 * The invariant, in one place, applied to every scenario.
 *
 * Deliberately strict about *zero*, not about "mostly": one stray text message
 * in front of a voice note is the entire failure this work exists to remove.
 */
function expectMediumContract(sent: readonly Sent[], spokenInput: boolean, label = "") {
  const where = label ? `${label}: ` : "";
  expect(sent.length, `${where}nothing was sent at all`).toBeGreaterThan(0);

  if (spokenInput) {
    expect(onScreen(sent).map((m) => m.body), `${where}a voice sender was shown text`).toEqual([]);
    expect(audio(sent).length, `${where}expected audio`).toBe(sent.length);
  } else {
    expect(audio(sent).map((m) => m.body), `${where}a text sender was sent audio`).toEqual([]);
    expect(onScreen(sent).length, `${where}expected on-screen`).toBe(sent.length);
  }
}

interface Session {
  sent: Sent[];
  /** An AI answer, or any other substantive reply. */
  answer(body: string, spokenInput: boolean): Promise<ReplyDelivery>;
  /** A refusal, an apology, a "that isn't open yet". */
  notice(body: string, spokenInput: boolean, kind?: string): Promise<ReplyDelivery>;
  /** A menu, by catalog node id. */
  menu(nodeId: string, spokenInput: boolean): Promise<void>;
  /** One onboarding outcome's prompts, filtered by the real medium rule. */
  onboard(prompts: readonly OnboardingPrompt[], spokenInput: boolean, isFirst: boolean): Promise<void>;
}

function session(options: { ttsWorks?: boolean; textWorks?: boolean } = {}): Session {
  const ttsWorks = options.ttsWorks ?? true;
  const textWorks = options.textWorks ?? true;
  const sent: Sent[] = [];

  const replyTransport: ReplyTransport = {
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

  const menuTransport: MenuTransport = {
    tap: async (message) => {
      if (!textWorks) return false;
      sent.push({ medium: "interactive", body: message.text });
      return true;
    },
    speak: async (text) => {
      if (!ttsWorks) return false;
      sent.push({ medium: "voice", body: text });
      return true;
    },
  };

  return {
    sent,
    answer: (body, spokenInput) =>
      voice.deliverReply({ body, kind: "reply", spokenInput, failureNotice: FAILURE }, replyTransport),
    notice: (body, spokenInput, kind = "unsupported") =>
      voice.deliverReply({ body, kind, spokenInput, failureNotice: FAILURE }, replyTransport),
    menu: async (nodeId, spokenInput) => {
      const message = interactive.menuMessage(nodeId, "en");
      expect(message, `no menu for ${nodeId}`).not.toBeNull();
      await interactive.deliverMenu({ message: message!, spokenInput }, menuTransport);
    },
    onboard: async (prompts, spokenInput, isFirst) => {
      for (const prompt of onboarding.promptsForMedium(prompts, spokenInput, isFirst)) {
        if (prompt.type === "text") {
          await voice.deliverReply(
            { body: strings.say(prompt.key, "en"), kind: "welcome", spokenInput, failureNotice: FAILURE },
            replyTransport,
          );
        } else if (prompt.type === "question") {
          sent.push({ medium: "interactive", body: strings.say(prompt.key, "en") });
        } else if (prompt.type === "language") {
          sent.push({ medium: "interactive", body: interactive.languageMessage(prompt.page).text });
        } else if (prompt.type === "gender" || prompt.type === "country") {
          const message = prompt.type === "gender"
            ? interactive.genderMessage("en")
            : interactive.countryMessage("en", PHONE);
          sent.push({ medium: "interactive", body: message.text });
        }
      }
    },
  };
}

// ── 1–2: the plain case, both ways ──────────────────────────────────────────

describe("a normal AI answer", () => {
  it("1. typed in, one text message out, no audio", async () => {
    const chat = session();
    const delivered = await chat.answer(ANSWER, false);

    expect(delivered.medium).toBe("text");
    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0].body).toBe(ANSWER);
    expectMediumContract(chat.sent, false);
  });

  it("2. spoken in, one voice note out, no text", async () => {
    const chat = session();
    const delivered = await chat.answer(ANSWER, true);

    expect(delivered.medium).toBe("voice");
    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0].body).toBe(ANSWER);
    expectMediumContract(chat.sent, true);
  });
});

// ── 3–5: multi-turn, and switching ──────────────────────────────────────────

describe("a conversation with several turns", () => {
  it("3. holds the contract on every turn of an alternating exchange", async () => {
    const turns = [false, true, false, true, true, false, true];
    for (const spoken of turns) {
      const chat = session();
      await chat.answer(`answer for ${spoken}`, spoken);
      expectMediumContract(chat.sent, spoken, `turn spoken=${spoken}`);
    }
  });

  it("4. switches text → voice without carrying the medium across", async () => {
    const chat = session();
    await chat.answer("Typed answer.", false);
    await chat.answer("Spoken answer.", true);
    expect(chat.sent.map((m) => m.medium)).toEqual(["text", "voice"]);
  });

  it("5. switches voice → text without carrying the medium across", async () => {
    const chat = session();
    await chat.answer("Spoken answer.", true);
    await chat.answer("Typed answer.", false);
    expect(chat.sent.map((m) => m.medium)).toEqual(["voice", "text"]);
  });
});

// ── 6–10: navigation ────────────────────────────────────────────────────────

describe("menus and navigation", () => {
  it("6. shows a typed sender a tappable menu, and no audio", async () => {
    const chat = session();
    await chat.menu(catalog.ROOT_ID, false);
    expect(chat.sent.map((m) => m.medium)).toEqual(["interactive"]);
    expectMediumContract(chat.sent, false);
  });

  it("7. reads the menu to a voice sender, and shows them nothing", async () => {
    const chat = session();
    await chat.menu(catalog.ROOT_ID, true);
    expect(chat.sent.map((m) => m.medium)).toEqual(["voice"]);
    expectMediumContract(chat.sent, true);
    // What was read is a real menu: every feature named, and a way to answer.
    expect(chat.sent[0].body).toContain("AI Assistant");
    expect(chat.sent[0].body).toContain(strings.say("textMenuHint", "en"));
  });

  it("8. does the same for Back, Main menu and a feature submenu", async () => {
    for (const nodeId of [catalog.ROOT_ID, "assistant", "ocr", "services", "support", "more"]) {
      for (const spoken of [false, true]) {
        const chat = session();
        await chat.menu(nodeId, spoken);
        expectMediumContract(chat.sent, spoken, `${nodeId} spoken=${spoken}`);
      }
    }
  });

  it("9. reads Help aloud to a voice sender rather than printing it", async () => {
    const chat = session();
    await chat.notice(strings.say("help", "en"), true, "reply");
    expectMediumContract(chat.sent, true);
    expect(chat.sent[0].body).toContain("Back");
  });

  it("10. speaks a menu a voice sender named rather than tapped", async () => {
    // "menu", spoken, resolves through the same engine and comes back the same
    // way — a spoken menu, not a printed one.
    const chat = session();
    await chat.menu("services", true);
    expect(audio(chat.sent)).toHaveLength(1);
    expect(onScreen(chat.sent)).toHaveLength(0);
  });
});

// ── 11–15: everything that can go wrong ─────────────────────────────────────

describe("failures", () => {
  it("11. answers a provider timeout in the sender's own medium", async () => {
    for (const spoken of [false, true]) {
      const chat = session();
      await chat.notice("Sorry — that didn't go through. Please try again.", spoken, "handover");
      expectMediumContract(chat.sent, spoken, `timeout spoken=${spoken}`);
    }
  });

  it("12. answers an empty model answer the same way", async () => {
    for (const spoken of [false, true]) {
      const chat = session();
      await chat.notice(FAILURE, spoken, "handover");
      expectMediumContract(chat.sent, spoken, `empty spoken=${spoken}`);
    }
  });

  it("13. answers a provider fallback the same way — one answer, one medium", async () => {
    // A fallback is still one answer: the chain is internal and never doubles
    // what the sender receives.
    for (const spoken of [false, true]) {
      const chat = session();
      await chat.answer("Answered by the second provider.", spoken);
      expect(chat.sent, `fallback spoken=${spoken}`).toHaveLength(1);
      expectMediumContract(chat.sent, spoken, `fallback spoken=${spoken}`);
    }
  });

  it("14. speaks a failed transcription rather than printing it", async () => {
    // The notice is not sent twice, and it is not sent as text: synthesis and
    // transcription are separate providers, so one going down does not take the
    // other with it.
    const chat = session();
    await chat.notice("I couldn't hear anything in that voice note.", true);

    expect(chat.sent).toHaveLength(1);
    expectMediumContract(chat.sent, true);
    // And nothing from the provider is in it.
    expect(chat.sent[0].body).not.toMatch(/whisper|groq|openai|\b\d{3}\b|error/i);
  });

  it("15. falls back to writing the notice out when synthesis is down too", async () => {
    // The documented exception, and the reason it is the right one: silence
    // after a voice note is indistinguishable from not having been heard.
    const chat = session({ ttsWorks: false });
    const notice = "I couldn't hear anything in that voice note.";
    const delivered = await chat.notice(notice, true);

    expect(delivered.spokenFailed).toBe(true);
    expect(chat.sent).toEqual([{ medium: "text", body: notice }]);
    // The notice itself, not a vaguer one: replacing it would tell them less.
    expect(chat.sent[0].body).toBe(notice);
  });

  it("16. never posts the answer as text when synthesis fails", async () => {
    const chat = session({ ttsWorks: false });
    const delivered = await chat.answer(ANSWER, true);

    expect(delivered.spokenFailed).toBe(true);
    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0].body).toBe(FAILURE);
    expect(chat.sent[0].body).not.toContain("second stand");
  });

  it("17. says only a kind when it complains", async () => {
    const lines: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
    try {
      await session({ ttsWorks: false }).answer(ANSWER, true);
    } finally {
      console.error = original;
    }

    expect(lines.join("\n")).toContain("kind=reply");
    for (const secret of [ANSWER, "second stand", PHONE, "mohammad@example.com"]) {
      expect(lines.join("\n"), secret).not.toContain(secret);
    }
  });
});

// ── 18–19: the processing notice ────────────────────────────────────────────

describe("the processing notice", () => {
  const limits = assistant.assistantLimits(() => undefined);
  const longQuestion = "x".repeat(limits.slowQuestionChars + 50);

  it("18. never reaches a voice sender, however long the question", async () => {
    expect(assistant.shouldAnnounceWork(longQuestion, limits, true)).toBe(false);
    expect(assistant.shouldAnnounceWork("x".repeat(4000), limits, true)).toBe(false);
    // Still there for somebody who typed, which is who it was ever for.
    expect(assistant.shouldAnnounceWork(longQuestion, limits, false)).toBe(true);
    expect(assistant.shouldAnnounceWork(longQuestion, limits)).toBe(true);
  });

  it("19. leaves a voice question with zero text through processing and delivery", async () => {
    // The whole turn: the notice that is no longer sent, then the answer.
    const chat = session();
    if (assistant.shouldAnnounceWork(longQuestion, limits, true)) {
      await chat.notice(strings.say("processing", "en"), true);
    }
    await chat.answer(ANSWER, true);

    expect(onScreen(chat.sent)).toEqual([]);
    expect(chat.sent).toHaveLength(1);
    expectMediumContract(chat.sent, true);

    // And the webhook asks the same question the same way.
    expect(webhook).toContain("shouldAnnounceWork(questionText, limits, spokenInput)");
  });
});

// ── 20–23: onboarding ───────────────────────────────────────────────────────

describe("onboarding", () => {
  const NAME_PROMPTS: OnboardingPrompt[] = [
    { type: "text", key: "onboardingNeedsText" },
    { type: "question", key: "askName" },
  ];
  const LANGUAGE_PROMPTS: OnboardingPrompt[] = [
    { type: "text", key: "onboardingNeedsText" },
    { type: "language", page: 1 },
  ];

  it("20. shows a typed sender the controls, and no audio", async () => {
    for (const prompts of [LANGUAGE_PROMPTS, NAME_PROMPTS]) {
      const chat = session();
      await chat.onboard(prompts, false, false);
      expectMediumContract(chat.sent, false, "typed onboarding");
    }
  });

  it("21. answers a voice note mid-onboarding out loud, and re-sends no control", async () => {
    const chat = session();
    await chat.onboard(NAME_PROMPTS, true, false);

    expect(chat.sent.map((m) => m.medium)).toEqual(["voice"]);
    expectMediumContract(chat.sent, true, "voice mid-onboarding");
    expect(chat.sent[0].body).toBe(strings.say("onboardingNeedsText", "en"));
  });

  it("22. does the same for language, gender and country steps", async () => {
    const steps: OnboardingPrompt[][] = [
      [{ type: "text", key: "onboardingNeedsText" }, { type: "language", page: 2 }],
      [{ type: "text", key: "onboardingNeedsText" }, { type: "gender" }],
      [{ type: "text", key: "onboardingNeedsText" }, { type: "country" }],
    ];
    for (const prompts of steps) {
      const chat = session();
      await chat.onboard(prompts, true, false);
      expectMediumContract(chat.sent, true, prompts[1].type);
      expect(chat.sent, prompts[1].type).toHaveLength(1);
    }
  });

  it("23. THE ONE EXCEPTION: a first-ever voice note gets the language list, silently", async () => {
    // Nothing is in the thread yet, so there is nothing to tap, and a language
    // cannot be spoken into existence — it is chosen by tapping a row. This is
    // the single point in the channel where somebody who spoke is shown
    // something, it happens once per conversation, and it is asserted here on
    // purpose rather than slipping through.
    const chat = session();
    await chat.onboard(LANGUAGE_PROMPTS, true, true);

    expect(chat.sent.map((m) => m.medium)).toEqual(["interactive"]);
    // Crucially: shown, not shown *and* spoken. No duplication either way.
    expect(audio(chat.sent)).toEqual([]);
    expect(chat.sent[0].body).toContain("English");

    // And it really is only the first message: the very next one obeys the rule.
    const second = session();
    await second.onboard(LANGUAGE_PROMPTS, true, false);
    expectMediumContract(second.sent, true, "second message");
  });

  it("24. keeps profile collection on the same rule, both ways", async () => {
    const profile: OnboardingPrompt[] = [{ type: "question", key: "askEmail" }];
    const typed = session();
    await typed.onboard(profile, false, false);
    expectMediumContract(typed.sent, false, "typed profile step");

    // A voice note at the email step gets the sentence, spoken, and no re-ask.
    const spoken = session();
    await spoken.onboard([{ type: "text", key: "onboardingNeedsText" }, ...profile], true, false);
    expectMediumContract(spoken.sent, true, "spoken profile step");
  });
});

// ── 25–26: duplicates ───────────────────────────────────────────────────────

describe("Meta redelivering the same message", () => {
  const batch = async (deliveries: Array<{ id: string; spoken: boolean }>) => {
    const chat = session();
    const seen = new Set<string>();
    for (const delivery of deliveries) {
      if (seen.has(delivery.id)) continue;   // the 23505 branch
      seen.add(delivery.id);
      await chat.answer("An answer.", delivery.spoken);
    }
    return chat;
  };

  it("25. answers a repeated voice delivery once, out loud", async () => {
    const chat = await batch([{ id: "wamid.1", spoken: true }, { id: "wamid.1", spoken: true }]);
    expect(chat.sent).toHaveLength(1);
    expectMediumContract(chat.sent, true);
  });

  it("26. answers a repeated text delivery once, in writing", async () => {
    const chat = await batch([{ id: "wamid.2", spoken: false }, { id: "wamid.2", spoken: false }]);
    expect(chat.sent).toHaveLength(1);
    expectMediumContract(chat.sent, false);
  });
});

// ── 27–30: the wiring, and what nothing may bring back ──────────────────────

describe("the webhook is wired to exactly this policy", () => {
  it("27. decides the medium in one place, from the inbound message only", () => {
    expect(webhook).toContain("const medium = replyMedium({ spokenInput, body });");
    expect(webhook).toContain("const delivered = await deliverReply(");
    expect(webhook).toContain("const shown = await deliverMenu(");
    expect(webhook).toContain("promptsForMedium(outcome.prompts, spokenInput, isNew)");

    // Nothing stored can reach the decision.
    expect(webhook).not.toContain("shouldSpeak(");
    expect(webhook).not.toMatch(/voiceMode\b/);
    const policy = readFileSync("supabase/functions/_shared/whatsappVoiceReply.ts", "utf8");
    expect(policy).not.toContain("export function shouldSpeak");
    expect(policy).toMatch(/export function replyMedium\(params: \{\s*[\s\S]{0,400}?spokenInput: boolean;/);
  });

  it("28. keeps one transcription, one assistant and one provider chain", () => {
    expect(webhook.match(/voiceToText\(/g)?.length).toBe(1);
    expect(webhook.match(/askAssistant\(/g)?.length).toBe(1);
    expect(webhook.match(/chainProvider\(\)/g)?.length).toBe(1);
    expect(webhook).toContain("question: questionText,");
  });

  it("29. records how each message travelled", () => {
    expect(webhook).toMatch(/direction: "outbound",[\s\S]{0,80}medium,/);
    expect(webhook).toContain('medium: spokenInput ? "voice" : "text",');
    expect(webhook).toContain('.update({ medium: "text" }).eq("id", written.id)');
  });

  it("30. logs a medium and a length, never the words", () => {
    for (const event of ['log("replied"', 'log("menu"']) {
      const line = webhook.slice(webhook.indexOf(event), webhook.indexOf(event) + 260);
      expect(line, event).toContain("medium:");
      for (const forbidden of ["questionText", "incoming.from", "full_name", "email"]) {
        expect(line, `${event} ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

// ── 31: the guards are shown a failure ──────────────────────────────────────

describe("the contract check itself rejects the regressions", () => {
  const rejects = (sent: Sent[], spokenInput: boolean) => {
    let threw = false;
    try {
      expectMediumContract(sent, spokenInput);
    } catch {
      threw = true;
    }
    return threw;
  };

  it("31. fails on text + voice, on a text notice for voice, on a text menu for voice", () => {
    // 1. The old behaviour: the answer sent twice, once to read and once to hear.
    expect(rejects([
      { medium: "text", body: ANSWER },
      { medium: "voice", body: ANSWER },
    ], true), "text + voice was accepted").toBe(true);

    // 2. A text processing notice in front of a spoken answer.
    expect(rejects([
      { medium: "text", body: strings.say("processing", "en") },
      { medium: "voice", body: ANSWER },
    ], true), "a text processing notice was accepted").toBe(true);

    // 3. A tappable menu sent to somebody who asked out loud.
    expect(rejects([
      { medium: "interactive", body: "*Visionex menu*" },
    ], true), "a text menu for a voice sender was accepted").toBe(true);

    // 4. And the mirror image: audio for somebody who typed.
    expect(rejects([
      { medium: "text", body: ANSWER },
      { medium: "voice", body: ANSWER },
    ], false), "audio for a typed question was accepted").toBe(true);

    // 5. Silence is a failure too — a contract that accepts nothing sent would
    //    pass every scenario above by doing nothing at all.
    expect(rejects([], true), "sending nothing was accepted").toBe(true);
    expect(rejects([], false), "sending nothing was accepted").toBe(true);

    // And the shapes it must accept, so the check is not simply always failing.
    expect(rejects([{ medium: "voice", body: ANSWER }], true)).toBe(false);
    expect(rejects([{ medium: "text", body: ANSWER }], false)).toBe(false);
    expect(rejects([{ medium: "interactive", body: "*Visionex menu*" }], false)).toBe(false);
  });

  it("32. would catch the implementation being changed back", async () => {
    // Not a description of a regression — the regressions themselves, driven
    // through the same harness the passing tests use, so the difference between
    // the two is the implementation and nothing else.

    // Reverting `replyMedium` to "text always, audio as an addition":
    const both = session();
    await both.answer(ANSWER, true);
    both.sent.unshift({ medium: "text", body: ANSWER });   // what the old code did
    expect(rejects(both.sent, true)).toBe(true);

    // Reverting the processing notice:
    const notice = session();
    await notice.notice(strings.say("processing", "en"), true);
    notice.sent[0] = { medium: "text", body: strings.say("processing", "en") };
    expect(rejects(notice.sent, true)).toBe(true);

    // Reverting the menu to always-interactive:
    const menu = session();
    await menu.menu(catalog.ROOT_ID, true);
    expect(rejects(menu.sent, true)).toBe(false);          // as shipped: spoken
    menu.sent[0] = { medium: "interactive", body: menu.sent[0].body };
    expect(rejects(menu.sent, true)).toBe(true);           // as it used to be
  });
});
