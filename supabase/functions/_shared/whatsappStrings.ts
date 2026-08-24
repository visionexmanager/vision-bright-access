// Everything the assistant says that is not a feature's own words.
//
// Refusals, "still working on it", "that has been switched off", and every
// question the first-time profile asks — the sentences that belong to the
// *interface* rather than to weather or OCR or the model. They live in one file
// because they are the part a sender meets over and over: if "Back" is phrased
// one way in the main menu and another way three levels down, that is not a
// cosmetic difference, it is a person learning two systems.
//
// ── What changed when the numbers went ──────────────────────────────────────
//
// These strings used to teach a keypad: "Reply with a number", "0 Back · 00
// Main menu · #  Cancel". Every menu carried that footer, every sender had to
// learn it, and a screen reader read it aloud at the end of every single menu.
// The menu is now tappable rows with names on them, so the footer is gone and
// what is left says what happened rather than how to operate a numeric remote.
//
// The commands still work — `0`, `00` and `#` are still parsed, because people
// learned them and taking them away would be the change that actually broke
// something. They are simply no longer taught, which is the difference between
// supporting a thing and requiring it.
//
// ── Languages ───────────────────────────────────────────────────────────────
//
// English and Arabic are written here, inline and required. The other eighteen
// are in `whatsappStringsLocales.ts` and are folded in below. A string missing
// a language reads in English rather than in `undefined`, and the suite reports
// which are short.
//
// Pure: no `Deno`, no fetch, no database. Just words.

import { localized, type Language, type Localized } from "./whatsappCatalog.ts";
import { UI_TEXT } from "./whatsappStringsLocales.ts";

export type { Localized };

/**
 * The interface's own vocabulary.
 *
 * Two rules the suite enforces: every entry says something in both of the two
 * required languages, and no entry names a provider, a status code or anything
 * else a sender cannot act on.
 */
const BASE_STRINGS = {
  // ── The tappable chrome ───────────────────────────────────────────────
  //
  // Three labels carry the whole of navigation now. They are short because
  // Meta allows 20 characters on a button and 24 on a row title, and they are
  // words rather than symbols because a screen reader announces the label and
  // nothing else: a row titled "0" tells its listener nothing at all.

  /** The button that opens an interactive list. Meta requires one; 20 chars. */
  menuButton: { ar: "القائمة", en: "Menu" },
  /** The row that goes one level up. Replaces the old `0`. */
  back: { ar: "رجوع", en: "Back" },
  /** The row that returns to the top. Replaces the old `00`. */
  mainMenu: { ar: "القائمة الرئيسية", en: "Main menu" },

  /**
   * The closing line of the *text* copy of a menu.
   *
   * Only ever read by somebody whose interactive message Meta refused — outside
   * the 24-hour service window, or on a client too old for lists. It has to
   * leave them a way to act, so it names the way that always works: the name of
   * the thing they want.
   */
  textMenuHint: {
    ar: "أرسل اسم ما تريد، أو «رجوع».",
    en: "Reply with the name of what you need, or \"Back\".",
  },

  invalidChoice: {
    ar: "لم أفهم ذلك. هذه القائمة من جديد:",
    en: "I didn't catch that. Here's the menu again:",
  },
  disabled: {
    ar: "هذه الخدمة لم تُفتح بعد. سأخبرك ما إن تصبح جاهزة.",
    en: "That service isn't open yet. I'll say so when it is.",
  },
  unavailable: {
    ar: "هذه الخدمة غير متاحة الآن.",
    en: "That one isn't available right now.",
  },
  /**
   * A feature that is declared and announced but not built yet.
   *
   * `{name}` is the feature's own title, so the sentence names the thing the
   * sender asked for rather than "that service", which reads as though the
   * assistant had not understood them. Every language carries the placeholder,
   * and a test fails the build if one drops it.
   */
  comingSoon: {
    ar: "«{name}» لم تُفتح بعد — سأخبرك ما إن تصبح جاهزة.",
    en: "\"{name}\" isn't open yet — I'll say so when it is.",
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
    ar: "لم أجد شيئاً لأعرضه. جرّب صياغة أخرى.",
    en: "I didn't find anything to show you. Try putting it another way.",
  },
  failed: {
    ar: "تعذّر إتمام هذه الخدمة الآن. جرّب مرة أخرى.",
    en: "Sorry — that didn't go through. Please try again.",
  },
  stoppedWorking: {
    ar: "أوقفت العملية. لم يُرسل شيء.",
    en: "Stopped. Nothing was sent.",
  },

  help: {
    ar: [
      "*كيف تتنقل*",
      "",
      "• اضغط على أي بند في القائمة ليفتح",
      "• *رجوع* يعيدك خطوة واحدة",
      "• *القائمة الرئيسية* تبدأ من الأعلى",
      "",
      "وتقدر دائماً تكتب سؤالك أو ترسله صوتياً مباشرة.",
    ].join("\n"),
    en: [
      "*Getting around*",
      "",
      "• Tap an item on the menu to open it",
      "• *Back* takes you up one level",
      "• *Main menu* starts again from the top",
      "",
      "You can always just ask a question, typed or as a voice note.",
    ].join("\n"),
  },

  // ── The assistant's own prompts ───────────────────────────────────────
  //
  // Moved here from `whatsappAssistant.ts` so they are translated by the same
  // table as everything else a sender reads. Two of them used to end in "or 0
  // to go back", which was the numeric interface teaching itself inside the
  // feature people use most; the way back is a button on the message now.

  askForQuestion: {
    ar: "تفضل، اكتب سؤالك.",
    en: "Go ahead — send me your question.",
  },
  askForVoice: {
    ar: "أرسل سؤالك برسالة صوتية وسأسمعه.",
    en: "Send your voice question and I'll listen.",
  },
  emptyQuestion: {
    ar: "لم يصلني سؤال. اكتب سؤالك وسأجيبك.",
    en: "I didn't get a question there. Send one and I'll answer.",
  },
  tooLong: {
    ar: "هذا السؤال أطول مما أستطيع قراءته دفعة واحدة. اختصره أو قسّمه إلى سؤالين.",
    en: "That question is longer than I can take in one go. Shorten it, or split it in two.",
  },
  newThread: {
    ar: "بدأنا محادثة جديدة. ما سبق محفوظ، لكنني لن أعود إليه. تفضل بسؤالك.",
    en: "New conversation started. What came before is kept but set aside. Go ahead.",
  },
  voiceExpected: {
    ar: "أنا بانتظار رسالة صوتية. أرسلها، أو اكتب سؤالك مباشرة.",
    en: "I'm waiting for a voice note. Send one, or just type your question.",
  },

  // ── The first-time profile ────────────────────────────────────────────
  //
  // One question per message. A single message carrying five questions is a
  // form, and a form read aloud by a screen reader is five questions the
  // listener has to hold in their head while answering the first one.
  //
  // None of these asks for a phone number. It arrived with the message, signed
  // by Meta, and asking somebody to type the number they are texting from is
  // both redundant and — because a typed number can disagree with the verified
  // one — a way to attach a profile to the wrong person.

  askName: {
    ar: "أهلاً بك في Visionex. شو اسمك الكامل؟",
    en: "Welcome to Visionex. What is your full name?",
  },
  askBirthDate: {
    ar: "شو تاريخ ميلادك؟ مثلاً 1990-03-12 أو 12/03/1990.",
    en: "What is your date of birth? For example 1990-03-12 or 12/03/1990.",
  },
  askGender: {
    ar: "كيف تحب أن أخاطبك؟",
    en: "How would you like me to refer to you?",
  },
  askEmail: {
    ar: "شو بريدك الإلكتروني؟",
    en: "What is your email address?",
  },
  askCountry: {
    ar: "بأي بلد تعيش؟",
    en: "Which country do you live in?",
  },

  genderMale: { ar: "ذكر", en: "Male" },
  genderFemale: { ar: "أنثى", en: "Female" },
  genderOther: { ar: "غير ذلك", en: "Other" },
  genderUndisclosed: { ar: "أفضّل عدم الإفصاح", en: "Prefer not to say" },

  /** The row that leaves the shortlist and asks them to type a country. */
  countryOther: { ar: "بلد آخر", en: "Another country" },
  countryTypeHint: {
    ar: "اكتب اسم بلدك وسأتعرّف عليه.",
    en: "Send me the name of your country and I'll find it.",
  },

  profileReady: {
    ar: "تمام، صار عندك ملف في Visionex.",
    en: "Your profile is ready.",
  },

  /**
   * Said after the language is changed from the menu.
   *
   * Deliberately without naming the language. The sentence arriving *in* the
   * new language is the confirmation, and it works in all twenty without a
   * placeholder that every translation would have to get right. Said as well as
   * shown, because somebody who cannot see the menu redraw needs to hear that
   * something happened.
   */
  languageSet: {
    ar: "تمام، سأتابع معك بهذه اللغة.",
    en: "Done — I'll answer in this language from now on.",
  },

  nameInvalid: {
    ar: "ما وصلني اسم أقدر أناديك فيه. اكتبه كنص من فضلك.",
    en: "I didn't get a name I can call you by. Please send it as text.",
  },
  birthDateInvalid: {
    ar: "ما قدرت أقرأ هذا التاريخ. جرّب صيغة مثل 1990-03-12.",
    en: "I couldn't read that date. Try a form like 1990-03-12.",
  },
  emailInvalid: {
    ar: "هذا لا يبدو بريداً إلكترونياً. جرّب مرة أخرى.",
    en: "That doesn't look like an email address. Please try again.",
  },
  countryInvalid: {
    ar: "ما عرفت هذا البلد. اكتب الاسم مرة أخرى.",
    en: "I didn't recognise that country. Send the name again.",
  },

  /**
   * Said when a voice note arrives before the profile is finished.
   *
   * The voice pipeline is untouched and works exactly as it always has — after
   * onboarding. During it, a recording is not fed to the assistant: the answer
   * to "what is your email address" is not something to guess at from a
   * transcript, and a misheard address is worse than no address.
   */
  onboardingNeedsText: {
    ar: "سأسمع رسائلك الصوتية بعد ما نخلص هالخطوة. اكتب لي جوابك الآن من فضلك.",
    en: "I'll listen to voice notes once this is done. Please send your answer as text for now.",
  },
  /** Said when Back is tapped on the first question there is. */
  onboardingAtStart: {
    ar: "هذا أول سؤال.",
    en: "This is the first question.",
  },
} as const;

export type UiKey = keyof typeof BASE_STRINGS;

/**
 * The vocabulary, in every language it has been written in.
 *
 * Folded together once at module load, exactly as the catalog folds its own
 * table: the inline English and Arabic are the floor, and a language present in
 * `UI_TEXT` overrides nothing — it fills in.
 */
export const UI_STRINGS: Readonly<Record<UiKey, Localized>> = (() => {
  const out = {} as Record<UiKey, Localized>;
  for (const key of Object.keys(BASE_STRINGS) as UiKey[]) {
    out[key] = { ...BASE_STRINGS[key], ...(UI_TEXT[key] ?? {}) };
  }
  return out;
})();

/** One sentence, in the language the session settled on. */
export const say = (key: UiKey, language: Language): string => localized(UI_STRINGS[key], language);

/** The "not open yet" sentence, carrying the feature's own name. */
export function comingSoonNotice(language: Language, title: string): string {
  return say("comingSoon", language).replace("{name}", title);
}

/**
 * What a failed feature says.
 *
 * No error code, no provider name, no stack: none of it is actionable by the
 * person reading it, and some of it would be a leak. The technical detail goes
 * to the log, and the sender is told what to do next instead.
 */
export const featureErrorNotice = (language: Language): string => say("failed", language);

/**
 * The closing line under the text copy of a menu.
 *
 * One line, the same one everywhere, and no longer conditional on whether the
 * menu has a parent: "Back" is a row on the message itself now, so the text
 * copy no longer has to teach two different sets of keys depending on how deep
 * the sender happens to be.
 */
export const footerFor = (_isRoot: boolean, language: Language): string =>
  say("textMenuHint", language);
