// Everything the assistant says that is not a feature's own words.
//
// Footers, refusals, "still working on it", "that has been switched off" — the
// sentences that belong to the *interface* rather than to weather or OCR or the
// model. They live in one file because they are the part a sender meets over
// and over: if "0 Back" is phrased one way in the main menu and another way
// three levels down, that is not a cosmetic difference, it is a person learning
// two systems.
//
// Every entry carries both languages, and there is no default. A string this
// file cannot say in the sender's language is a string this file may not send —
// which is enforced by a test that walks every key and fails on a missing or
// untranslated one.
//
// Pure: no `Deno`, no fetch, no database. Just words.

import type { Language } from "./whatsappCatalog.ts";

/** Both languages of one sentence. */
export interface Localized {
  readonly ar: string;
  readonly en: string;
}

/**
 * The navigation footer.
 *
 * Three exits, always the same three, in the same order, everywhere. A sender
 * who has read it once in the main menu does not have to read it again — and a
 * screen reader reaching the end of a menu announces the way out rather than
 * simply stopping.
 *
 * The separator is a middle dot rather than a line break: WhatsApp collapses a
 * long menu into a "read more" link, and the footer is the part that must
 * survive that.
 */
export const UI_STRINGS = {
  /** Shown under the main menu, where "back" has nowhere to go. */
  mainFooter: {
    ar: "أرسل الرقم للاختيار.\n00 القائمة الرئيسية · # إلغاء · مساعدة",
    en: "Reply with a number.\n00 Main menu · # Cancel · help",
  },
  /** Shown under every other menu. */
  submenuFooter: {
    ar: "أرسل الرقم للاختيار.\n0 رجوع · 00 القائمة الرئيسية · # إلغاء",
    en: "Reply with a number.\n0 Back · 00 Main menu · # Cancel",
  },

  invalidChoice: {
    ar: "لم أفهم هذا الاختيار. اختر رقماً من القائمة:",
    en: "I didn't recognise that option. Please choose one of these numbers:",
  },
  disabled: {
    ar: "هذه الخدمة لم تُفتح بعد. سأخبرك ما إن تصبح جاهزة — اختر رقماً آخر من القائمة:",
    en: "That service isn't open yet. I'll say so when it is — pick another number for now:",
  },
  unavailable: {
    ar: "هذه الخدمة غير متاحة الآن. جرّب رقماً آخر من القائمة:",
    en: "That one isn't available right now. Try another number:",
  },
  /** Said when a feature is switched off while somebody is standing in it. */
  withdrawn: {
    ar: "أُغلقت هذه الخدمة للتو. أعدتك إلى القائمة السابقة:",
    en: "That service has just been switched off. Here's where you were before it:",
  },
  cancelled: {
    ar: "ألغيت العملية. أنت الآن هنا:",
    en: "Cancelled. You're here now:",
  },
  nothingToCancel: {
    ar: "لا يوجد شيء قيد التنفيذ. أنت هنا:",
    en: "There was nothing running. You're here:",
  },
  atMainMenu: {
    ar: "أنت في القائمة الرئيسية:",
    en: "You're at the main menu:",
  },
  timedOut: {
    ar: "مرّ وقت طويل، فبدأت من جديد. لغتك وإعداداتك كما هي.",
    en: "It had been a while, so I started fresh. Your language and settings are unchanged.",
  },
  staleSelection: {
    ar: "هذا الخيار لم يعد موجوداً. هذه القائمة الحالية:",
    en: "That option has moved. Here's the current menu:",
  },

  /** The lifecycle sentences, shared by every feature that takes time. */
  processing: {
    ar: "⏳ عم عالج طلبك…",
    en: "⏳ Processing your request…",
  },
  emptyResult: {
    ar: "لم أجد شيئاً لأعرضه. جرّب صياغة أخرى، أو اختر رقماً من القائمة.",
    en: "I didn't find anything to show you. Try putting it another way, or pick a number.",
  },
  failed: {
    ar: "تعذّر إتمام هذه الخدمة الآن. جرّب مرة أخرى، أو اختر رقماً آخر من القائمة.",
    en: "Sorry — that didn't go through. Please try again, or pick another number from the menu.",
  },
  stoppedWorking: {
    ar: "أوقفت العملية. لم يُرسل شيء.",
    en: "Stopped. Nothing was sent.",
  },

  help: {
    ar: [
      "*كيف تتنقل*",
      "",
      "• أرسل *رقم* الخدمة لتفتحها",
      "• *0* للرجوع خطوة واحدة",
      "• *00* أو *قائمة* للقائمة الرئيسية",
      "• *#* أو *إلغاء* لإيقاف العملية الحالية",
      "• *مساعدة* لعرض هذا الشرح",
      "",
      "وتقدر دائماً تكتب سؤالك أو ترسله صوتياً بدون أي رقم.",
    ].join("\n"),
    en: [
      "*Getting around*",
      "",
      "• Send the *number* of a service to open it",
      "• *0* goes back one step",
      "• *00* or *menu* returns to the main menu",
      "• *#* or *cancel* stops what's running",
      "• *help* shows this again",
      "",
      "You can always just ask a question, typed or as a voice note, with no number at all.",
    ].join("\n"),
  },
} as const;

export type UiKey = keyof typeof UI_STRINGS;

/** One sentence, in the language the session settled on. */
export const say = (key: UiKey, language: Language): string => UI_STRINGS[key][language];

/**
 * A feature that is declared and announced but not built yet.
 *
 * Takes the feature's own title so the sentence names the thing the sender
 * asked for, rather than "that service", which reads as though the assistant
 * did not understand them.
 */
export function comingSoonNotice(language: Language, title: string): string {
  return language === "ar"
    ? `«${title}» لم تُفتح بعد — سأخبرك ما إن تصبح جاهزة. اكتب «0» للرجوع أو «قائمة» للقائمة الرئيسية.`
    : `"${title}" isn't open yet — I'll say so when it is. Send 0 to go back, or "menu" for the main menu.`;
}

/**
 * What a failed feature says.
 *
 * No error code, no provider name, no stack: none of it is actionable by the
 * person reading it, and some of it would be a leak. The technical detail goes
 * to the log, and the sender is told what to do next instead.
 */
export const featureErrorNotice = (language: Language): string => say("failed", language);

/** The footer for a menu, by whether it has anywhere to go back to. */
export const footerFor = (isRoot: boolean, language: Language): string =>
  say(isRoot ? "mainFooter" : "submenuFooter", language);
