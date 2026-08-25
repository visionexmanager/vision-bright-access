// Voice as an input mode of the AI Assistant.
//
// Two seams do the work here and both are exercised for real: `voiceToText`
// takes its download and its transcriber as arguments, and `askAssistant` takes
// its provider as one. So a voice turn can be driven end to end — a recording
// arrives, becomes words, those words reach a provider carrying the thread's
// context, and an answer comes back — without a single network call, a single
// mock of a module, or a single assertion that a string appears in a file.
//
// Where something genuinely cannot be reached that way (the webhook's own
// ordering, the transcript row it writes) the assertion is against source and
// says so.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { AskProvider, AskRequest } from "../../supabase/functions/_shared/whatsappAsk.ts";
import type { EngineContext } from "../../supabase/functions/_shared/whatsappEngine.ts";
import type { SessionState } from "../../supabase/functions/_shared/whatsappSession.ts";
import type { Turn } from "../../supabase/functions/_shared/whatsapp.ts";
import type { MediaResult } from "../../supabase/functions/_shared/whatsappMedia.ts";
import type { TranscriptionResult } from "../../supabase/functions/_shared/whatsappTranscribe.ts";
import type { VoiceTurnDeps } from "../../supabase/functions/_shared/whatsappVoiceTurn.ts";

const voice = await import("../../supabase/functions/_shared/whatsappVoiceTurn.ts");
const ask = await import("../../supabase/functions/_shared/whatsappAsk.ts");
const ai = await import("../../supabase/functions/_shared/whatsappAssistant.ts");
const engine = await import("../../supabase/functions/_shared/whatsappEngine.ts");
const sessions = await import("../../supabase/functions/_shared/whatsappSession.ts");
const media = await import("../../supabase/functions/_shared/whatsappMedia.ts");
const stt = await import("../../supabase/functions/_shared/whatsappTranscribe.ts");
const speech = await import("../../supabase/functions/_shared/whatsappVoiceReply.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const NOW = Date.parse("2026-08-23T12:00:00Z");

// ── Fakes ───────────────────────────────────────────────────────────────────

const audio = (bytes = 2_048, mimeType = "audio/ogg"): MediaResult =>
  ({ ok: true, bytes: new Uint8Array(bytes), mimeType });

/** A voice pipeline whose two steps answer exactly what a case needs. */
function fakeVoice(
  transcript: TranscriptionResult | (() => Promise<never>),
  download: MediaResult | (() => Promise<never>) = audio(),
) {
  const calls = { download: 0, transcribe: 0 };
  const deps: VoiceTurnDeps = {
    download: async () => {
      calls.download += 1;
      if (typeof download === "function") return await download();
      return download;
    },
    transcribe: async () => {
      calls.transcribe += 1;
      if (typeof transcript === "function") return await transcript();
      return transcript;
    },
  };
  return { deps, calls };
}

/** A provider that records every request it is given. */
function fakeProvider(answers: string[] | (() => Promise<never>)) {
  const seen: AskRequest[] = [];
  let next = 0;
  const provider: AskProvider = async (request) => {
    seen.push(request);
    if (typeof answers === "function") return await answers();
    return {
      text: answers[Math.min(next++, answers.length - 1)],
      provider: "mistral",
      model: "mistral-small-latest",
    };
  };
  return { provider, seen, get calls() { return seen.length; } };
}

const heard = (text: string): TranscriptionResult => ({ ok: true, text, provider: "groq" });

const context = (over: Partial<EngineContext> = {}): EngineContext => ({
  language: "en",
  nowMs: NOW,
  timeoutMs: 30 * 60_000,
  available: ["ai", "vision", "speech_to_text", "text_to_speech", "location", "bazaar"],
  isNewConversation: false,
  ...over,
});

const live = (over: Partial<SessionState> = {}): SessionState => ({
  ...sessions.freshSession(),
  updatedAt: new Date(NOW - 60_000).toISOString(),
  ...over,
});

const inVoiceInput = () => live({
  path: ["main", "assistant", "assistant.voice"],
  feature: "assistant.voice",
  step: ai.AI_VOICE_INPUT,
});

/** One voice turn, end to end, exactly as the webhook composes it. */
async function voiceTurn(
  transcript: TranscriptionResult | (() => Promise<never>),
  provider: AskProvider,
  options: { turns?: Turn[]; systemParts?: string[]; timeoutMs?: number } = {},
) {
  const fake = fakeVoice(transcript);
  const spoken = await voice.voiceToText("wamid.voice.1", fake.deps);
  if (spoken.status !== "heard") return { spoken, asked: null, fake };

  const asked = await ask.askAssistant(
    {
      systemParts: options.systemParts ?? ["You are the Visionex assistant."],
      turns: options.turns,
      question: spoken.text,
      timeoutMs: options.timeoutMs,
    },
    provider,
  );
  return { spoken, asked, fake };
}

// ── Navigation ──────────────────────────────────────────────────────────────

describe("reaching the voice question", () => {
  it("opens AI_VOICE_INPUT from the assistant menu with 2", () => {
    const outcome = engine.runEngine(
      { text: "2", kind: "text" },
      live({ path: ["main", "assistant"] }),
      context(),
    );
    expect(outcome.kind).toBe("delegate");
    if (outcome.kind !== "delegate") return;
    expect(outcome.node.id).toBe("assistant.voice");
    expect(outcome.node.handler).toBe("ai_voice");
    // The webhook opens the state and says what it is waiting for.
    expect(webhook).toContain("const step = node.handler === \"ai_ask\" ? AI_TEXT_INPUT : AI_VOICE_INPUT;");
  });

  it("asks for the recording in words, not in an emoji", () => {
    for (const language of ["ar", "en"] as const) {
      const prompt = ai.assistantSays("askForVoice", language);
      // Strip every emoji and the sentence must still say what to do.
      const withoutEmoji = prompt.replace(/\p{Extended_Pictographic}️?/gu, "").trim();
      expect(withoutEmoji.length, language).toBeGreaterThan(20);
      expect(withoutEmoji, language).toMatch(language === "ar" ? /صوتية/ : /voice/i);
      // Short enough to hear without losing the instruction at the end.
      expect(prompt.length, language).toBeLessThan(160);
    }
  });

  it("leaves with 0, goes home with 00, and stops with #", () => {
    const back = engine.runEngine({ text: "0", kind: "text" }, inVoiceInput(), context());
    expect(back.session.path).toEqual(["main", "assistant"]);
    expect(back.session.step).toBeNull();

    const home = engine.runEngine({ text: "00", kind: "text" }, inVoiceInput(), context());
    expect(home.session.path).toEqual(["main"]);
    expect(home.session.feature).toBeNull();

    const cancelled = engine.runEngine({ text: "#", kind: "text" }, {
      ...inVoiceInput(),
      pending: { operation: ai.AI_VOICE_INPUT, startedAt: new Date(NOW - 1_000).toISOString() },
    }, context());
    expect(cancelled.reason).toBe("cancel_command");
    expect(cancelled.session.pending).toBeNull();
    expect(cancelled.session.path).toEqual(["main", "assistant", "assistant.voice"]);
  });

  it("answers typed words in the voice state instead of treating them as a command", () => {
    // Somebody who types their question rather than recording it has still
    // asked a question; insisting on a recording would be pedantry.
    const outcome = engine.runEngine(
      { text: "actually, what is Visionex?", kind: "text" },
      inVoiceInput(),
      context(),
    );
    expect(outcome.kind).toBe("delegate");
    expect(outcome.reason).toBe("inside_feature");
    if (outcome.kind !== "delegate") return;
    expect(outcome.node.id).toBe("assistant.voice");
  });
});

// ── The happy path ──────────────────────────────────────────────────────────

describe("a voice question, end to end", () => {
  it("becomes words, reaches the provider, and comes back as an answer", async () => {
    const provider = fakeProvider(["Visionex is an inclusive platform."]);
    const { spoken, asked } = await voiceTurn(heard("What is Visionex?"), provider.provider);

    expect(spoken.status).toBe("heard");
    if (spoken.status !== "heard") return;
    expect(spoken.text).toBe("What is Visionex?");
    expect(spoken.provider).toBe("groq");

    expect(asked?.status).toBe("answered");
    if (asked?.status !== "answered") return;
    expect(asked.text).toBe("Visionex is an inclusive platform.");

    // The provider saw the transcript, and only the transcript.
    expect(provider.calls).toBe(1);
    expect(provider.seen[0].messages.at(-1)?.content).toBe("What is Visionex?");
  });

  it("does not call the provider directly from the voice path", () => {
    // Voice converges on the same ask as text: one call site, one seam.
    expect(webhook.match(/askAssistant\(/g)?.length).toBe(1);
    expect(webhook).not.toMatch(/streamChatCompletionWithFallback\([\s\S]{0,200}transcribe/);
  });
});

// ── One thread, both mediums ────────────────────────────────────────────────

describe("voice and text in one conversation", () => {
  it("keeps text → voice → text → voice in the same thread", async () => {
    const provider = fakeProvider([
      "Visionex is an inclusive platform.",
      "It works through the web and WhatsApp.",
      "For example, you can shop in the bazaar.",
      "Put simply: it is one place for many services.",
    ]);
    const turns: Turn[] = [];

    // 1. Typed.
    turns.push({ role: "user", content: "What is Visionex?" });
    let asked = await ask.askAssistant(
      { systemParts: ["system"], turns, question: "What is Visionex?" },
      provider.provider,
    );
    expect(asked.status).toBe("answered");
    if (asked.status !== "answered") return;
    turns.push({ role: "assistant", content: asked.text });

    // 2. Spoken — same thread, so the replay carries the typed turns.
    const second = await voiceTurn(heard("How does it work?"), provider.provider, {
      turns: [...turns, { role: "user", content: "How does it work?" }],
    });
    expect(second.asked?.status).toBe("answered");
    turns.push({ role: "user", content: "How does it work?" });
    if (second.asked?.status === "answered") turns.push({ role: "assistant", content: second.asked.text });

    // 3. Typed again.
    turns.push({ role: "user", content: "Give me an example." });
    asked = await ask.askAssistant(
      { systemParts: ["system"], turns, question: "Give me an example." },
      provider.provider,
    );
    if (asked.status !== "answered") return;
    turns.push({ role: "assistant", content: asked.text });

    // 4. Spoken again.
    const fourth = await voiceTurn(heard("Can you explain that more simply?"), provider.provider, {
      turns: [...turns, { role: "user", content: "Can you explain that more simply?" }],
    });
    expect(fourth.asked?.status).toBe("answered");

    // Four asks, one growing thread: the last request carries every earlier
    // turn, spoken and typed alike, in order.
    expect(provider.calls).toBe(4);
    const last = provider.seen[3];
    const replayed = last.messages.map((m) => m.content);
    expect(replayed).toContain("What is Visionex?");
    expect(replayed).toContain("How does it work?");
    expect(replayed).toContain("Give me an example.");
    expect(replayed.at(-1)).toBe("Can you explain that more simply?");
    // Nothing was duplicated by the medium changing.
    expect(new Set(replayed).size).toBe(replayed.length);
  });

  it("stays in the same feature across turns, so no thread is started per note", () => {
    let state = inVoiceInput();
    for (const spokenText of ["What is Visionex?", "How does it work?", "One more thing"]) {
      const outcome = engine.runEngine({ text: spokenText, kind: "audio" }, state, context());
      expect(outcome.kind).toBe("delegate");
      state = outcome.session;
      expect(state.feature).toBe("assistant.voice");
    }
    // Only "3 New conversation" moves the line, and it is the only thing that
    // writes a new thread id.
    expect(webhook.match(/ai_thread_id: crypto\.randomUUID\(\)/g)?.length).toBe(1);
  });
});

// ── When the recording does not work out ────────────────────────────────────

describe("recovering from a voice turn that fails", () => {
  it("reports an empty transcription without spending a model call", async () => {
    const provider = fakeProvider(["should never be asked"]);
    const { spoken, asked } = await voiceTurn({ ok: false, reason: "empty" }, provider.provider);

    expect(spoken.status).toBe("not_heard");
    if (spoken.status !== "not_heard") return;
    expect(spoken.reason).toBe("empty");
    expect(asked).toBeNull();
    expect(provider.calls).toBe(0);
    // And the sender is told what to do about it, in their own language.
    expect(stt.transcriptionFailureNotice("en", "empty")).toMatch(/couldn't hear|try again/i);
    expect(stt.transcriptionFailureNotice("ar", "empty")).toContain("لم أسمع");
  });

  it("treats a transcript of pure whitespace as nothing heard", async () => {
    const provider = fakeProvider(["should never be asked"]);
    const { spoken } = await voiceTurn(heard("   \n  "), provider.provider);
    expect(spoken.status).toBe("not_heard");
    if (spoken.status !== "not_heard") return;
    expect(spoken.reason).toBe("empty");
    expect(provider.calls).toBe(0);
  });

  it("reports a transcriber that failed, and never its error text", async () => {
    const fake = fakeVoice(() => Promise.reject(new Error("whisper said: 'my card is 4111 1111'")));
    const outcome = await voice.voiceToText("wamid.1", fake.deps);
    expect(outcome.status).toBe("not_heard");
    if (outcome.status !== "not_heard") return;
    expect(outcome.reason).toBe("provider_error");
    expect(JSON.stringify(outcome)).not.toMatch(/4111|whisper said/);
  });

  it("gives up on a transcriber that never answers", async () => {
    const fake = fakeVoice(() => new Promise<never>(() => {}));
    const started = Date.now();
    const outcome = await voice.voiceToText("wamid.1", fake.deps, { timeoutMs: 25 });
    expect(outcome.status).toBe("not_heard");
    if (outcome.status !== "not_heard") return;
    expect(outcome.reason).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(2_000);
    // A timeout reads to the sender exactly like a provider that answered
    // badly, and "try again" is the right advice for both.
    expect(voice.noticeReasonFor("timeout")).toBe("provider_error");
    expect(voice.noticeReasonFor("empty")).toBe("empty");
  });

  it("passes each media refusal through with the reason that explains it", async () => {
    for (const reason of ["not_found", "unsupported_type", "too_large", "download_failed"] as const) {
      const fake = fakeVoice(heard("never reached"), { ok: false, reason });
      const outcome = await voice.voiceToText("wamid.1", fake.deps);
      expect(outcome.status, reason).toBe("media_failed");
      if (outcome.status !== "media_failed") continue;
      expect(outcome.reason).toBe(reason);
      // Nothing was transcribed: a refused download costs no provider call.
      expect(fake.calls.transcribe).toBe(0);
      expect(media.mediaFailureNotice("en", "audio", reason).length).toBeGreaterThan(20);
      expect(media.mediaFailureNotice("ar", "audio", reason).length).toBeGreaterThan(20);
    }
  });

  it("treats a download that throws as a download that failed", async () => {
    const fake = fakeVoice(heard("never reached"), () => Promise.reject(new Error("socket")));
    const outcome = await voice.voiceToText("wamid.1", fake.deps);
    expect(outcome).toMatchObject({ status: "media_failed", reason: "download_failed" });
    expect(fake.calls.transcribe).toBe(0);
  });

  it("answers an AI failure after a good transcription without losing the words", async () => {
    const provider = fakeProvider(() => Promise.reject(Object.assign(new Error("down"), { status: 503 })));
    const { spoken, asked } = await voiceTurn(heard("What is Visionex?"), provider.provider);
    expect(spoken.status).toBe("heard");
    expect(asked?.status).toBe("failed");
    if (asked?.status !== "failed") return;
    expect(asked.reason).toBe("provider_error");
    expect(asked.httpStatus).toBe(503);
  });

  it("handles an AI timeout after a good transcription", async () => {
    const provider = fakeProvider(() => new Promise<never>(() => {}));
    const { asked } = await voiceTurn(heard("What is Visionex?"), provider.provider, { timeoutMs: 25 });
    expect(asked?.status).toBe("failed");
    if (asked?.status !== "failed") return;
    expect(asked.reason).toBe("timeout");
  });

  it("never leaves the sender in AI_PROCESSING, whatever went wrong", () => {
    // Every exit from the voice branch restores the waiting state, and the ask
    // clears it above its own branch — asserted at the source because the
    // webhook's own control flow is what is being pinned.
    const voiceBlock = webhook.slice(
      webhook.indexOf('if (incoming.media.kind === "audio")'),
      webhook.indexOf('} else if (incoming.media.kind === "image"'),
    );
    expect(voiceBlock).toContain("session = { ...session, step: AI_PROCESSING };");
    expect(voiceBlock).toContain("const recoverVoiceState = async () => {");
    expect(voiceBlock).toContain("session = { ...session, step: AI_VOICE_INPUT };");
    // Three ways out of the branch, three recoveries: media, transcription,
    // and a preference set out loud.
    expect(voiceBlock.match(/await recoverVoiceState\(\);/g)?.length).toBe(3);
    // And the ask clears the state before it branches on the outcome.
    expect(webhook).toContain("step: assistantOwnsInput(session.feature) ? AI_CONVERSATION : null");
  });
});

// ── Language ────────────────────────────────────────────────────────────────

describe("the language a voice question is answered in", () => {
  it("keeps the conversation's language rather than the transcript's guess", () => {
    // Whisper mishears a language more often than a person changes theirs, so
    // a settled conversation wins. The rule is in the webhook because that is
    // where both facts are known.
    const voiceBlock = webhook.slice(
      webhook.indexOf('if (incoming.media.kind === "audio")'),
      webhook.indexOf('} else if (incoming.media.kind === "image"'),
    );
    expect(voiceBlock).toContain("const heardLanguage = detectLanguageCode(questionText);");
    expect(voiceBlock).toContain("const spokenBefore = existing?.language as string | null | undefined;");
    expect(voiceBlock).toContain("isSupportedLanguage(spokenBefore) ? spokenBefore : heardLanguage");
    expect(voiceBlock).toContain("replyLanguage(settled, existing?.preferred_language as string | null)");
  });

  it("still lets a preference win, including one set out loud", () => {
    const prefs = { preferred_language: "ar" };
    expect(sessions.sessionLanguage(prefs.preferred_language, "en")).toBe("ar");
    // The preference parse runs on the transcript, so «احكي معي بالإنجليزي»
    // spoken into a voice note still switches the language.
    const voiceBlock = webhook.slice(
      webhook.indexOf('if (incoming.media.kind === "audio")'),
      webhook.indexOf('} else if (incoming.media.kind === "image"'),
    );
    expect(voiceBlock).toContain("if (await applyPreferences(questionText)) {");
  });

  it("sends the language to the provider in the system configuration", async () => {
    const provider = fakeProvider(["جواب بالعربية."]);
    await voiceTurn(heard("ما هو Visionex؟"), provider.provider, {
      systemParts: ["You are the Visionex assistant.", "Answer in Arabic (العربية)."],
    });
    expect(provider.seen[0].system).toContain("العربية");
  });
});

// ── Speaking the answer back ────────────────────────────────────────────────

describe("answering out loud", () => {
  it("mirrors, always: a spoken question gets a spoken answer and nothing else", () => {
    expect(speech.replyMedium({ spokenInput: true })).toBe("voice");
    expect(speech.replyMedium({ spokenInput: false })).toBe("text");

    // There is no setting left that can override it. "Always speak" and "never
    // speak" both made the medium sticky, which is wrong in both directions:
    // one voice note last week should not put audio into a question typed on a
    // train today, and one request for text should not answer a voice note
    // with silence months later.
    const source = readFileSync("supabase/functions/_shared/whatsappVoiceReply.ts", "utf8");
    expect(source).not.toContain("export function shouldSpeak");
    expect(source).not.toMatch(/mode === "always"[\s\S]{0,200}return true/);
  });

  it("does not post the answer as text when speaking fails", async () => {
    // The old behaviour sent the text first and treated audio as an extra, so a
    // failed voice note cost nothing. It also meant every spoken answer arrived
    // twice. Now the answer travels one way only — and if that way fails, what
    // goes out is the short failure sentence, not a wall of text nobody asked
    // to read.
    const sent: Array<{ medium: string; body: string }> = [];
    const delivered = await speech.deliverReply(
      { body: "The long answer.", kind: "reply", spokenInput: true, failureNotice: "Please try again." },
      {
        sendText: async (body) => { sent.push({ medium: "text", body }); return true; },
        speak: async () => false,
      },
    );

    expect(delivered.medium).toBe("voice");
    expect(delivered.spokenFailed).toBe(true);
    expect(sent).toEqual([{ medium: "text", body: "Please try again." }]);

    // And `speakReply` still reports rather than throws, so a TTS outage cannot
    // take the delivery down with it.
    const source = readFileSync("supabase/functions/_shared/whatsappVoiceReply.ts", "utf8");
    expect(source).toMatch(/nothing was spoken/);
  });

  it("never speaks an empty answer", async () => {
    expect(speech.speechSegments("   ")).toEqual([]);
    // Nothing speakable left in it means it travels as text instead — an empty
    // voice note is worse than a short message.
    expect(speech.replyMedium({ spokenInput: true, body: "   " })).toBe("text");
    expect(speech.replyMedium({ spokenInput: true, body: "https://visionex.app/x" })).toBe("text");
    // An empty provider answer never reaches the reply path at all.
    const provider = fakeProvider([""]);
    const { asked } = await voiceTurn(heard("Anything"), provider.provider);
    expect(asked?.status).toBe("empty");
  });

  it("records how a reply travelled, which nothing else could tell you", () => {
    // Written with the row rather than patched onto it afterwards: the medium
    // is decided before anything is sent, so the transcript can simply carry it.
    expect(webhook).toContain("const medium = replyMedium({ spokenInput, body });");
    expect(webhook).toMatch(/direction: "outbound",[\s\S]{0,80}medium,/);
    // And a synthesis that failed is corrected back to text, so the column
    // never claims a voice note the sender never received.
    expect(webhook).toContain('.update({ medium: "text" }).eq("id", written.id)');
    const migration = readFileSync("supabase/migrations/20260922000000_whatsapp_message_medium.sql", "utf8");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS medium text");
    // Smallest safe change: one nullable column, no new table, nothing dropped.
    expect(migration).not.toMatch(/CREATE TABLE|DROP|DELETE|TRUNCATE/i);
  });
});

// ── Duplicates and limits ───────────────────────────────────────────────────

describe("duplicate deliveries and the limits that were already there", () => {
  it("transcribes once, asks once, answers once", async () => {
    // The webhook stops a redelivery on the unique message id, before the media
    // branch — so the second copy reaches neither of these seams. Here the
    // seams themselves are checked for the property that makes that safe: they
    // do exactly one of each per call.
    const provider = fakeProvider(["Answered once."]);
    const fake = fakeVoice(heard("What is Visionex?"));
    const spoken = await voice.voiceToText("wamid.same", fake.deps);
    expect(spoken.status).toBe("heard");
    if (spoken.status !== "heard") return;
    await ask.askAssistant({ systemParts: ["system"], question: spoken.text }, provider.provider);

    expect(fake.calls.download).toBe(1);
    expect(fake.calls.transcribe).toBe(1);
    expect(provider.calls).toBe(1);

    // And the guard that stops the second delivery ever getting here.
    // The unique index still detects the redelivery. What it does about it is
    // now `claimDecision`: a finished claim is skipped exactly as before, and
    // an abandoned one is rescued rather than discarded — which is the case
    // that used to leave a customer with silence.
    expect(webhook).toMatch(/if \(dupe\) \{[\s\S]*?dupe\.code !== "23505"[\s\S]*?claimDecision/);
    expect(webhook).toContain('if (claim.action === "skip") continue;');
    expect(webhook.indexOf("wa_message_id: incoming.messageId"))
      .toBeLessThan(webhook.indexOf('if (incoming.media.kind === "audio")'));
  });

  it("keeps every media control that was already in place", () => {
    // Untouched by this phase, and asserted so it stays that way.
    expect(media.isAllowedMediaUrl("https://lookaside.fbsbx.com/x")).toBe(true);
    expect(media.isAllowedMediaUrl("https://evil-fbcdn.net/x")).toBe(false);
    expect(media.isAllowedMime("audio", "audio/ogg; codecs=opus")).toBe(true);
    expect(media.isAllowedMime("audio", "application/x-msdownload")).toBe(false);
    expect(media.MEDIA_LIMITS.audio).toBeLessThanOrEqual(16 * 1024 * 1024);
    // The webhook still asks for the audio kind, so the audio ceiling applies.
    expect(webhook).toContain('downloadMedia({ mediaId, kind: "audio", token, trace: correlationId })');
  });

  it("logs the shape of a voice turn and none of its content", () => {
    const voiceBlock = webhook.slice(
      webhook.indexOf('if (incoming.media.kind === "audio")'),
      webhook.indexOf('} else if (incoming.media.kind === "image"'),
    );
    const logged = [...voiceBlock.matchAll(/log\("[a-z_]+",\s*\{[^}]*\}/g)].map((m) => m[0]).join("\n");
    expect(logged).toContain("voice_heard");
    expect(logged).toContain("provider:");
    expect(logged).toContain("chars:");
    // Never the words, never the audio, never a key.
    expect(logged).not.toMatch(/turn\.text[^.]|questionText|bytes:|token|apiKey/);
  });
});
