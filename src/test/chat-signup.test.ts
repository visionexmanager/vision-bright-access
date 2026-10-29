// Sign up from WhatsApp or Messenger.
//
// The decisions (throttles, attempts, expiry, who may be linked) are SQL and are
// executed for real by scripts/sql/chat-signup-scenarios.mjs under PGlite. This
// file pins the other half: the words in all twenty languages, the intent
// parser, the state machine's use of those functions, and where the two
// webhooks call it.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  isCancel,
  parseSignupIntent,
  runChatSignupTurn,
  signupOfferText,
  type SignupDeps,
} from "../../supabase/functions/_shared/chatSignup.ts";
import { SIGNUP_STRINGS, signupSay } from "../../supabase/functions/_shared/chatSignupStrings.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";
import { hashLinkCode } from "../../supabase/functions/_shared/whatsappIdentity.ts";

const SECRET = "test-secret-not-a-real-one";

// ── Words ───────────────────────────────────────────────────────────────────

describe("sign-up wording", () => {
  it("exists, non-empty, in every supported language", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      const pack = SIGNUP_STRINGS[l];
      expect(pack, l).toBeDefined();
      for (const [k, v] of Object.entries(pack)) expect(v.trim().length, `${l}.${k}`).toBeGreaterThan(3);
    }
  });

  it("keeps its placeholders in every language", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      expect(SIGNUP_STRINGS[l].offer, `${l}.offer`).toContain("{url}");
      expect(SIGNUP_STRINGS[l].codeSent, `${l}.codeSent`).toContain("{terms}");
    }
  });

  it("teaches a phrase that the parser actually accepts, in every language", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      expect(parseSignupIntent(SIGNUP_STRINGS[l].here), l).toBe("chat");
      expect(signupOfferText(l)).not.toContain("{url}");
    }
  });

  it("falls back to English for an unknown language", () => {
    expect(signupSay("cancelled", "xx")).toBe(SIGNUP_STRINGS.en.cancelled);
  });

  it("never tells a sender whether an address has an account before the code", () => {
    // The request-step sentence is one string for every address: it cannot vary.
    for (const l of SUPPORTED_LANGUAGES) {
      expect(SIGNUP_STRINGS[l].codeSent).not.toMatch(/already|مسجل|déjà|ya tiene/i);
    }
  });
});

// ── Intent ──────────────────────────────────────────────────────────────────

describe("parseSignupIntent", () => {
  it.each([
    ["I want to create an account", "offer"],
    ["sign up", "offer"],
    ["أريد إنشاء حساب", "offer"],
    ["انشاء حساب جديد", "offer"],
    ["Créer un compte", "offer"],
    ["register here", "chat"],
    ["سجلني هنا", "chat"],
  ])("%s → %s", (text, expected) => expect(parseSignupIntent(text)).toBe(expected));

  it.each([
    "what is the weather in Beirut",
    "كم سعر الدولار اليوم",
    "link my account",
    "",
    "123456",
    "x".repeat(200) + " sign up",
  ])("ignores %j", (text) => expect(parseSignupIntent(text)).toBeNull());

  it("recognises cancel words", () => {
    expect(isCancel("0")).toBe(true);
    expect(isCancel("إلغاء")).toBe(true);
    expect(isCancel("Cancel")).toBe(true);
    expect(isCancel("zero")).toBe(false);
  });
});

// ── State machine ───────────────────────────────────────────────────────────

type Call = { fn: string; args: Record<string, unknown> };

function harness(script: Record<string, unknown | ((args: Record<string, unknown>) => unknown)>, over: Partial<SignupDeps> = {}) {
  const calls: Call[] = [];
  const created: { email: string; displayName: string }[] = [];
  const deps: SignupDeps = {
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      const entry = script[fn];
      if (entry === undefined) return { data: null, error: new Error(`unscripted rpc ${fn}`) };
      return { data: typeof entry === "function" ? (entry as (a: Record<string, unknown>) => unknown)(args) : entry, error: null };
    },
    createUser: async (input) => {
      created.push(input);
      return "11111111-1111-1111-1111-111111111111";
    },
    secret: SECRET,
    emailConfigured: true,
    ...over,
  };
  return { deps, calls, created };
}

const turn = (deps: SignupDeps, text: string, language = "en") => {
  const sendCode = vi.fn(async () => true);
  return { sendCode, run: () => runChatSignupTurn(deps, { channel: "whatsapp", subject: "96170000001", text, language, sendCode }) };
};

describe("runChatSignupTurn", () => {
  it("is not ours when nobody is signing up and nothing asks for it", async () => {
    const h = harness({ chat_signup_state: { linked: false, step: null } });
    const t = turn(h.deps, "what is the weather");
    expect((await t.run()).handled).toBe(false);
    expect(h.calls.map((c) => c.fn)).toEqual(["chat_signup_state"]);
  });

  it("offers the link and the in-chat route to someone asking to sign up", async () => {
    const h = harness({ chat_signup_state: { linked: false, step: null } });
    const out = await turn(h.deps, "إنشاء حساب", "ar").run();
    expect(out.handled).toBe(true);
    expect(out.reply).toContain("https://visionex.app/signup");
    expect(out.reply).toContain("سجل هنا");
    expect(h.calls.map((c) => c.fn)).toEqual(["chat_signup_state"]); // offering creates nothing
  });

  it("starts the in-chat flow on «register here» and asks for a name", async () => {
    const h = harness({ chat_signup_state: { linked: false, step: null }, chat_signup_begin: "started" });
    const out = await turn(h.deps, "register here").run();
    expect(out.reply).toBe(SIGNUP_STRINGS.en.askName);
    expect(h.calls.at(-1)?.fn).toBe("chat_signup_begin");
  });

  it("does not start a second account for a linked number", async () => {
    const h = harness({ chat_signup_state: { linked: true, step: null } });
    const out = await turn(h.deps, "register here").run();
    expect(out.handled).toBe(true);
    expect(h.calls.map((c) => c.fn)).toEqual(["chat_signup_state"]);
  });

  it("re-asks for a bad name and moves on for a good one", async () => {
    const bad = harness({ chat_signup_state: { step: "name" }, chat_signup_set_name: "invalid" });
    expect((await turn(bad.deps, "http://x.y").run()).reply).toBe(SIGNUP_STRINGS.en.nameInvalid);
    const good = harness({ chat_signup_state: { step: "name" }, chat_signup_set_name: "ok" });
    expect((await turn(good.deps, "Rana").run()).reply).toBe(SIGNUP_STRINGS.en.askEmail);
  });

  it("asks again, without mailing anyone, for something that is not an address", async () => {
    const h = harness({ chat_signup_state: { step: "email" } });
    const t = turn(h.deps, "not an email");
    const out = await t.run();
    expect(out.handled).toBe(true);
    expect(h.calls.map((c) => c.fn)).toEqual(["chat_signup_state"]);
    expect(out.after).toBeUndefined();
  });

  it("emails the code only after the reply, hashes it, and never puts it in the reply", async () => {
    const h = harness({
      chat_signup_state: { step: "email" },
      chat_signup_request_code: { status: "sent", deliver: true },
    });
    const t = turn(h.deps, "Rana@Example.com");
    const out = await t.run();
    const request = h.calls.find((c) => c.fn === "chat_signup_request_code")!;
    expect(request.args._email).toBe("rana@example.com");
    expect(String(request.args._code_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(out.reply).toBe(SIGNUP_STRINGS.en.codeSent.replace("{terms}", "https://visionex.app/legal"));
    expect(t.sendCode).not.toHaveBeenCalled(); // nothing sent before the reply goes out
    await out.after!();
    expect(t.sendCode).toHaveBeenCalledTimes(1);
    const [to, code] = t.sendCode.mock.calls[0] as unknown as [string, string];
    expect(to).toBe("rana@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(out.reply).not.toContain(code);
    expect(await hashLinkCode(code, SECRET)).toBe(request.args._code_hash);
  });

  it("says the same thing whether or not the throttle let the send through", async () => {
    for (const status of ["cooldown", "throttled"]) {
      const h = harness({ chat_signup_state: { step: "email" }, chat_signup_request_code: { status, deliver: false } });
      const out = await turn(h.deps, "a@b.co").run();
      expect(out.handled).toBe(true);
      expect(out.after).toBeUndefined();
    }
  });

  it("refuses to start without an email provider rather than promising a code", async () => {
    const h = harness({ chat_signup_state: { step: "email" } }, { emailConfigured: false });
    const out = await turn(h.deps, "a@b.co").run();
    expect(h.calls.map((c) => c.fn)).toEqual(["chat_signup_state"]);
    expect(out.reply).not.toBe(SIGNUP_STRINGS.en.codeSent);
  });

  it("fails closed without a signing secret: no mutation at all", async () => {
    const h = harness({ chat_signup_state: { linked: false, step: null } }, { secret: "" });
    const out = await turn(h.deps, "register here").run();
    expect(out.handled).toBe(true);
    expect(h.calls.map((c) => c.fn)).toEqual(["chat_signup_state"]);
  });

  describe("the code", () => {
    const confirmScript = (verdict: unknown) => ({ chat_signup_state: { step: "code" }, chat_signup_confirm: verdict });

    it("a wrong code creates no account and reports tries left", async () => {
      const h = harness(confirmScript({ status: "invalid", attempts_left: 3 }));
      const out = await turn(h.deps, "000000").run();
      expect(h.created).toEqual([]);
      expect(out.reply).toContain("3");
      expect(h.calls.some((c) => c.fn === "chat_signup_bind")).toBe(false);
    });

    for (const status of ["expired", "locked", "none"]) {
      it(`${status} creates nothing`, async () => {
        const h = harness(confirmScript({ status }));
        const out = await turn(h.deps, "123456").run();
        expect(out.handled).toBe(true);
        expect(h.created).toEqual([]);
      });
    }

    it("something that is not six digits only reminds, and never reaches the database", async () => {
      const h = harness(confirmScript({ status: "create" }));
      await turn(h.deps, "hello").run();
      expect(h.calls.some((c) => c.fn === "chat_signup_confirm")).toBe(false);
    });

    it("folds Arabic-Indic digits", async () => {
      const h = harness(confirmScript({ status: "invalid", attempts_left: 4 }));
      await turn(h.deps, "١٢٣٤٥٦").run();
      const sent = h.calls.find((c) => c.fn === "chat_signup_confirm")!;
      expect(sent.args._code_hash).toBe(await hashLinkCode("123456", SECRET));
    });

    it("an existing account is linked, and no second account is made", async () => {
      const h = harness(confirmScript({ status: "linked" }));
      const out = await turn(h.deps, "123456").run();
      expect(out.reply).toBe(SIGNUP_STRINGS.en.linked);
      expect(h.created).toEqual([]);
    });

    it("a right code for a new address creates the account once, then binds it", async () => {
      const h = harness({
        ...confirmScript({ status: "create", email: "rana@example.com", display_name: "Rana" }),
        chat_signup_bind: "bound",
      });
      const out = await turn(h.deps, "123456").run();
      expect(h.created).toEqual([{ email: "rana@example.com", displayName: "Rana" }]);
      expect(h.calls.at(-1)).toMatchObject({ fn: "chat_signup_bind", args: { _user_id: "11111111-1111-1111-1111-111111111111" } });
      expect(out.reply).toBe(SIGNUP_STRINGS.en.created);
      expect(JSON.stringify(h.calls)).not.toMatch(/password/i); // no password in any call
    });

    it("if the account cannot be created nothing is linked", async () => {
      const h = harness(
        { ...confirmScript({ status: "create", email: "rana@example.com", display_name: "Rana" }), chat_signup_cancel: null },
        { createUser: async () => null },
      );
      const out = await turn(h.deps, "123456").run();
      expect(h.calls.some((c) => c.fn === "chat_signup_bind")).toBe(false);
      expect(out.reply).not.toBe(SIGNUP_STRINGS.en.created);
    });

    it("if the database rejects the bind the sender is not told it worked", async () => {
      const h = harness({
        ...confirmScript({ status: "create", email: "rana@example.com", display_name: "Rana" }),
        chat_signup_bind: "rejected",
      });
      const out = await turn(h.deps, "123456").run();
      expect(out.reply).not.toBe(SIGNUP_STRINGS.en.created);
    });
  });

  it("0 cancels a half-finished sign-up from any step", async () => {
    for (const step of ["name", "email", "code"]) {
      const h = harness({ chat_signup_state: { step }, chat_signup_cancel: null });
      const out = await turn(h.deps, "0").run();
      expect(out.reply).toBe(SIGNUP_STRINGS.en.cancelled);
      expect(h.calls.at(-1)?.fn).toBe("chat_signup_cancel");
    }
  });

  it("surfaces a database error to the caller instead of answering as if it worked", async () => {
    const deps = harness({}).deps; // every rpc is unscripted → error
    await expect(runChatSignupTurn(deps, { channel: "whatsapp", subject: "1", text: "register here", language: "en", sendCode: async () => true })).rejects.toBeTruthy();
  });
});

// ── Placement ───────────────────────────────────────────────────────────────

describe("where the webhooks call it", () => {
  const wa = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const meta = readFileSync("supabase/functions/meta-messaging-webhook/index.ts", "utf8");

  it("WhatsApp: after the subscription gate, text only, never for a silenced number", () => {
    const gate = wa.indexOf("requireActiveSubscription(db, { channel:");
    const call = wa.indexOf("runChatSignupTurn(");
    expect(gate).toBeGreaterThan(0);
    expect(call).toBeGreaterThan(gate);
    const guard = wa.slice(wa.lastIndexOf("const signupOk", call), call);
    expect(guard).toContain("!incoming.media");
    expect(guard).toContain("assistantIsSilenced");
  });

  it("Messenger: inside the refused-sender branch, never for an escalated or human-owned conversation", () => {
    const refused = meta.indexOf("if (!isAuthorized(verdict))");
    const call = meta.indexOf("runChatSignupTurn(");
    expect(call).toBeGreaterThan(refused);
    const guard = meta.slice(refused, call);
    expect(guard).toContain("conversation.escalated");
    expect(guard).toContain('conversation.control === "human"');
  });

  it("neither webhook logs an address, a name or a code", () => {
    for (const src of [wa, meta]) {
      const block = src.slice(src.indexOf("runChatSignupTurn("), src.indexOf("runChatSignupTurn(") + 3000);
      expect(block).not.toMatch(/console\.(log|error)\([^)]*(email|code|displayName|text)/i);
    }
  });
});

// ── Free replies for the unsubscribed ───────────────────────────────────────

import { freeReply, freeTopic } from "../../supabase/functions/_shared/chatFreeReplies.ts";
import { FREE_STRINGS } from "../../supabase/functions/_shared/chatFreeRepliesStrings.ts";

describe("free replies", () => {
  it("every language has every sentence, with no placeholder left unresolved", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      for (const [k, v] of Object.entries(FREE_STRINGS[l])) expect(v.trim().length, `${l}.${k}`).toBeGreaterThan(5);
      for (const text of ["hi", "plans", "what is visionex", "random words"]) {
        const { body } = freeReply(text, l);
        expect(body, l).not.toMatch(/\{(plans|site|here|url|terms)\}/);
      }
    }
  });

  it("states no price and no limit (those change and live behind the link)", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      for (const [k, v] of Object.entries(FREE_STRINGS[l])) expect(v, `${l}.${k}`).not.toMatch(/[$€£]|\d\s?(usd|dollars?|%)/i);
    }
  });

  it("every answer points at the plans and teaches the in-chat phrase", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      for (const text of ["hi", "thanks", "what is visionex", "plans", "accessibility", "zzz qqq"]) {
        const { body } = freeReply(text, l);
        expect(body, `${l}/${text}`).toContain("https://visionex.app/pricing");
        if (freeTopic(text) !== "plans") expect(body, `${l}/${text}`).toContain(SIGNUP_STRINGS[l].here);
      }
    }
  });

  it.each([
    ["hello", "greeting"],
    ["مرحبا", "greeting"],
    ["bonjour", "greeting"],
    ["شكرا لك", "thanks"],
    ["thank you", "thanks"],
    ["كم سعر الاشتراك", "plans"],
    ["باقة الأطفال", "kids"],
    ["how much does it cost", "plans"],
    ["هل الموقع مناسب للمكفوفين، كفيف", "accessibility"],
    ["do you work with NVDA", "accessibility"],
    ["أي لغات تدعمون", "languages"],
    ["ما هو Visionex", "about"],
    ["what can you do", "features"],
    ["أريد التواصل مع الدعم", "contact"],
    ["谢谢", "thanks"],
    ["你好", "greeting"],
  ])("%s → %s", (text, topic) => expect(freeTopic(text)).toBe(topic));

  it.each([
    "which one",              // contains «hi» as letters but not as a word
    "what is the capital of France",
    "",
    "x".repeat(400),
  ])("does not mistake %j for a topic", (text) => expect(freeTopic(text)).toBe("fallback"));

  it("is fixed text only: no model, speech, search or database import", () => {
    const src = readFileSync("supabase/functions/_shared/chatFreeReplies.ts", "utf8");
    expect(src).not.toMatch(/aiProvider|openai|elevenlabs|fetch\(|createClient|\.rpc\(|\.from\(/i);
  });

  it("is wired behind the same guards as sign-up, and rate limited", () => {
    const wa = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    const meta = readFileSync("supabase/functions/meta-messaging-webhook/index.ts", "utf8");
    const waCall = wa.indexOf("smartFreeReply(");
    expect(waCall).toBeGreaterThan(wa.indexOf("const signupOk"));
    // the flood guard is asked first, and the answer is only computed when it allows
    expect(wa.slice(waCall - 500, waCall)).toContain("chat_free_reply_allow");
    const metaCall = meta.indexOf("smartFreeReply((");
    expect(metaCall).toBeGreaterThan(meta.indexOf("const silenced"));
    expect(meta.slice(metaCall - 500, metaCall)).toContain("chat_free_reply_allow");
  });
});

// ── Mined lexicon (MASSIVE, Tatoeba) ────────────────────────────────────────

import { existsSync } from "node:fs";
import { fold } from "../../supabase/functions/_shared/chatSignup.ts";
import { LEXICON } from "../../supabase/functions/_shared/chatPhraseLexicon.ts";

describe("mined phrase lexicon", () => {
  it("covers every supported language and carries its attribution", () => {
    for (const l of SUPPORTED_LANGUAGES) expect(LEXICON[l], l).toBeDefined();
    const src = readFileSync("supabase/functions/_shared/chatPhraseLexicon.ts", "utf8");
    expect(src).toMatch(/CC BY 4\.0/);
    expect(src).toMatch(/CC BY 2\.0 FR/);
  });

  it("holds keywords, not a copy of the datasets", () => {
    const bytes = readFileSync("supabase/functions/_shared/chatPhraseLexicon.ts", "utf8").length;
    expect(bytes).toBeLessThan(80_000);
    for (const l of SUPPORTED_LANGUAGES) {
      expect(LEXICON[l].greeting.length).toBeLessThanOrEqual(25);
      expect(LEXICON[l].assistant.length).toBeLessThanOrEqual(60);
    }
  });

  it("answers everyday-assistant requests in several languages with the assistant pitch", () => {
    for (const text of [
      "what's the weather tomorrow", "ما هو الطقس اليوم", "quelle est la météo", "¿qué tiempo hace?", "wie ist das wetter",
      "какая погода", "今天天气怎么样", "天気を教えて", "play some music", "wake me with an alarm", "اخر الاخبار",
    ]) expect(freeTopic(text), text).toBe("assistant");
  });

  it("does not turn sales and support words into assistant requests", () => {
    for (const text of ["how do I order a plan", "I want to subscribe", "cancel my subscription", "هل عندكم باقة", "contact support"]) {
      expect(freeTopic(text), text).not.toBe("assistant");
    }
  });

  it("greets back on mined greeting phrases", () => {
    for (const text of ["good evening", "bonne soirée", "buenas tardes", "guten morgen", "おはよう", "доброе утро"]) {
      expect(["greeting"], text).toContain(freeTopic(text));
    }
  });

  // The mined words alone must be rare in ordinary sentences. Measured on the real
  // Tatoeba sample when TATOEBA_DIR points at it (never committed), skipped otherwise.
  const sample = process.env.TATOEBA_DIR;
  (sample && existsSync(sample) ? it : it.skip)("mined words are rare in ordinary Tatoeba sentences", () => {
    const words = Object.values(LEXICON).flatMap((l) => [...l.greeting, ...l.assistant]);
    const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<= )(?:${[...new Set(words)].map(escape).join("|")})(?= )`);
    const files: Record<string, string> = { en: "eng", fr: "fra", es: "spa", de: "deu", ar: "ara", ru: "rus", tr: "tur", it: "ita" };
    for (const [l, iso] of Object.entries(files)) {
      const lines = readFileSync(`${sample}/${iso}.tsv`, "utf8").split("\n").map((x) => x.split("\t")[2]).filter((t) => t && t.length < 60).slice(0, 20000).map((t) => ` ${fold(t)} `);
      const hit = lines.filter((t) => re.test(t)).length;
      expect(hit / lines.length, `${l} mined false-positive rate`).toBeLessThan(0.03); // news, radio, hello are real words in everyday text too
    }
  }, 120_000);
});

// ── The site guide: tiers, sections, prices — pinned to src/lib/billing/plans.ts ──

import { GUIDE_STRINGS, SITE_PRICES } from "../../supabase/functions/_shared/chatSiteGuideStrings.ts";
import { FREE_SECTIONS, KIDS_PLAN, TIERS } from "@/lib/billing/plans";

describe("site guide", () => {
  it("quotes the real monthly prices", () => {
    expect(SITE_PRICES).toEqual({ basic: TIERS.basic.price, pro: TIERS.pro.price, business: TIERS.business.price, kids: KIDS_PLAN.price });
  });

  it("every language has every guide sentence and no unfilled placeholder in the reply", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      for (const [k, v] of Object.entries(GUIDE_STRINGS[l])) expect(v.trim().length, `${l}.${k}`).toBeGreaterThan(20);
      for (const text of ["which plan", "benefits", "sections", "academy", "library", "games", "kids", "marketplace", "what is free", "career hub", "media studio"]) {
        expect(freeReply(text, l).body, `${l}/${text}`).not.toMatch(/\{(basic|pro|business|kids|plans|site|here)\}/);
      }
    }
  });

  it("the tiers answer lists the right prices and the right products in every language", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      const body = freeReply("which plan", l).body;
      for (const price of [SITE_PRICES.basic, SITE_PRICES.pro, SITE_PRICES.business, SITE_PRICES.kids]) expect(body, `${l} ${price}`).toContain(String(price));
      for (const name of ["Basic", "Pro", "Business", "Kids", "VisionKids", "Career Hub", "AI Media Studio", "Library Studio", "VX Finance Hub"]) expect(body, `${l} ${name}`).toContain(name);
    }
  });

  it("claims about what each plan opens agree with plans.ts", () => {
    const has = (plan: { sections: readonly string[] }, s: string) => plan.sections.includes(s as never);
    // Basic: assistant, academy, library, arcade, marketplace; not kids, career, tv, radio, media.
    for (const s of ["assistant", "academy", "library", "arcade", "marketplace"]) expect(has(TIERS.basic, s), s).toBe(true);
    for (const s of ["kids", "career", "tv", "radio", "messages", "simulations", "mediaStudio", "studio", "professional", "finance"]) expect(has(TIERS.basic, s), s).toBe(false);
    // Pro adds the household set, not the business tools.
    for (const s of ["kids", "career", "tv", "radio", "messages", "simulations"]) expect(has(TIERS.pro, s), s).toBe(true);
    for (const s of ["mediaStudio", "studio", "professional", "finance"]) expect(has(TIERS.pro, s), s).toBe(false);
    // Business has everything above and the tools.
    for (const s of ["mediaStudio", "studio", "professional", "finance", "kids", "tv"]) expect(has(TIERS.business, s), s).toBe(true);
    // Kids: VisionKids plus academy, library, arcade; not the assistant or the marketplace.
    for (const s of ["kids", "academy", "library", "arcade"]) expect(has(KIDS_PLAN, s), s).toBe(true);
    for (const s of ["assistant", "marketplace"]) expect(has(KIDS_PLAN, s), s).toBe(false);
    // Free without a plan: news, community, assistive products.
    expect([...FREE_SECTIONS].sort()).toEqual(["assistive", "community", "news"]);
    // …and the English text says exactly that.
    const en = GUIDE_STRINGS.en;
    expect(en.free).toMatch(/news.*community.*assistive/i);
    expect(en.tiers).toMatch(/Basic.*assistant, Academy, Library, Arcade, Bazaar/);
    expect(en.pro).toMatch(/VisionKids.*Career Hub.*TV.*Radio.*voice rooms.*simulations/s);
    expect(en.business).toMatch(/AI Media Studio.*Library Studio.*Professional tools.*VX Finance Hub/s);
  });

  it.each([
    ["what is the difference between the plans", "tiers"],
    ["الفرق بين الباقات", "tiers"],
    ["what does basic include", "tiers"],
    ["what are the benefits of subscribing", "benefits"],
    ["ماذا استفيد من الاشتراك", "benefits"],
    ["what sections does the site have", "sections"],
    ["ما هي اقسام الموقع", "sections"],
    ["tell me about the academy", "academy"],
    ["هل عندكم كتب", "library"],
    ["do you have games", "arcade"],
    ["هل في العاب", "arcade"],
    ["is there something for children", "kids"],
    ["is there a marketplace", "marketplace"],
    ["ما هو المجاني", "free"],
    ["do you have live radio", "pro"],
    ["هل عندكم وظائف", "pro"],
    ["can I generate images with AI media studio", "business"],
    ["باقة الأطفال", "kids"],
    ["how much does it cost", "plans"],
  ])("%s → %s", (text, topic) => expect(freeTopic(text)).toBe(topic));

  it("still lets the assistant topic and the sign-up phrase through", () => {
    expect(freeTopic("what's the weather tomorrow")).toBe("assistant");
    expect(parseSignupIntent("register here")).toBe("chat");
  });
});

// ── An active bot: asks what the person enjoys, recommends the plan that covers it ──

import { interests, recommendPlan } from "../../supabase/functions/_shared/chatFreeReplies.ts";
import { DISCOVER_STRINGS } from "../../supabase/functions/_shared/chatDiscoverStrings.ts";
import { SITE_PLANS } from "../../supabase/functions/_shared/chatSiteGuideStrings.ts";
import { PAID_PLANS } from "@/lib/billing/plans";

describe("discovery and recommendation", () => {
  it("the plan table the recommender uses is exactly plans.ts", () => {
    for (const p of SITE_PLANS) {
      const real = PAID_PLANS[p.id as keyof typeof PAID_PLANS];
      expect(p.price, p.id).toBe(real.price);
      const withoutFree = real.sections.filter((x) => !["news", "community", "assistive"].includes(x));
      expect([...p.sections].sort(), p.id).toEqual([...withoutFree].sort());
    }
  });

  it("asks what the person enjoys, in every language, and recommends with the real price", () => {
    for (const l of SUPPORTED_LANGUAGES) {
      expect(DISCOVER_STRINGS[l].discover.length, l).toBeGreaterThan(30);
      expect(DISCOVER_STRINGS[l].recommend, l).toContain("{plan}");
      expect(DISCOVER_STRINGS[l].recommend, l).toContain("{price}");
      const asked = freeReply("hello", l).body;
      expect(asked, l).not.toMatch(/\{(plan|price)\}/);
    }
  });

  it("a greeting, a price question and a vague message each end by asking what they like", () => {
    for (const text of ["hello", "how much does it cost", "random words here", "what is visionex"]) {
      expect(freeReply(text, "en").body, text).toContain(DISCOVER_STRINGS.en.discover);
    }
  });

  it("«help me choose» is only the question", () => {
    expect(freeTopic("help me choose a plan")).toBe("choose");
    expect(freeTopic("اي باقه تناسبني")).toBe("choose");
    expect(freeReply("help me choose a plan", "en").body).toContain(DISCOVER_STRINGS.en.discover);
  });

  it.each([
    ["I love games", "basic"],
    ["I like books and games", "basic"],
    ["something for my kids", "kids"],
    ["games for children", "kids"],
    ["I want to watch live tv and read books", "pro"],
    ["I want to generate images and publish", "business"],
    ["أحب الألعاب والكتب", "basic"],
    ["I want live tv and ai media studio", "business"],
  ])("%s → %s", (text, plan) => expect(recommendPlan(interests(text))?.id).toBe(plan));

  it("never recommends the Kids plan to an adult who only asked for games", () => {
    expect(recommendPlan(interests("I just want to play games"))?.id).not.toBe("kids");
  });

  it("recommends nothing when nothing was named", () => {
    expect(recommendPlan(interests("hello"))).toBeNull();
    expect(recommendPlan([])).toBeNull();
  });

  it("a named interest gets the plan with its real price instead of the question", () => {
    const { body, plan } = freeReply("I love games and books", "en");
    expect(plan).toBe("basic");
    expect(body).toContain("Basic ($5/month)");
    expect(body).not.toContain(DISCOVER_STRINGS.en.discover);
    expect(body).toContain("https://visionex.app/pricing");
    expect(freeReply("أحب الألعاب", "ar").body).toContain("Basic");
  });

  it("thanks and contact stay plain", () => {
    expect(freeReply("thank you", "en").body).not.toContain(DISCOVER_STRINGS.en.discover);
    expect(freeReply("contact us", "en").body).not.toContain(DISCOVER_STRINGS.en.discover);
  });
});

// ── A one-hour memory: sequential conversation ──────────────────────────────

import {
  detectWho,
  emptyMemory,
  respond,
  sanitizeMemory,
  shortAnswer,
  smartFreeReply,
  type Memory,
} from "../../supabase/functions/_shared/chatFreeMemory.ts";
import { EXAMPLES } from "../../supabase/functions/_shared/chatExamples.ts";

/** Plays a whole conversation, carrying memory the way the webhook does. */
function talk(language: string, ...messages: string[]) {
  let mem: Memory = emptyMemory();
  const out: { body: string; memory: Memory; plan?: string }[] = [];
  for (const m of messages) {
    const t = respond(m, language, mem);
    mem = sanitizeMemory(JSON.parse(JSON.stringify(t.memory))); // through storage and back
    out.push({ body: t.body, memory: mem, plan: t.plan });
  }
  return out;
}

describe("conversation memory", () => {
  it("asks what they like, then who it is for, then recommends — one question at a time", () => {
    const [a, b, c] = talk("en", "hello", "I love games", "it is for my son");
    expect(a.body).toContain(DISCOVER_STRINGS.en.discover);
    expect(b.body).toContain(DISCOVER_STRINGS.en.askWho);
    expect(b.body).not.toContain(DISCOVER_STRINGS.en.discover);
    expect(c.plan).toBe("kids");
    expect(c.body).toContain("Kids ($3/month)");
    expect(c.memory.last).toBe("recommend");
  });

  it("builds up interests across messages and recommends the plan that covers all of them", () => {
    const turns = talk("en", "I like books", "for me", "and I want live tv");
    expect(turns[1].plan).toBe("basic");
    expect(turns[2].plan).toBe("pro");
    expect(turns[2].memory.interests).toEqual(expect.arrayContaining(["library", "tv"]));
  });

  it("«yes» right after a recommendation gives the subscribe steps, with the pricing link", () => {
    const turns = talk("en", "I love games and books", "yes");
    expect(turns[0].memory.last).toBe("recommend");
    expect(turns[1].body).toContain("https://visionex.app/pricing");
    expect(turns[1].body).toContain(SIGNUP_STRINGS.en.here);
    expect(turns[1].memory.last).toBeNull();
  });

  it("«not now» closes politely and stops asking", () => {
    const turns = talk("en", "I love games and books", "not now");
    expect(turns[1].body).toContain(DISCOVER_STRINGS.en.notNow);
    expect(turns[1].body).not.toContain(DISCOVER_STRINGS.en.discover);
  });

  it("a «yes» with nothing pending is not a subscribe request", () => {
    const [t] = talk("en", "yes");
    expect(t.body).not.toContain(DISCOVER_STRINGS.en.subscribe.slice(0, 20));
    expect(t.memory.last).toBe("discover");
  });

  it("works in Arabic from the first message to the recommendation", () => {
    const turns = talk("ar", "مرحبا", "أحب الألعاب", "لابني");
    expect(turns[1].body).toContain(DISCOVER_STRINGS.ar.askWho);
    expect(turns[2].plan).toBe("kids");
  });

  it("a returning greeting continues instead of starting over", () => {
    const turns = talk("en", "I love games", "for me", "hello");
    expect(turns[2].body).toContain(DISCOVER_STRINGS.en.welcomeBack);
    expect(turns[2].plan).toBe("basic");
  });

  it("assistant requests show real examples in the person's language", () => {
    const cases: Record<string, string> = { en: "what is the weather", ar: "كيف الطقس", fr: "quelle est la météo", ja: "天気を教えて" };
    for (const [l, text] of Object.entries(cases)) {
      const [t] = talk(l, text);
      expect(t.body, l).toContain(DISCOVER_STRINGS[l as "en"].examplesLead);
      expect(t.body, l).toContain("«");
    }
  });

  it("stops asking questions after a very long conversation, and still answers", () => {
    const mem = emptyMemory();
    mem.turns = 45;
    const t = respond("hello", "en", mem);
    expect(t.body).not.toContain(DISCOVER_STRINGS.en.discover);
    expect(t.body).toContain("https://visionex.app/pricing");
  });

  describe("what is stored", () => {
    it("is only enum-like words: never a message, a name or a number", () => {
      const mem = respond("my name is Rana, my phone is 96170111222, I love games", "en", emptyMemory()).memory;
      const stored = JSON.stringify(mem);
      expect(stored).not.toMatch(/Rana|96170|phone|name/i);
      expect(Object.keys(mem).sort()).toEqual(["asked", "interests", "last", "plan", "turns", "who"]);
      expect(stored.length).toBeLessThan(400);
    });

    it("anything unexpected read back is dropped", () => {
      const bad = sanitizeMemory({
        interests: ["arcade", "<script>", 42, "DROP TABLE"], who: "admin", last: "root", plan: "free-for-all",
        asked: ["who", "evil"], turns: -5, extra: "x",
      });
      expect(bad.interests).toEqual(["arcade"]);
      expect(bad.who).toBeNull();
      expect(bad.last).toBeNull();
      expect(bad.plan).toBeNull();
      expect(bad.asked).toEqual(["who"]);
      expect(bad.turns).toBe(0);
      expect(Object.keys(bad)).not.toContain("extra");
      expect(sanitizeMemory("nonsense")).toEqual(emptyMemory());
      expect(sanitizeMemory(null)).toEqual(emptyMemory());
    });
  });

  describe("reading short answers", () => {
    it.each([["my son", "child"], ["لابني", "child"], ["for my business", "work"], ["شركتي", "work"], ["just for me", "self"], ["hello", null]])(
      "who: %s → %s", (text, who) => expect(detectWho(text)).toBe(who));
    it.each([["yes", "yes"], ["تمام", "yes"], ["ok", "yes"], ["not now", "no"], ["لا", "no"], ["I think the second plan sounds good because of the games", null]])(
      "answer: %s → %s", (text, a) => expect(shortAnswer(text)).toBe(a));
  });

  it("storage failures never lose the reply", async () => {
    const failing = () => Promise.reject(new Error("db down"));
    const turn = await smartFreeReply(failing as never, "whatsapp", "96170000009", "hello", "en");
    expect(turn.body).toContain(DISCOVER_STRINGS.en.discover);
    const errored = await smartFreeReply((async () => ({ data: null, error: new Error("x") })) as never, "meta", "facebook:1", "hello", "en");
    expect(errored.body.length).toBeGreaterThan(20);
  });

  it("round-trips through the real store functions' contract, per sender", async () => {
    const store = new Map<string, unknown>();
    const rpc = async (fn: string, args: Record<string, unknown>) => {
      const key = `${args._channel}:${args._subject}`;
      if (fn === "chat_memory_get") return { data: store.get(key) ?? {}, error: null };
      store.set(key, args._profile);
      return { data: true, error: null };
    };
    await smartFreeReply(rpc, "whatsapp", "96170000010", "I love games", "en");
    const second = await smartFreeReply(rpc, "whatsapp", "96170000010", "for my son", "en");
    expect(second.plan).toBe("kids");
    const stranger = await smartFreeReply(rpc, "whatsapp", "96170000011", "for my son", "en");
    expect(stranger.memory.interests).not.toContain("arcade");
  });

  describe("example pack", () => {
    it("covers every language with examples that look like requests", () => {
      for (const l of SUPPORTED_LANGUAGES) {
        const bank = EXAMPLES[l];
        expect(bank, l).toBeDefined();
        const total = Object.values(bank).reduce((n, list) => n + list.length, 0);
        expect(total, l).toBeGreaterThan(15);
        for (const list of Object.values(bank)) for (const u of list) {
          expect(u.length, `${l}: ${u}`).toBeLessThan(80);
          expect(u, `${l}: ${u}`).not.toMatch(/olly|\d|&/i);
        }
      }
    });
  });
});
