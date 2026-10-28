// The owner's ISP desk on WhatsApp: `/isp`, a list of actions, then who it is
// for, then a confirm.
//
//   /isp ─▶ list of actions ─▶ username | name ─▶ "send it" ─▶ confirm | reject
//
// Everything here is pure. The webhook loads and stores the one waiting step
// (`whatsapp_isp_pending`), sends what this returns, and runs the executor only
// after a tap on Confirm. Nothing in this file touches a network or a database.
//
// ── Rules this flow keeps ───────────────────────────────────────────────────
//
// * Owner only. The webhook checks the sender against the configured number
//   before any of this is reached; a customer's `/isp` is an ordinary message.
// * Nothing happens without a confirm, whatever the action. The confirm button
//   carries a nonce that names the one waiting step, so a tap on an old
//   message, or on a step since replaced, does nothing.
// * What the owner types is data. It is validated, bounded, shown back inside
//   the confirm, and never written to a log line.
// * Arabic and English only: the desk is the owner's tool, not a sender feature.

import type { Tappable } from "./whatsappInteractive.ts";

export type IspLang = "ar" | "en";

export const ISP_ACTIONS = [
  "ping",
  "resetmac",
  "renew",
  "disconnect",
  "inactive",
  "resetfup",
  "status",
] as const;
export type IspAction = (typeof ISP_ACTIONS)[number];

export const ISP_ID_KINDS = ["username", "name"] as const;
export type IspIdKind = (typeof ISP_ID_KINDS)[number];

export type IspStage = "await_value" | "await_confirm";

/** The one step waiting for the owner. */
export interface IspPending {
  action: IspAction;
  kind: IspIdKind | null;
  stage: IspStage | "await_kind";
  value: string | null;
  nonce: string;
  lang: IspLang;
}

/** What to run once the owner has confirmed. */
export interface IspRequest {
  action: IspAction;
  kind: IspIdKind;
  value: string;
}

export type IspResult =
  | { ok: true; detail?: string }
  | { ok: false; reason: "not_connected" | "unsupported" | "failed" };

/** How long a step waits before it is forgotten, in minutes. */
export const ISP_PENDING_MINUTES = 10;

// ── Words ───────────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<IspAction, Record<IspLang, string>> = {
  ping: { ar: "فحص الاتصال (Ping)", en: "Ping" },
  resetmac: { ar: "تصفير الـ MAC", en: "Reset MAC" },
  renew: { ar: "تجديد الاشتراك", en: "Renew" },
  disconnect: { ar: "فصل الجلسة", en: "Disconnect" },
  inactive: { ar: "إيقاف الحساب", en: "Suspend account" },
  resetfup: { ar: "تصفير الاستهلاك", en: "Reset FUP" },
  status: { ar: "حالة الزبون", en: "Customer status" },
};

const ACTION_HINT: Record<IspAction, Record<IspLang, string>> = {
  ping: { ar: "هل الزبون متصل ويرد", en: "Is the customer reachable" },
  resetmac: { ar: "فك ربط الجهاز الحالي", en: "Unbind the current device" },
  renew: { ar: "يخصم من رصيدك", en: "Charges your balance" },
  disconnect: { ar: "قطع الجلسة الحالية", en: "Drop the live session" },
  inactive: { ar: "يمنع الزبون من الاتصال", en: "Blocks the customer" },
  resetfup: { ar: "إعادة عدّاد الاستهلاك", en: "Restart the usage counter" },
  status: { ar: "قراءة فقط", en: "Read only" },
};

const KIND_LABEL: Record<IspIdKind, Record<IspLang, string>> = {
  username: { ar: "اسم المستخدم", en: "Username" },
  name: { ar: "الاسم", en: "Name" },
};

const T = {
  menuHeader: { ar: "مكتب الإنترنت", en: "ISP desk" },
  menuBody: { ar: "اختر العملية:", en: "Choose an action:" },
  menuButton: { ar: "العمليات", en: "Actions" },
  kindBody: { ar: "كيف أحدّد الزبون؟", en: "How do I find the customer?" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  confirm: { ar: "تأكيد", en: "Confirm" },
  reject: { ar: "رفض", en: "Reject" },
  action: { ar: "العملية", en: "Action" },
  by: { ar: "الزبون", en: "Customer" },
  askUsername: { ar: "أرسل اسم المستخدم (account) للزبون.", en: "Send the customer's username (account)." },
  askName: { ar: "أرسل اسم الزبون.", en: "Send the customer's name." },
  badUsername: {
    ar: "اسم المستخدم غير صالح. حروف إنكليزية وأرقام و . _ - @ فقط، حتى 64 حرفًا. أرسله مرة ثانية أو اكتب إلغاء.",
    en: "That username is not valid. Letters, digits and . _ - @ only, up to 64 characters. Send it again, or type cancel.",
  },
  badName: {
    ar: "الاسم غير صالح (من 2 إلى 80 حرفًا). أرسله مرة ثانية أو اكتب إلغاء.",
    en: "That name is not valid (2 to 80 characters). Send it again, or type cancel.",
  },
  replyHint: { ar: "أو اكتب: تأكيد / رفض", en: "Or type: confirm / reject" },
  cancelled: { ar: "تم الإلغاء. لم يتغير شيء.", en: "Cancelled. Nothing was changed." },
  expired: { ar: "انتهت صلاحية هذه الخطوة. اكتب /isp للبدء من جديد.", en: "That step has expired. Type /isp to start again." },
  nothingWaiting: { ar: "لا توجد عملية بانتظارك. اكتب /isp.", en: "Nothing is waiting. Type /isp." },
  notConnected: {
    ar: "خدمة الإنترنت غير موصولة بعد، فلم أنفّذ شيئًا.",
    en: "The ISP service is not connected yet, so nothing was run.",
  },
  unsupported: {
    ar: "هذه العملية غير مفعّلة بعد في الخدمة، فلم أنفّذ شيئًا.",
    en: "That action is not enabled in the service yet, so nothing was run.",
  },
  failed: { ar: "فشل التنفيذ. لم أتأكد أن شيئًا تغيّر.", en: "It failed. I cannot confirm anything changed." },
  done: { ar: "تم التنفيذ", en: "Done" },
} as const;

const t = (entry: Record<IspLang, string>, lang: IspLang): string => entry[lang];

// ── Ids ─────────────────────────────────────────────────────────────────────

const ID_PREFIX = "isp:";

export const ispActionId = (action: IspAction, lang: IspLang): string => `${ID_PREFIX}a:${action}:${lang}`;
export const ispKindId = (kind: IspIdKind): string => `${ID_PREFIX}k:${kind}`;
export const ispConfirmId = (nonce: string): string => `${ID_PREFIX}y:${nonce}`;
export const ispRejectId = (nonce: string): string => `${ID_PREFIX}n:${nonce}`;
export const ISP_CANCEL_ID = `${ID_PREFIX}x`;

export type IspTap =
  | { type: "action"; action: IspAction; lang: IspLang }
  | { type: "kind"; kind: IspIdKind }
  | { type: "confirm"; nonce: string }
  | { type: "reject"; nonce: string }
  | { type: "cancel" };

/** What a tapped id is, or null when it is not one of this desk's. */
export function parseIspTap(id: string | null | undefined): IspTap | null {
  const value = id ?? "";
  if (!value.startsWith(ID_PREFIX)) return null;
  if (value === ISP_CANCEL_ID) return { type: "cancel" };
  const action = /^isp:a:([a-z]+):(ar|en)$/.exec(value);
  if (action && (ISP_ACTIONS as readonly string[]).includes(action[1])) {
    return { type: "action", action: action[1] as IspAction, lang: action[2] as IspLang };
  }
  const kind = /^isp:k:([a-z]+)$/.exec(value);
  if (kind && (ISP_ID_KINDS as readonly string[]).includes(kind[1])) {
    return { type: "kind", kind: kind[1] as IspIdKind };
  }
  const yes = /^isp:y:([A-Za-z0-9]{6,32})$/.exec(value);
  if (yes) return { type: "confirm", nonce: yes[1] };
  const no = /^isp:n:([A-Za-z0-9]{6,32})$/.exec(value);
  if (no) return { type: "reject", nonce: no[1] };
  return null;
}

// ── Typed commands ──────────────────────────────────────────────────────────

/** `/isp`, `/isp en`, `/isp ar` — the language is the owner's choice, Arabic by default. */
export function parseIspCommand(text: string | null | undefined): { lang: IspLang } | null {
  const match = /^\/isp(?:\s+(ar|en))?\s*$/i.exec((text ?? "").trim());
  if (!match) return null;
  return { lang: (match[1]?.toLowerCase() as IspLang | undefined) ?? "ar" };
}

const CONFIRM_WORDS = /^(confirm|yes|ok|تأكيد|تاكيد|أكد|اكد|نعم)$/i;
const REJECT_WORDS = /^(reject|no|رفض|ارفض|لا)$/i;
const CANCEL_WORDS = /^(cancel|stop|#|الغاء|إلغاء|الغي|ألغِ)$/i;

export type IspTypedAnswer = "confirm" | "reject" | "cancel" | null;

export function parseIspAnswer(text: string | null | undefined): IspTypedAnswer {
  const value = (text ?? "").trim().replace(/^[\s.!؟?،]+|[\s.!؟?،]+$/g, "");
  if (!value || value.length > 12) return null;
  if (CONFIRM_WORDS.test(value)) return "confirm";
  if (REJECT_WORDS.test(value)) return "reject";
  if (CANCEL_WORDS.test(value)) return "cancel";
  return null;
}

// ── What the owner types as the identifier ──────────────────────────────────

const USERNAME = /^[A-Za-z0-9._@-]{1,64}$/;

/** The identifier, cleaned, or null when it is not acceptable for that kind. */
export function cleanIdentifier(kind: IspIdKind, raw: string | null | undefined): string | null {
  const text = (raw ?? "").normalize("NFC").trim();
  if (kind === "username") return USERNAME.test(text) ? text : null;
  // A name: ordinary letters, spaces and common marks; no control or invisible
  // characters, and short enough to read back in a confirm.
  const spaced = text.replace(/\s+/g, " ");
  const length = [...spaced].length;
  if (length < 2 || length > 80) return null;
  if (/[\p{C}\p{Zl}\p{Zp}]/u.test(spaced)) return null;
  return spaced;
}

// ── Messages ────────────────────────────────────────────────────────────────

const clip = (text: string, limit: number): string =>
  [...text].length <= limit ? text : `${[...text].slice(0, limit - 1).join("").trimEnd()}…`;

export function ispMenuMessage(lang: IspLang): Tappable {
  const rows = ISP_ACTIONS.map((action) => ({
    id: ispActionId(action, lang),
    title: clip(t(ACTION_LABEL[action], lang), 24),
    description: clip(t(ACTION_HINT[action], lang), 72),
  }));
  const text = [
    `*${t(T.menuHeader, lang)}*`,
    t(T.menuBody, lang),
    ...ISP_ACTIONS.map((action, i) => `${i + 1}. ${t(ACTION_LABEL[action], lang)}`),
  ].join("\n");
  return {
    interactive: {
      type: "list",
      header: { type: "text", text: t(T.menuHeader, lang) },
      body: { text: t(T.menuBody, lang) },
      action: { button: t(T.menuButton, lang), sections: [{ title: t(T.menuHeader, lang), rows }] },
    },
    text,
  };
}

export function ispKindMessage(action: IspAction, lang: IspLang): Tappable {
  const body = `*${t(ACTION_LABEL[action], lang)}*\n${t(T.kindBody, lang)}`;
  return {
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: [
          { type: "reply", reply: { id: ispKindId("username"), title: t(KIND_LABEL.username, lang) } },
          { type: "reply", reply: { id: ispKindId("name"), title: t(KIND_LABEL.name, lang) } },
          { type: "reply", reply: { id: ISP_CANCEL_ID, title: t(T.cancel, lang) } },
        ],
      },
    },
    text: `${body}\n1. ${t(KIND_LABEL.username, lang)}\n2. ${t(KIND_LABEL.name, lang)}`,
  };
}

export function ispAskValue(kind: IspIdKind, lang: IspLang): string {
  return t(kind === "username" ? T.askUsername : T.askName, lang);
}

export function ispConfirmMessage(pending: IspPending): Tappable {
  const { lang } = pending;
  const kind = pending.kind ?? "username";
  const lines = [
    `*${t(T.action, lang)}:* ${t(ACTION_LABEL[pending.action], lang)}`,
    `*${t(T.by, lang)}* (${t(KIND_LABEL[kind], lang)}): ${pending.value ?? ""}`,
  ];
  if (pending.action === "renew") lines.push(t(ACTION_HINT.renew, lang));
  const body = clip(lines.join("\n"), 1024);
  return {
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: [
          { type: "reply", reply: { id: ispConfirmId(pending.nonce), title: t(T.confirm, lang) } },
          { type: "reply", reply: { id: ispRejectId(pending.nonce), title: t(T.reject, lang) } },
        ],
      },
    },
    text: `${body}\n\n${t(T.replyHint, lang)}`,
  };
}

/** The sentence that closes a confirmed step. */
export function ispResultText(request: IspRequest, result: IspResult, lang: IspLang): string {
  // Narrowed with `in`, not on `ok`: the repo's compiler is not in strict mode,
  // where a boolean-literal discriminant does not narrow.
  if (!("reason" in result)) {
    const head = `${t(T.done, lang)}: ${t(ACTION_LABEL[request.action], lang)}`;
    return result.detail ? `${head}\n${clip(result.detail, 600)}` : head;
  }
  if (result.reason === "not_connected") return t(T.notConnected, lang);
  if (result.reason === "unsupported") return t(T.unsupported, lang);
  return t(T.failed, lang);
}

// ── The step machine ────────────────────────────────────────────────────────

export type IspInput =
  | { type: "command"; lang: IspLang }
  | { type: "tap"; tap: IspTap }
  | { type: "text"; text: string };

export interface IspStep {
  /** What to store: the next waiting step, or null to clear. */
  pending: IspPending | null;
  /** What to send, if anything. A plain string is sent as text. */
  reply: Tappable | string | null;
  /** Set only by a Confirm that matched the waiting step. */
  run: IspRequest | null;
}

const idle = (reply: Tappable | string | null, pending: IspPending | null = null): IspStep => ({
  pending,
  reply,
  run: null,
});

/**
 * One move of the desk.
 *
 * `pending` is the stored step (already checked for expiry by the caller, who
 * passes null for an expired one and says so with `wasExpired`).
 */
export function ispStep(
  pending: IspPending | null,
  input: IspInput,
  newNonce: () => string,
  wasExpired = false,
): IspStep {
  const lang: IspLang =
    pending?.lang ?? (input.type === "command" ? input.lang : input.type === "tap" && input.tap.type === "action" ? input.tap.lang : "ar");

  if (input.type === "command") {
    return idle(ispMenuMessage(input.lang), null);
  }

  if (input.type === "tap") {
    const tap = input.tap;
    if (tap.type === "cancel") return idle(t(T.cancelled, lang), null);

    if (tap.type === "action") {
      // A list can be tapped with nothing waiting: the menu itself is the start.
      const next: IspPending = {
        action: tap.action,
        kind: null,
        stage: "await_kind",
        value: null,
        nonce: newNonce(),
        lang: tap.lang,
      };
      return idle(ispKindMessage(tap.action, next.lang), next);
    }

    if (!pending) return idle(t(wasExpired ? T.expired : T.nothingWaiting, lang), null);

    if (tap.type === "kind") {
      if (pending.stage !== "await_kind") return idle(t(T.nothingWaiting, lang), pending);
      const next: IspPending = { ...pending, kind: tap.kind, stage: "await_value", value: null };
      return idle(ispAskValue(tap.kind, pending.lang), next);
    }

    // confirm / reject: only the step that carries this nonce, only at the confirm.
    if (pending.stage !== "await_confirm" || tap.nonce !== pending.nonce) {
      return idle(t(T.expired, lang), pending);
    }
    if (tap.type === "reject") return idle(t(T.cancelled, lang), null);
    if (!pending.kind || !pending.value) return idle(t(T.expired, lang), null);
    return {
      pending: null,
      reply: null,
      run: { action: pending.action, kind: pending.kind, value: pending.value },
    };
  }

  // Typed text.
  const answer = parseIspAnswer(input.text);
  if (!pending) return idle(t(wasExpired ? T.expired : T.nothingWaiting, lang), null);
  if (answer === "cancel") return idle(t(T.cancelled, lang), null);

  if (pending.stage === "await_value" && pending.kind) {
    const value = cleanIdentifier(pending.kind, input.text);
    if (!value) return idle(t(pending.kind === "username" ? T.badUsername : T.badName, lang), pending);
    const next: IspPending = { ...pending, stage: "await_confirm", value, nonce: newNonce() };
    return idle(ispConfirmMessage(next), next);
  }

  if (pending.stage === "await_confirm") {
    if (answer === "reject") return idle(t(T.cancelled, lang), null);
    if (answer === "confirm" && pending.kind && pending.value) {
      return {
        pending: null,
        reply: null,
        run: { action: pending.action, kind: pending.kind, value: pending.value },
      };
    }
    return idle(ispConfirmMessage(pending), pending);
  }

  // await_kind: a typed 1 / 2 picks the kind; anything else repeats the question.
  if (pending.stage === "await_kind") {
    const digit = input.text.trim();
    const kind: IspIdKind | null = digit === "1" ? "username" : digit === "2" ? "name" : null;
    if (!kind) return idle(ispKindMessage(pending.action, pending.lang), pending);
    return idle(ispAskValue(kind, pending.lang), { ...pending, kind, stage: "await_value", value: null });
  }

  return idle(t(T.nothingWaiting, lang), null);
}

/** The executor the webhook uses until the ISP service is connected. */
export const notConnectedExecutor = async (_request: IspRequest): Promise<IspResult> => ({
  ok: false,
  reason: "not_connected",
});

export type IspExecutor = (request: IspRequest) => Promise<IspResult>;
