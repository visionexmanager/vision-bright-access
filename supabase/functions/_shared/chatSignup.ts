// Sign up from a chat — one state machine for WhatsApp and Messenger.
//
// The website asks for a name, an email address and a password. A chat asks for
// the first two and replaces the password with a code emailed to the address:
// control of the mailbox is the proof (the same one a password reset uses), and
// no password ever passes through a conversation, a log line or a message
// table. The account is created with an unguessable password nobody sees; the
// person sets their own through "forgot password" on the site if they want to
// log in there.
//
// ── What decides what ───────────────────────────────────────────────────────
//
// Every decision — throttles, attempt counter, expiry, whether the address
// already has an account — is a SQL function in `20261097000000_chat_signup.sql`
// so it holds when two deliveries race. This module is the thin, pure-ish part:
// reading what the sender typed, calling those functions, choosing a sentence.
//
// ── The rule that shapes the sentences ──────────────────────────────────────
//
// The code request says the same thing to a new address and to one that already
// has an account, and sends an email to both. Only after the right code comes
// back does the answer differ ("created" / "linked"), and by then the sender
// has proved they own the mailbox, so telling them is not a leak.
//
// Nothing here logs an address, a name, a code or a message body.

import { foldDigits } from "./whatsappCommands.ts";
import { generateLinkCode, hashLinkCode, readLinkCode, LINK_CODE_TTL_MINUTES } from "./whatsappIdentity.ts";
import { normaliseEmail } from "./whatsappOnboarding.ts";
import { featureErrorNotice, say } from "./whatsappStrings.ts";
import { signupSay, SIGNUP_STRINGS } from "./chatSignupStrings.ts";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./whatsappLanguages.ts";

export const SIGNUP_URL = "https://visionex.app/signup";
export const TERMS_URL = "https://visionex.app/legal";

export type SignupChannel = "whatsapp" | "meta";

/** Words that mean "I want an account". Matched on short messages only. */
const OFFER_WORDS = [
  "sign up", "signup", "register", "create account", "create an account", "new account", "open an account",
  "انشاء حساب", "إنشاء حساب", "حساب جديد", "سجلني", "تسجيل جديد", "فتح حساب", "اسجل", "سجل حساب", "اشتراك جديد",
  "creer un compte", "inscription", "inscrire",
  "crear cuenta", "crear una cuenta", "registrarme",
  "konto erstellen", "registrieren", "anmelden und konto",
  "hesap olustur", "hesap ac", "kayit ol",
  "создать аккаунт", "регистрация", "зарегистрироваться",
  "ثبت نام", "اکاؤنٹ بنا", "खाता बना", "रजिस्टर",
  "buat akun", "daftar", "criar conta", "crea account", "registrati",
  "account aanmaken", "registreren", "załóż konto", "zaloz konto", "zarejestruj",
  "tạo tài khoản", "đăng ký", "アカウント作成", "新規登録", "회원가입", "계정 만들",
  "注册", "创建账户", "অ্যাকাউন্ট খুল", "নিবন্ধন",
];

const MAX_INTENT_CHARS = 80;
const CANCEL_WORDS = new Set(["0", "#", "cancel", "stop", "الغاء", "إلغاء", "ألغي", "annuler", "cancelar", "abbrechen", "iptal", "отмена", "لغو"]);

/** Lower-cased, marks and punctuation removed, so «Créer» and «creer» agree. */
function fold(text: string): string {
  return foldDigits(text)
    .normalize("NFD")
    .replace(/[\p{M}ـ]/gu, "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OFFER_FOLDED = OFFER_WORDS.map(fold);
/** The exact phrase each offer teaches, folded — what «register here» means. */
const HERE_FOLDED = [
  ...SUPPORTED_LANGUAGES.map((l) => fold(SIGNUP_STRINGS[l].here)),
  fold("سجلني هنا"),
  fold("sign up here"),
];

export type SignupIntent = "offer" | "chat";

/** What a message is asking for, or null. Null is the overwhelmingly common answer. */
export function parseSignupIntent(text: string | null | undefined): SignupIntent | null {
  const raw = (text ?? "").trim();
  if (!raw || raw.length > MAX_INTENT_CHARS) return null;
  const value = fold(raw);
  if (!value) return null;
  if (HERE_FOLDED.some((p) => value.includes(p))) return "chat";
  if (OFFER_FOLDED.some((p) => value.includes(p))) return "offer";
  return null;
}

export function isCancel(text: string | null | undefined): boolean {
  const value = fold(text ?? "");
  return CANCEL_WORDS.has(value) || CANCEL_WORDS.has((text ?? "").trim());
}

/** The offer, as a sentence. Also appended to the one subscription notice. */
export function signupOfferText(language: string): string {
  return signupSay("offer", language).replace("{url}", SIGNUP_URL);
}

export interface SignupDeps {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
  /** Creates a confirmed auth user with an unguessable password; returns its id. */
  createUser(input: { email: string; displayName: string }): Promise<string | null>;
  /** Key for the code HMAC. Empty means the feature is not configured. */
  secret: string;
  emailConfigured: boolean;
}

export interface SignupInput {
  channel: SignupChannel;
  /** WhatsApp: the signed sender number. Meta: `<facebook|instagram>:<page-scoped id>`. */
  subject: string;
  text: string | null | undefined;
  language: string;
  /** Emails the code. Called after the reply is composed, never before. */
  sendCode(email: string, code: string): Promise<unknown>;
}

export interface SignupTurn {
  handled: boolean;
  reply?: string;
  /** Slow work to run after the reply is sent, so timing says nothing. */
  after?: () => Promise<void>;
  /** A log-safe outcome word. */
  outcome?: string;
}

const PASS: SignupTurn = { handled: false };

function lang(language: string): SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language) ? (language as SupportedLanguage) : "en";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * Runs one turn. Returns `{handled:false}` for anything that is not part of a
 * sign-up, so the caller carries on exactly as it did before.
 *
 * The caller has already refused to run this for a number a person owns or an
 * escalation silenced: a silenced number stays silenced.
 */
export async function runChatSignupTurn(deps: SignupDeps, input: SignupInput): Promise<SignupTurn> {
  const { channel, subject } = input;
  const language = lang(input.language);
  const ref = { _channel: channel, _subject: subject };
  const reply = (text: string, outcome: string): SignupTurn => ({ handled: true, reply: text, outcome });

  const { data: stateData, error: stateError } = await deps.rpc("chat_signup_state", ref);
  if (stateError) throw stateError;
  const state = asObject(stateData);
  const linked = state.linked === true;
  const step = typeof state.step === "string" ? state.step : null;
  const intent = parseSignupIntent(input.text);

  // Not in a sign-up and not asking for one: not ours.
  if (!step && !intent) return PASS;
  if (!deps.secret) return reply(featureErrorNotice(language), "unconfigured");

  if (!step) {
    if (linked) return reply(say("linkAlreadyLinked", language), "already_linked");
    if (intent === "offer") return reply(signupOfferText(language), "offer");
    const { data, error } = await deps.rpc("chat_signup_begin", ref);
    if (error) throw error;
    if (data === "throttled") return reply(say("linkThrottled", language), "throttled");
    if (data === "already_linked") return reply(say("linkAlreadyLinked", language), "already_linked");
    return reply(signupSay("askName", language), "started");
  }

  if (isCancel(input.text)) {
    await deps.rpc("chat_signup_cancel", ref);
    return reply(signupSay("cancelled", language), "cancelled");
  }

  if (step === "name") {
    const { data, error } = await deps.rpc("chat_signup_set_name", { ...ref, _name: input.text ?? "" });
    if (error) throw error;
    if (data === "ok") return reply(signupSay("askEmail", language), "name_ok");
    return reply(signupSay("nameInvalid", language), "name_invalid");
  }

  if (step === "email") {
    const address = normaliseEmail(input.text);
    if (!address) return reply(say("emailInvalid", language), "email_invalid");
    if (!deps.emailConfigured) return reply(featureErrorNotice(language), "no_email_provider");

    const code = generateLinkCode();
    const { data, error } = await deps.rpc("chat_signup_request_code", {
      ...ref,
      _email: address,
      _code_hash: await hashLinkCode(code, deps.secret),
      _ttl_minutes: LINK_CODE_TTL_MINUTES,
    });
    if (error) throw error;
    const outcome = asObject(data);
    const status = String(outcome.status ?? "none");
    if (status === "cooldown") return reply(say("linkCooldown", language), "cooldown");
    if (status === "throttled") return reply(say("linkThrottled", language), "throttled");
    if (status !== "sent") return PASS;
    return {
      ...reply(signupSay("codeSent", language).replace("{terms}", TERMS_URL), "code_sent"),
      after: async () => {
        if (outcome.deliver === true) await input.sendCode(address, code);
      },
    };
  }

  if (step === "code") {
    const typed = readLinkCode(input.text);
    if (!typed) return reply(signupSay("codeSent", language).replace("{terms}", TERMS_URL), "code_reminder");

    const { data, error } = await deps.rpc("chat_signup_confirm", {
      ...ref,
      _code_hash: await hashLinkCode(typed, deps.secret),
    });
    if (error) throw error;
    const verdict = asObject(data);
    const status = String(verdict.status ?? "none");

    if (status === "linked") return reply(signupSay("linked", language), "linked");
    if (status === "invalid") {
      const left = Math.max(0, Number(verdict.attempts_left ?? 0));
      return reply(say("linkCodeWrong", language).replace("{n}", String(left)), "invalid");
    }
    if (status === "expired") return reply(say("linkCodeExpired", language), "expired");
    if (status === "locked") return reply(say("linkCodeLocked", language), "locked");
    if (status !== "create") return reply(say("linkNoCodePending", language), "none");

    // The code was right: the mailbox is theirs. Only now does the account exist.
    const email = String(verdict.email ?? "");
    const displayName = String(verdict.display_name ?? "");
    const userId = email && displayName ? await deps.createUser({ email, displayName }) : null;
    if (!userId) {
      await deps.rpc("chat_signup_cancel", ref);
      return reply(featureErrorNotice(language), "create_failed");
    }
    const { data: bound, error: bindError } = await deps.rpc("chat_signup_bind", { ...ref, _user_id: userId });
    if (bindError || bound !== "bound") return reply(featureErrorNotice(language), "bind_failed");
    return reply(signupSay("created", language), "created");
  }

  return PASS;
}
