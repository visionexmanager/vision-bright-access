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
