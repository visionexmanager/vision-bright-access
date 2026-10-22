// The three fixed FAQ answers (free trial, language, contact) and how the website
// assistant now serves them: before the subscription gate, with no provider, with
// the caller's own limit taken first, and counted without a person in the count.
//
// A fixed answer is only as good as the fact it states. Each assertion that pins
// a sentence to its source (trial length, trial sections, language count, a real
// route) exists so that changing the source fails here instead of leaving the
// assistant saying something that is no longer true.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decideAccess, operationById } from "@/lib/access/policy";
import { TRIAL_DAYS, TRIAL_SECTIONS } from "@/lib/billing/plans";

const engine = await import("../../supabase/functions/_shared/localIntents.ts");
const faq = await import("../../supabase/functions/_shared/localFaqCatalogue.ts");
const data = await import("../../supabase/functions/_shared/localIntentCatalogue.ts");
const audio = await import("../../supabase/functions/_shared/localAudio.ts");

const { answerLocally, catalogueIndex } = engine;
const { FAQ_INTENTS, FAQ_PHRASES, FAQ_REPLIES, FAQ_PATHS, CONTACT_LABEL } = faq;
const { LOCALES } = data;

const aiChat = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20261086000000_assistant_local_answer_counts.sql", "utf8");

describe("every FAQ answer exists in all twenty languages", () => {
  for (const intent of FAQ_INTENTS) {
    for (const locale of LOCALES) {
      it(`${intent} / ${locale}: phrases, a reply, and the phrase finds that reply`, () => {
        const phrases = FAQ_PHRASES[intent][locale];
        expect(phrases.length, "at least one phrase").toBeGreaterThan(0);
        expect(FAQ_REPLIES[intent][locale].trim().length).toBeGreaterThan(20);
        for (const phrase of phrases) {
          const answer = answerLocally(phrase, { preferredLocale: locale });
          expect(answer, phrase).not.toBeNull();
          expect(answer!.match.intent).toBe(`faq.${intent}`);
          expect(answer!.match.locale).toBe(locale);
          expect(answer!.reply.startsWith(FAQ_REPLIES[intent][locale])).toBe(true);
        }
      });
    }
  }

  it("keeps no phrase in two intents (the engine would refuse to guess)", () => {
    const clashes = [...catalogueIndex().exact].filter(([, entries]) => new Set(entries.map((e) => e.intent)).size > 1);
    expect(clashes.map(([key]) => key)).toEqual([]);
  });

  it("writes an Arabic answer in Arabic, with the brand name as the only Latin text", () => {
    for (const intent of FAQ_INTENTS) {
      expect(FAQ_REPLIES[intent].ar.replace(/Visionex/g, ""), intent).not.toMatch(/[A-Za-z]/);
    }
    expect(CONTACT_LABEL.ar).not.toMatch(/[A-Za-z]/);
  });

  it("states no number that is not a fact of this repository", () => {
    for (const locale of LOCALES) {
      expect(FAQ_REPLIES.trial[locale], locale).toContain(String(TRIAL_DAYS));
      expect(FAQ_REPLIES.language[locale], locale).toContain(String(LOCALES.length));
      expect(FAQ_REPLIES.contact[locale], locale).not.toMatch(/\d/);
    }
  });
});

describe("the statements are pinned to the code that owns them", () => {
  it("the free week is seven days and opens exactly the six sections the text names", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect([...TRIAL_SECTIONS].sort()).toEqual(["academy", "arcade", "assistive", "community", "library", "news"]);
  });

  it("does not promise the assistant to a trial caller", () => {
    expect(TRIAL_SECTIONS).not.toContain("assistant");
    expect(decideAccess(operationById("assistant.chat"), { signedIn: true, plan: "free_trial" }).allow).toBe(false);
  });

  it("the pages it links to are registered routes", () => {
    for (const intent of FAQ_INTENTS) {
      const path = FAQ_PATHS[intent];
      if (path) expect(app, path).toContain(`path="${path}"`);
    }
  });
});

describe("what each channel gets", () => {
  it("links on the website, a plain address on WhatsApp, and no link in voice", () => {
    const web = answerLocally("free trial", { preferredLocale: "en", format: "markdown" })!;
    expect(web.reply).toContain("](/pricing)");
    const wa = answerLocally("free trial", { preferredLocale: "en", format: "plain", baseUrl: "https://visionex.app" })!;
    expect(wa.reply).toContain("https://visionex.app/pricing");
    expect(wa.reply).not.toContain("](");
    const voice = answerLocally("free trial", { preferredLocale: "en", links: false })!;
    expect(voice.reply).toBe(FAQ_REPLIES.trial.en);
  });

  it("answers the language question without a link, in voice too", () => {
    const answer = answerLocally("change language", { preferredLocale: "en", links: false })!;
    expect(answer.reply).toBe(FAQ_REPLIES.language.en);
  });
});

describe("what it refuses to answer", () => {
  it("leaves the caller's own trial to the code that owns account data", () => {
    for (const input of [
      "how many days are left in my free trial",
      "when does my free trial end",
      "my free trial",
      "is my free trial active",
      "cancel my free trial",
      "extend my free trial",
      "كم بقي من تجربتي المجانية",
    ]) {
      expect(answerLocally(input), input).toBeNull();
    }
  });

  it("requires the whole message, and never guesses a near miss", () => {
    for (const input of [
      "free trial please tell me about it and the pricing",
      "contact the author of this book",
      "free trails",
      "change language to french and translate this",
      "contacts",
    ]) {
      expect(answerLocally(input), input).toBeNull();
    }
  });

  it("is the same for every sender: nothing in a reply depends on who asked", () => {
    for (const intent of FAQ_INTENTS) {
      for (const locale of LOCALES) {
        const a = answerLocally(FAQ_PHRASES[intent][locale][0], { preferredLocale: locale, format: "markdown" })!;
        const b = answerLocally(FAQ_PHRASES[intent][locale][0], { preferredLocale: locale, format: "markdown" })!;
        expect(a.reply).toBe(b.reply);
        expect(a.reply).not.toMatch(/@|\bhttps?:\/\/|[0-9a-f]{8}-[0-9a-f]{4}/i);
      }
    }
  });
});

describe("the trial caller and the policy", () => {
  it("allows the local answer for every kind of caller and calls no provider", () => {
    const local = operationById("assistant.local_answer");
    for (const caller of [
      { signedIn: false, plan: "none" },
      { signedIn: true, plan: "none" },
      { signedIn: true, plan: "free_trial" },
      { signedIn: true, plan: "basic" },
    ]) {
      const decision = decideAccess(local, caller, { savedAvailable: true });
      expect(decision.allow, JSON.stringify(caller)).toBe(true);
      if (decision.allow) expect(decision.providerCalled).toBe(false);
    }
  });

  it("does not widen the trial: the AI chat itself stays closed to it", () => {
    const decision = decideAccess(operationById("assistant.chat"), { signedIn: true, plan: "free_trial" }, { savedAvailable: true });
    expect(decision.allow).toBe(false);
  });
});

describe("the website chat wiring", () => {
  it("serves the answer before the gate, after the caller's own limit, and counts it", () => {
    const start = aiChat.indexOf("if (!assistantIdForAuth) {");
    const gate = aiChat.indexOf("subscriptionGate(serviceClient");
    const block = aiChat.slice(start, gate);
    expect(start).toBeGreaterThan(0);
    expect(block.indexOf('rpc("check_ai_rate_limit"')).toBeLessThan(block.indexOf("data: [DONE]"));
    expect(block.indexOf('rpc("check_ai_anon_rate_limit"')).toBeLessThan(block.indexOf("data: [DONE]"));
    expect(block).toContain('rpc("record_local_answer"');
    expect(block).toContain("429");
  });

  it("stays out of the block: no provider, VX, memory or per-user table is touched before the gate", () => {
    const gate = aiChat.indexOf("subscriptionGate(serviceClient");
    const block = aiChat.slice(aiChat.indexOf("if (!assistantIdForAuth) {"), gate);
    for (const forbidden of ["billedRequest", "streamChatCompletion", "ai_user_memory", "vx_", "fetch("]) {
      expect(block, forbidden).not.toContain(forbidden);
    }
  });

  it("never passes a message, a name or an address to the counter", () => {
    const call = aiChat.slice(aiChat.indexOf('rpc("record_local_answer"'));
    const args = call.slice(0, call.indexOf("});"));
    expect(args).not.toMatch(/content|message|email|address|name/i);
  });
});

describe("the counter table", () => {
  it("holds counts by day, channel, intent, language and plan class, and nobody's identity", () => {
    const table = migration.slice(migration.indexOf("CREATE TABLE"), migration.indexOf("ALTER TABLE"));
    const columns = [...table.matchAll(/^ {2}([a-z_]+)\s+(?:date|text|bigint)\b/gm)].map((m) => m[1]);
    expect(columns).toEqual(["day", "channel", "intent", "locale", "plan_class", "answers", "est_avoided_input_tokens"]);
    expect(table).toContain("PRIMARY KEY (day, channel, intent, locale, plan_class)");
  });

  it("can be written only by the service role and read only through the admin check", () => {
    expect(migration).toContain("ALTER TABLE public.assistant_local_answer_daily ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toMatch(/CREATE POLICY/i);
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.record_local_answer(text, text, text, uuid, integer) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.record_local_answer(text, text, text, uuid, integer) TO service_role");
    expect(migration).toContain("has_role(auth.uid(), 'admin')");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.admin_assistant_local_answers(integer, numeric) FROM PUBLIC, anon, service_role");
  });

  it("derives the plan class on the server, never from the caller", () => {
    expect(migration).toContain("public.plan_for_user(_user_id)");
    expect(migration).not.toMatch(/_plan_class\s+text/);
  });

  it("labels the token figure an estimate and does not claim billing", () => {
    expect(migration).toContain("'tokens_are_an_estimate', true");
  });
});

describe("audio for these answers", () => {
  it("claims none: no FAQ answer is a registered prerecorded phrase, so text is what is sent", () => {
    for (const intent of FAQ_INTENTS) {
      for (const locale of LOCALES) {
        expect(audio.isRegisteredPhrase(FAQ_REPLIES[intent][locale]), `${intent}/${locale}`).toBe(false);
      }
    }
  });

  it("reports the registry honestly: every registered clip is verified or listed as missing", () => {
    const report = audio.inspectRegistry();
    expect(report.problems).toEqual([]);
  });
});
