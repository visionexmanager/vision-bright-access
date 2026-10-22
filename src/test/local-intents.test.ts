// The local intent engine: what it answers, and — more importantly — what it refuses to.
//
// A phrase list that answers everything is a bug. Most of the assertions below
// are about the cases it must leave alone: a thank-you with a question attached,
// a typo in a page name, a number, a command the WhatsApp router owns.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engine = await import("../../supabase/functions/_shared/localIntents.ts");
const data = await import("../../supabase/functions/_shared/localIntentCatalogue.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");

const { answerLocally, matchLocalIntent, normalize, catalogueIndex, localIntentMetric, estimateTokens } = engine;
const { LOCALES, SOCIAL_PHRASES, SOCIAL_REPLIES, HELP_LEAD, NAV_LABELS, NAV_TARGETS, NAV_PATHS } = data;

const aiChat = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

// ── 1. Coverage: every supported locale ─────────────────────────────────────

describe("the catalogue covers the twenty supported languages", () => {
  it("lists exactly the languages the site and WhatsApp support, in the same order", () => {
    expect([...LOCALES]).toEqual([...languages.SUPPORTED_LANGUAGES]);
  });

  it.each([...LOCALES])("%s has phrases, replies and labels for every intent", (locale) => {
    for (const intent of ["greeting", "farewell", "thanks", "help"] as const) {
      expect(SOCIAL_PHRASES[intent][locale].length, `${locale} ${intent}`).toBeGreaterThan(1);
    }
    for (const intent of ["greeting", "farewell", "thanks"] as const) {
      expect(SOCIAL_REPLIES[intent][locale].trim().length).toBeGreaterThan(0);
    }
    expect(HELP_LEAD[locale].trim().length).toBeGreaterThan(0);
    expect(NAV_LABELS[locale]).toHaveLength(NAV_TARGETS.length);
    for (const label of NAV_LABELS[locale]) expect(label.trim().length).toBeGreaterThan(0);
  });

  it("recognises every catalogue phrase as its own intent", () => {
    for (const locale of LOCALES) {
      for (const intent of Object.keys(SOCIAL_PHRASES) as Array<keyof typeof SOCIAL_PHRASES>) {
        for (const phrase of SOCIAL_PHRASES[intent][locale]) {
          const match = matchLocalIntent(phrase);
          expect(match, `${locale}/${intent}: ${phrase}`).not.toBeNull();
          expect(match!.intent, `${locale}/${intent}: ${phrase}`).toBe(intent);
        }
      }
    }
  });

  it("answers in the language that matched, using the preferred one only to break a tie", () => {
    expect(answerLocally("шакр", {})).toBeNull();
    expect(answerLocally("спасибо")!.match.locale).toBe("ru");
    expect(answerLocally("spasibo")).toBeNull();
    // "hallo" is German and Dutch: the sender's language decides which reply.
    expect(answerLocally("hallo", { preferredLocale: "nl" })!.reply).toBe(SOCIAL_REPLIES.greeting.nl);
    expect(answerLocally("hallo", { preferredLocale: "de" })!.reply).toBe(SOCIAL_REPLIES.greeting.de);
    // A preference never makes something match that does not.
    expect(answerLocally("hallo wie geht es", { preferredLocale: "de" })).toBeNull();
  });
});

// ── 2. Catalogue quality ────────────────────────────────────────────────────

describe("no phrase means two things", () => {
  it("does not put one phrase in two different intents", () => {
    const clashes: string[] = [];
    for (const [key, entries] of catalogueIndex().exact) {
      if (new Set(entries.map((e) => e.intent)).size > 1) {
        clashes.push(`${key} → ${[...new Set(entries.map((e) => e.intent))].join(" / ")}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("holds no secret, address, script or account data", () => {
    const text = JSON.stringify([SOCIAL_PHRASES, SOCIAL_REPLIES, HELP_LEAD, NAV_LABELS]);
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/api[_-]?key|secret|token|password|<script|select\s.+\sfrom/i);
    expect(text).not.toMatch(/\$\{|`/);
  });

  it("points every page at a real public path", () => {
    for (const target of NAV_TARGETS) expect(NAV_PATHS[target]).toMatch(/^\/[a-z-]+$/);
  });
});

// ── 3. Matching rules ───────────────────────────────────────────────────────

describe("matching", () => {
  it("folds case, punctuation, emoji and spacing", () => {
    for (const input of ["HELLO", "Hello!!!", "  hello  ", "hello 😊", "¡hello!"]) {
      expect(matchLocalIntent(input)?.intent, input).toBe("greeting");
    }
  });

  it("folds Arabic diacritics, alef forms and Persian letter variants", () => {
    expect(matchLocalIntent("مَرْحَباً")?.intent).toBe("greeting");
    expect(matchLocalIntent("اهلا")?.intent).toBe("greeting");
    expect(matchLocalIntent("أهلاً")?.intent).toBe("greeting");
    expect(matchLocalIntent("مع السلامه")?.intent).toBe("farewell");
    expect(matchLocalIntent("شكراً")?.intent).toBe("thanks");
    expect(matchLocalIntent("ممنون")?.intent).toBe("thanks");
  });

  it("folds accents in Latin scripts on both sides", () => {
    expect(matchLocalIntent("adios")?.intent).toBe("farewell");
    expect(matchLocalIntent("adiós")?.intent).toBe("farewell");
    expect(matchLocalIntent("cesc")).toBeNull();
    expect(matchLocalIntent("ola")?.intent).toBe("greeting"); // olá
  });

  it("matches elongation as a lower-confidence tier", () => {
    const match = matchLocalIntent("thankssss")!;
    expect(match.intent).toBe("thanks");
    expect(match.method).toBe("squeezed");
    expect(match.confidence).toBeLessThan(1);
    expect(matchLocalIntent("hellooooo")?.intent).toBe("greeting");
  });

  it("forgives one typo in a long enough social word, and says it guessed", () => {
    const match = matchLocalIntent("thnaks")!;
    expect(match.intent).toBe("thanks");
    expect(match.method).toBe("fuzzy");
    expect(match.confidence).toBe(0.8);
    expect(matchLocalIntent("goodbey")?.intent).toBe("farewell");
    expect(matchLocalIntent("merci beauco")).toBeNull(); // two edits away
  });

  it("never guesses a short word", () => {
    for (const word of ["hii", "thx", "byee", "helo"]) {
      const m = matchLocalIntent(word);
      if (m) expect(m.method, word).not.toBe("fuzzy");
    }
    expect(matchLocalIntent("hola?")!.method).toBe("exact");
    expect(matchLocalIntent("hela")).toBeNull();
  });

  it("requires the whole message to be the phrase", () => {
    for (const input of [
      "thanks, but how do I reset my password",
      "hello can you explain photosynthesis",
      "bye the way what is my balance",
      "what can you do about my refund",
      "شكرا لكن كيف ألغي اشتراكي",
      "hello world this is a long sentence that should never match anything at all",
    ]) {
      expect(matchLocalIntent(input), input).toBeNull();
    }
  });

  it("returns nothing for empty, non-text and oversized input without throwing", () => {
    for (const input of [undefined, null, 42, {}, [], "", "   ", "!!!", "😀😀"]) {
      expect(matchLocalIntent(input as unknown)).toBeNull();
    }
    expect(matchLocalIntent("a".repeat(100_000))).toBeNull();
  });

  it("treats hostile input as inert text", () => {
    for (const input of [
      "'; DROP TABLE users; --",
      "$(rm -rf /)",
      "<script>alert(1)</script>",
      "{{7*7}}",
      "../../etc/passwd",
      "__proto__",
      "constructor",
    ]) {
      expect(answerLocally(input), input).toBeNull();
    }
  });
});

// ── 4. Navigation ───────────────────────────────────────────────────────────

describe("page names", () => {
  it("opens the right page from a bare name in every locale", () => {
    for (const locale of LOCALES) {
      NAV_TARGETS.forEach((target, i) => {
        const m = matchLocalIntent(NAV_LABELS[locale][i], locale);
        expect(m, `${locale} ${NAV_LABELS[locale][i]}`).not.toBeNull();
        expect(m!.intent).toBe(`nav.${target}`);
        expect(m!.params.target).toBe(target);
      });
    }
  });

  it("opens the page from an 'open …' request", () => {
    expect(matchLocalIntent("open the library")?.params.target).toBe("library");
    expect(matchLocalIntent("go to games")?.params.target).toBe("games");
    expect(matchLocalIntent("take me to the bazaar")?.params.target).toBe("bazaar");
    expect(matchLocalIntent("افتح المكتبة")?.params.target).toBe("library");
    expect(matchLocalIntent("abre la biblioteca")?.params.target).toBe("library");
    expect(matchLocalIntent("ouvre les jeux")?.params.target).toBe("games");
    expect(matchLocalIntent("打开图书馆")?.params.target).toBe("library");
    expect(matchLocalIntent("open library")!.method).toBe("pattern");
  });

  it("never fuzzy-matches a page name", () => {
    for (const input of ["libary", "acadamy", "bazar shop now", "pricng", "open libary"]) {
      expect(answerLocally(input), input).toBeNull();
    }
  });

  it("leaves a real question about a page to the model", () => {
    for (const input of [
      "how do I find a book in the library",
      "is the academy free",
      "what are the games for blind users",
      "كيف أشتري من البازار",
    ]) {
      expect(answerLocally(input), input).toBeNull();
    }
  });

  it("answers with a link in markdown on the website and a plain address on WhatsApp", () => {
    expect(answerLocally("library", { format: "markdown" })!.reply).toBe("[Library](/library)");
    expect(answerLocally("library", { format: "plain", baseUrl: "https://visionex.app" })!.reply)
      .toBe("Library: https://visionex.app/library");
  });

  it("does not answer navigation in voice, where a link is read out as noise", () => {
    expect(answerLocally("library", { links: false })).toBeNull();
    expect(answerLocally("hello", { links: false })!.reply).toBe(SOCIAL_REPLIES.greeting.en);
    expect(answerLocally("help", { links: false })!.reply).toBe(HELP_LEAD.en);
  });
});

// ── 5. What it must not claim to understand ─────────────────────────────────

describe("what a phrase list cannot answer", () => {
  it("leaves account, plan, balance and cancellation questions to the code that owns them", () => {
    for (const input of [
      "what is my balance",
      "my vx balance",
      "what plan am I on",
      "cancel my subscription",
      "delete my account",
      "رصيدي",
      "كم رصيدي",
      "ما هي خطتي",
      "buy vx coins",
      "pay now",
      "refund",
    ]) {
      expect(answerLocally(input), input).toBeNull();
    }
  });

  it("leaves search, prices and facts to retrieval", () => {
    for (const input of ["weather in beirut", "price of a white cane", "latest news about ai", "find books about history"]) {
      expect(answerLocally(input), input).toBeNull();
    }
  });

  it("does not take a WhatsApp navigation command or a bare number", () => {
    for (const input of ["0", "00", "#", "1", "12", "back", "next", "cancel", "stop", "repeat", "menu", "main menu", "؟"]) {
      expect(answerLocally(input), input).toBeNull();
    }
  });

  it("never returns anything that depends on the sender", () => {
    const a = answerLocally("hello", { preferredLocale: "en" })!;
    const b = answerLocally("hello", { preferredLocale: "en" })!;
    expect(a.reply).toBe(b.reply);
    expect(a.reply).not.toMatch(/\d/);
  });
});

// ── 6. Wiring ───────────────────────────────────────────────────────────────

describe("the website chat", () => {
  it("answers locally after the caller's own limit, and before the gate, the budget and every provider path", () => {
    const local = aiChat.indexOf("answerLocally(");
    expect(local).toBeGreaterThan(0);
    // The caller's own limit is taken first (once per branch, before the reply) ...
    const userLimit = aiChat.indexOf('rpc("check_ai_rate_limit"');
    const anonLimit = aiChat.indexOf('rpc("check_ai_anon_rate_limit"');
    expect(userLimit).toBeGreaterThan(local);
    expect(anonLimit).toBeGreaterThan(local);
    const reply = aiChat.indexOf("data: [DONE]", local);
    expect(userLimit).toBeLessThan(reply);
    expect(anonLimit).toBeLessThan(reply);
    // ... and the answer is returned before the gate that refuses a free-week caller.
    expect(reply).toBeLessThan(aiChat.indexOf("subscriptionGate(serviceClient"));
    expect(reply).toBeLessThan(aiChat.indexOf('rpc("check_ai_budget")'));
  });

  it("answers before the provider, the billing reservation and the memory write", () => {
    const local = aiChat.indexOf("answerLocally(");
    expect(aiChat.indexOf("billedRequest(serviceClient")).toBeGreaterThan(local);
    expect(aiChat.indexOf("streamChatCompletionWithFallback({")).toBeGreaterThan(local);
    expect(aiChat.indexOf('.from("ai_user_memory")')).toBeGreaterThan(local);
  });

  it("is limited to the default assistant, and the later flow carries no second copy", () => {
    expect(aiChat).toMatch(/if \(!assistantIdForAuth\) \{\s*const early/);
    expect(aiChat.split("answerLocally(").length - 1).toBe(1);
  });

  it("logs the metric without the message", () => {
    const metric = localIntentMetric("website", answerLocally("thnaks")!, 12_000);
    const text = JSON.stringify(metric);
    expect(text).not.toContain("thnaks");
    expect(metric.provider_called).toBe(false);
    expect(Object.keys(metric).sort()).toEqual([
      "catalogue", "channel", "confidence", "est_avoided_input_tokens", "event", "intent", "locale", "method", "ms", "provider_called",
    ]);
  });
});

describe("the WhatsApp webhook", () => {
  const local = webhook.indexOf("answerLocally(questionText");

  it("answers locally after commands, onboarding and the router have had their turn", () => {
    expect(local).toBeGreaterThan(0);
    expect(webhook.indexOf("runEngine(")).toBeGreaterThan(0);
    expect(webhook.indexOf("runEngine(")).toBeLessThan(local);
  });

  it("answers locally only for a sender the plan allows, never for voice or media", () => {
    const block = webhook.slice(local - 300, local + 700);
    expect(block).toContain("!spokenInput && !incoming.media");
    expect(block).toContain("(await entitlement()).allowed");
  });

  it("answers before the classifier and the assistant", () => {
    expect(webhook.indexOf("quickCategory({")).toBeGreaterThan(local);
    expect(webhook.indexOf("const asked = await askAssistant(")).toBeGreaterThan(local);
  });

  it("does not spend or record a paid operation for a local answer", () => {
    const block = webhook.slice(local, local + 900);
    expect(block).not.toMatch(/maySpend|recordSpend|askAssistant/);
  });
});

// ── 7. Measurement and bounds ───────────────────────────────────────────────

describe("measurement", () => {
  it("estimates avoided prompt tokens as an estimate, never as billing", () => {
    expect(estimateTokens(4_000)).toBe(1_000);
    expect(estimateTokens(-5)).toBe(0);
    expect(estimateTokens(0)).toBe(0);
  });

  it("answers a representative batch in well under a millisecond each", () => {
    const batch = ["hello", "thanks", "bye", "what can you do", "library", "open the games", "شكرا", "gracias", "ありがとう", "how do I reset my password", "thnaks"];
    answerLocally("warm up");
    const started = performance.now();
    const rounds = 400;
    for (let i = 0; i < rounds; i++) for (const text of batch) answerLocally(text);
    const each = (performance.now() - started) / (rounds * batch.length);
    expect(each).toBeLessThan(1);
  });

  it("keeps the normaliser stable on every catalogue phrase", () => {
    for (const locale of LOCALES) {
      for (const list of Object.values(SOCIAL_PHRASES)) {
        for (const phrase of list[locale]) expect(normalize(normalize(phrase))).toBe(normalize(phrase));
      }
    }
  });
});
