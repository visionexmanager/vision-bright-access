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

  // ── Linking a number to an account, and the orders it unlocks ─────────────
  //
  // Every sentence here is written to be true whether or not the address the
  // sender typed has an account behind it. "A code is on its way" is said to
  // both, and a wrong code fails with the same words as a code for an address
  // nobody registered — otherwise this feature becomes a way to find out who
  // has a Visionex account, one email address at a time.

  /** Asked when somebody wants their orders and this number is not linked. */
  linkAskEmail: {
    ar: "لأجد طلباتك أحتاج أن أعرف أي حساب Visionex يخصّك. أرسل البريد الإلكتروني الذي تدخل به إلى الموقع، وسأرسل إليه رمزاً من ست خانات.",
    en: "To find your orders I need to know which Visionex account is yours. Send the email address you sign in with and I'll email it a six-digit code.",
  },
  /** Said after a code request, whether or not there was anywhere to send it. */
  linkCodeSent: {
    ar: "إن كان لهذا البريد حساب في Visionex فالرمز في طريقه إليه الآن. أرسل لي الرمز — صالح لعشر دقائق.",
    en: "If that address has a Visionex account, a six-digit code is on its way to it. Send me the code — it's good for ten minutes.",
  },
  /** One code a minute. */
  linkCooldown: {
    ar: "أرسلت رمزاً قبل قليل. أمهله دقيقة، ثم راجع بريدك ومجلد الرسائل غير المرغوبة.",
    en: "I've just sent a code. Give it a minute, then check your inbox and your spam folder.",
  },
  linkThrottled: {
    ar: "طلبات كثيرة للرمز في وقت قصير. سأتوقف عن هذا مدة ساعة — لا شيء ضاع، وطلباتك في مكانها.",
    en: "That's a lot of code requests in a short time. I'll pause this for an hour — nothing is lost and your orders stay where they are.",
  },
  linkAlreadyLinked: {
    ar: "هذا الرقم مربوط بحساب Visionex بالفعل. اكتب «فك الربط» أولاً إن أردت ربط حساب آخر.",
    en: "This number is already linked to a Visionex account. Say \"unlink\" first if you want to connect a different one.",
  },
  linkVerified: {
    ar: "تم — صار هذا الرقم مربوطاً بحسابك في Visionex. اسألني عن طلباتك متى شئت.",
    en: "Done — this number is linked to your Visionex account. Ask me about your orders any time.",
  },
  /** Carries `{n}`, the number of tries left. A translation must keep it. */
  linkCodeWrong: {
    ar: "هذا الرمز غير صحيح. تأكد منه وأرسله مرة أخرى — بقيت لك {n} محاولات.",
    en: "That code didn't work. Check it and send it again — {n} tries left.",
  },
  linkCodeExpired: {
    ar: "انتهت صلاحية هذا الرمز. اكتب «اربط حسابي» وسأرسل رمزاً جديداً.",
    en: "That code has expired. Say \"link my account\" and I'll send a fresh one.",
  },
  linkCodeLocked: {
    ar: "محاولات خاطئة كثيرة، فألغيت ذلك الرمز. اكتب «اربط حسابي» لنبدأ من جديد.",
    en: "Too many wrong codes, so I've cancelled that one. Say \"link my account\" to start again.",
  },
  linkNoCodePending: {
    ar: "لا أنتظر رمزاً الآن. اكتب «اربط حسابي» إن أردت ربط حسابك في Visionex.",
    en: "I'm not waiting for a code right now. Say \"link my account\" if you'd like to connect your Visionex account.",
  },
  linkUnlinked: {
    ar: "تم فك الربط. نسيت أي حساب Visionex يخصّ هذا الرقم.",
    en: "Unlinked. I've forgotten which Visionex account this number belongs to.",
  },
  linkNotLinked: {
    ar: "هذا الرقم غير مربوط بأي حساب Visionex، فلا شيء لفكّه.",
    en: "This number isn't linked to any Visionex account, so there's nothing to disconnect.",
  },

  /** The three lines of the email itself. Sent, not shown in the chat. */
  linkEmailSubject: {
    ar: "رمز ربط واتساب بحسابك في Visionex",
    en: "Your Visionex WhatsApp code",
  },
  linkEmailIntro: {
    ar: "طُلب ربط حساب Visionex هذا برقم واتساب. اكتب هذا الرمز في محادثة واتساب للتأكيد:",
    en: "Someone asked to link this Visionex account to a WhatsApp number. Type this code into the WhatsApp chat to confirm:",
  },
  linkEmailWarning: {
    ar: "إن لم تكن أنت، تجاهل هذه الرسالة — لا يحدث أي ربط قبل إدخال الرمز، وتنتهي صلاحيته خلال عشر دقائق.",
    en: "If that wasn't you, ignore this email — nothing is linked until the code is entered, and it expires in ten minutes.",
  },

  ordersHeading: {
    ar: "*آخر طلباتك*",
    en: "*Your recent orders*",
  },
  ordersNone: {
    ar: "لا توجد طلبات في حسابك على Visionex حتى الآن.",
    en: "There are no orders on your Visionex account yet.",
  },
  ordersFooter: {
    ar: "التفاصيل الكاملة والعناوين والفواتير في visionex.app ضمن «طلباتي».",
    en: "Full details, addresses and invoices are on visionex.app under My orders.",
  },
  /** An order whose items are gone from the catalogue still has to be named. */
  ordersItemsUnknown: {
    ar: "طلب",
    en: "Order",
  },
  orderReference: {
    ar: "الرقم المرجعي:",
    en: "Reference:",
  },

  // The eight states `bazaar_orders.status` allows, in words rather than in
  // the database's vocabulary. "payment_failed" read aloud is not a sentence.
  orderPending: { ar: "بانتظار الدفع", en: "Waiting for payment" },
  orderPaid: { ar: "مدفوع", en: "Paid" },
  orderProcessing: { ar: "قيد التجهيز", en: "Being prepared" },
  orderShipped: { ar: "في الطريق إليك", en: "On its way" },
  orderCompleted: { ar: "تم التسليم", en: "Delivered" },
  orderCancelled: { ar: "ملغى", en: "Cancelled" },
  orderRefunded: { ar: "أُعيد المبلغ", en: "Refunded" },
  orderPaymentFailed: { ar: "لم تتم عملية الدفع", en: "Payment didn't go through" },

  // ── The refusals, moved here from the features that owned them ───────────
  //
  // These sentences are older than this file and were written when the
  // assistant answered in two languages. They stayed `"ar" | "en"` while the
  // menu learned eighteen more, which meant a Turkish sender was welcomed in
  // Turkish, answered in Turkish, and then told in English that their PDF was a
  // scan — the one message in the conversation they could not read, at the one
  // moment they needed to know what to do next.
  //
  // The Arabic and English wording below is carried over **unchanged**: nothing
  // an existing sender reads today is different, and the eighteen additions in
  // `whatsappStringsLocales.ts` are translations of exactly these.

  /** Said when the conversation is handed to a person. */
  noticeHandover: {
    ar: "سأحوّل هذه المحادثة إلى فريق Visionex ليتابعها معك. تم تسجيل رسالتك، وسيتواصل معك أحد أفراد الفريق.",
    en: "I'm passing this conversation to the Visionex team so they can follow up. Your message has been logged and someone from the team will get back to you.",
  },
  /** Said once per window to a sender who is being throttled. */
  noticeRateLimit: {
    ar: "وصلتني رسائل كثيرة بسرعة. سأتوقف قليلاً ثم أتابع معك — رسائلك محفوظة ولن تضيع. إذا كان الأمر عاجلاً راسلنا على https://visionex.app/contact",
    // "pick up again" became "carry on": moving this sentence into the
    // interface's vocabulary put it under the guard that bans keypad words, and
    // that guard reads `\bpick\b` without knowing which sense was meant. One
    // verb is a cheaper answer than a guard with an exception in it.
    en: "That's a lot of messages very quickly, so I'll pause briefly and carry on shortly — nothing you sent is lost. If it's urgent, reach us at https://visionex.app/contact",
  },
  /** Said when no provider could answer, so the sender is never left silent. */
  noticeAiFailure: {
    ar: "تعذّر عليّ الرد الآن. تم تسجيل رسالتك وسيتابعها فريق Visionex. يمكنك أيضاً مراسلتنا عبر https://visionex.app/contact",
    en: "I couldn't answer just now. Your message has been logged and the Visionex team will follow up. You can also reach us at https://visionex.app/contact",
  },
  /** Carries `{kind}`, the kind of message. A translation must keep it. */
  noticeUnsupportedType: {
    ar: "لا أستطيع قراءة هذا النوع من الرسائل ({kind}) بعد. لو سمحت اكتب طلبك كنص وسأساعدك مباشرة.",
    en: "I can't read that kind of message ({kind}) yet. Please describe it in text and I'll help right away.",
  },

  noticeVideoTooLong: {
    ar: "الفيديو أطول مما أستطيع مشاهدته. أرسل مقطعاً قصيراً أو لقطة شاشة، أو صف المشكلة نصاً.",
    en: "That video is longer than I can watch. Send a short clip or a screenshot, or describe the problem in text.",
  },
  noticeUnreadableImage: {
    ar: "لم أتمكن من قراءة الصورة بوضوح كافٍ للإجابة. جرّب صورة أوضح، أو اكتب لي ما تريد معرفته.",
    en: "I couldn't read that image clearly enough to answer. Try a sharper photo, or tell me what you'd like to know.",
  },
  noticeUnreadableDocument: {
    ar: "لم أتمكن من قراءة هذا الملف. جرّب PDF أو ملفاً نصياً، أو اكتب لي المحتوى.",
    en: "I couldn't read that file. A PDF or a text file works best, or you can type the details.",
  },
  noticeUnreadableVideo: {
    ar: "لم أتمكن من فهم الفيديو. جرّب لقطة شاشة أو صف المشكلة نصاً.",
    en: "I couldn't make out what's in that video. A screenshot or a written description works better.",
  },
  noticeNoReaderDocument: {
    ar: "لا أستطيع قراءة ملفات PDF حالياً. أرسل لقطة شاشة للصفحة المهمة، أو انسخ النص في رسالة وسأساعدك.",
    en: "I can't read PDF files at the moment. Send a screenshot of the page that matters, or paste the text into a message, and I'll help.",
  },
  noticeNoReaderVideo: {
    ar: "لا أستطيع مشاهدة مقاطع الفيديو حالياً. أرسل لقطة شاشة للحظة المهمة، أو صف ما يحدث نصاً وسأساعدك.",
    en: "I can't watch videos at the moment. Send a screenshot of the moment that matters, or describe what happens, and I'll help.",
  },
  noticeUnsupportedDocument: {
    ar: "لا أستطيع فتح هذه الصيغة. أستطيع قراءة PDF وWord وPowerPoint والملفات النصية — أرسله بإحداها، أو انسخ النص في رسالة.",
    en: "I can't open that format. I can read PDF, Word, PowerPoint and text files — send it as one of those, or paste the text into a message.",
  },
  noticeScannedPdf: {
    ar: "هذا الملف يبدو صوراً ممسوحة ضوئياً بدون نص يمكن استخراجه. صوّر الصفحة المهمة وأرسلها كصورة وسأقرأها لك.",
    en: "That PDF looks like scanned images with no text layer. Photograph the page that matters and send it as a picture — I read those well.",
  },
  noticeEmptyDocument: {
    ar: "الملف وصل لكنه فارغ — لا يوجد نص لأقرأه. تأكد من إرسال الملف الصحيح.",
    en: "The file arrived but it's empty — there's no text in it to read. Check you sent the file you meant to.",
  },
  noticeEncryptedDocument: {
    ar: "هذا الملف محمي بكلمة مرور فلا أستطيع فتحه. احفظ نسخة بدون حماية وأرسلها، أو انسخ النص المهم في رسالة.",
    en: "That file is password-protected, so I can't open it. Save an unprotected copy and send that, or paste the part that matters into a message.",
  },

  // The five ways an attachment fails before anything reads it. The English
  // originals named the kind — "I can't read that image format" — and the
  // Arabic did not, because inserting an English word into an Arabic sentence
  // reads badly and a screen reader announces the language switch. The
  // eighteen new ones follow the Arabic.
  mediaNotFound: {
    ar: "تعذّر فتح المرفق، ربما انتهت صلاحيته. أعد إرساله من فضلك.",
    en: "I couldn't open that attachment — it may have expired. Please send it again.",
  },
  mediaBlockedHost: {
    ar: "تعذّر فتح المرفق بأمان. صف لي المحتوى نصاً وسأساعدك.",
    en: "I couldn't open that attachment safely. Please describe it in text and I'll help.",
  },
  mediaUnsupportedType: {
    ar: "لا أستطيع قراءة هذه الصيغة. جرّب صيغة شائعة أو صف المحتوى نصاً.",
    en: "I can't read that format. Try a common one, or describe it in text.",
  },
  mediaTooLarge: {
    ar: "حجم الملف كبير جداً للمعالجة. أرسل ملفاً أصغر من فضلك.",
    en: "That file is too large for me to process. Please send a smaller one.",
  },
  mediaDownloadFailed: {
    ar: "تعذّر تنزيل المرفق. حاول إرساله مرة أخرى.",
    en: "I couldn't download that attachment. Please try sending it again.",
  },

  voiceTooLong: {
    ar: "الرسالة الصوتية أطول مما أستطيع معالجته. أرسل واحدة أقصر أو اكتب سؤالك.",
    en: "That voice note is longer than I can process. Please send a shorter one, or type your question.",
  },
  voiceEmpty: {
    ar: "لم أسمع شيئاً في الرسالة الصوتية. جرّب في مكان أهدأ أو اكتب سؤالك.",
    en: "I couldn't hear anything in that voice note. Please try again somewhere quieter, or type your question.",
  },
  voiceNoProvider: {
    ar: "لا أستطيع الاستماع للرسائل الصوتية حالياً. اكتب سؤالك وسأساعدك.",
    en: "I can't listen to voice notes right now. Please type your question and I'll help.",
  },
  voiceUnclear: {
    ar: "لم أفهم الرسالة الصوتية. حاول مرة أخرى أو اكتب سؤالك.",
    en: "I couldn't understand that voice note. Please try again, or type your question.",
  },

  officeEmptyDeck: {
    ar: "فتحت العرض التقديمي لكن لا يوجد نص فيه — يبدو أنه صور فقط. أرسل صورة الشريحة المهمة وسأصفها لك.",
    en: "I opened the deck but there's no text in it — it looks like images only. Send a photo of the slide you need and I'll describe it.",
  },
  officeEmptyDocument: {
    ar: "فتحت الملف لكن لا يوجد نص فيه — قد يكون صوراً أو جدول أرقام. أرسل صورة الصفحة المهمة وسأقرأها.",
    en: "I opened the file but there's no text in it — it may be images, or a table of figures. Send a photo of the page you need and I'll read it.",
  },
  officeCorrupt: {
    ar: "لم أتمكن من فتح هذا الملف — يبدو أنه تالف أو غير مكتمل. جرّب إرساله بصيغة PDF.",
    en: "I couldn't open that file — it looks damaged or incomplete. Try sending it as a PDF instead.",
  },

  // ── The weather, in words ────────────────────────────────────────────────
  //
  // Open-Meteo reports a WMO code, which is a number, and turning it into words
  // here rather than asking a model to costs nothing and cannot hallucinate
  // light snow in Riyadh. These were the last sentences in the assistant that
  // existed only in Arabic and English: the *refusals* were widened first
  // because an English refusal leaves somebody stuck, but an English forecast
  // read out by a screen reader in the middle of a Turkish conversation is the
  // same failure with better manners.
  //
  // Day names and units are **not** here. `Intl` already knows them in all
  // twenty, and a hand-maintained table of month names is twenty chances to be
  // wrong about a calendar.

  wxClear: { ar: "صحو", en: "clear sky" },
  wxMainlyClear: { ar: "صحو غالباً", en: "mainly clear" },
  wxPartlyCloudy: { ar: "غائم جزئياً", en: "partly cloudy" },
  wxOvercast: { ar: "غائم", en: "overcast" },
  wxFog: { ar: "ضباب", en: "fog" },
  wxFreezingFog: { ar: "ضباب متجمد", en: "freezing fog" },
  wxLightDrizzle: { ar: "رذاذ خفيف", en: "light drizzle" },
  wxDrizzle: { ar: "رذاذ", en: "drizzle" },
  wxHeavyDrizzle: { ar: "رذاذ كثيف", en: "heavy drizzle" },
  wxFreezingDrizzle: { ar: "رذاذ متجمد", en: "freezing drizzle" },
  wxHeavyFreezingDrizzle: { ar: "رذاذ متجمد كثيف", en: "heavy freezing drizzle" },
  wxLightRain: { ar: "مطر خفيف", en: "light rain" },
  wxRain: { ar: "مطر", en: "rain" },
  wxHeavyRain: { ar: "مطر غزير", en: "heavy rain" },
  wxFreezingRain: { ar: "مطر متجمد", en: "freezing rain" },
  wxHeavyFreezingRain: { ar: "مطر متجمد غزير", en: "heavy freezing rain" },
  wxLightSnow: { ar: "ثلج خفيف", en: "light snow" },
  wxSnow: { ar: "ثلج", en: "snow" },
  wxHeavySnow: { ar: "ثلج كثيف", en: "heavy snow" },
  wxSnowGrains: { ar: "حبيبات ثلجية", en: "snow grains" },
  wxLightShowers: { ar: "زخات خفيفة", en: "light showers" },
  wxShowers: { ar: "زخات مطر", en: "showers" },
  wxViolentShowers: { ar: "زخات مطر عنيفة", en: "violent showers" },
  wxLightSnowShowers: { ar: "زخات ثلج خفيفة", en: "light snow showers" },
  wxHeavySnowShowers: { ar: "زخات ثلج كثيفة", en: "heavy snow showers" },
  wxThunderstorm: { ar: "عاصفة رعدية", en: "thunderstorm" },
  wxThunderstormHail: { ar: "عاصفة رعدية مع برد", en: "thunderstorm with hail" },
  wxThunderstormHeavyHail: { ar: "عاصفة رعدية مع برد شديد", en: "thunderstorm with heavy hail" },
  /** A code the table does not have. Described as unknown, never guessed. */
  wxUnknown: { ar: "حالة غير معروفة", en: "conditions unavailable" },

  /** Carries `{place}`. */
  weatherHeading: { ar: "*الطقس في {place}*", en: "*Weather in {place}*" },
  /** Carries `{condition}` and `{temp}`. The whole answer, on one line. */
  weatherNow: { ar: "{condition}، {temp}", en: "{condition}, {temp}" },
  /** Carries `{feels}`, `{humidity}` and `{wind}`. */
  weatherDetail: {
    ar: "الإحساس الفعلي {feels} · الرطوبة {humidity}% · الرياح {wind}",
    en: "Feels like {feels} · humidity {humidity}% · wind {wind}",
  },
  weatherDaysAhead: { ar: "*الأيام القادمة*", en: "*The days ahead*" },
  /** Carries `{day}`, `{condition}`, `{min}`, `{max}` and `{rain}`. */
  weatherDayLine: {
    ar: "{day}: {condition}، من {min} إلى {max}{rain}",
    en: "{day}: {condition}, {min} to {max}{rain}",
  },
  /** Carries `{chance}`. Written as a suffix, leading separator included. */
  weatherRain: { ar: " · احتمال مطر {chance}%", en: " · {chance}% chance of rain" },
  weatherNeedsPlace: {
    ar: "أخبرني عن أي مدينة تسأل — مثلاً «الطقس في عمّان» — أو شارك موقعك من زر 📎 ← الموقع وسأخبرك بطقس مكانك.",
    en: "Tell me which city you mean — for example \"weather in Amman\" — or share your location from 📎 → Location and I'll use where you are.",
  },
  /** Carries `{place}`, the name the sender used. */
  weatherPlaceNotFound: {
    ar: "لم أجد مكاناً باسم «{place}». جرّب اسم المدينة الأكبر القريبة، أو شارك موقعك من زر 📎 ← الموقع.",
    en: "I couldn't find anywhere called \"{place}\". Try the nearest larger city, or share your location from 📎 → Location.",
  },
  weatherUnavailable: {
    ar: "خدمة الطقس لا تستجيب حالياً. جرّب بعد قليل وسأحضر لك التفاصيل.",
    en: "The weather service isn't responding right now. Try again shortly and I'll fetch it for you.",
  },
  /** Used as a place name when the reverse lookup found nothing to call it. */
  weatherHere: { ar: "موقعك", en: "your location" },

  // ── Where you are, and what is around you ────────────────────────────────
  //
  // The eight compass points and the seventeen categories are the part of this
  // feature that gets *heard* rather than read: a distance on its own is true
  // of every point on a circle, and "pharmacy" is the word somebody is standing
  // on a pavement waiting for. Distances themselves are not here — `Intl`
  // formats metres and kilometres in all twenty.

  compassNorth: { ar: "شمالاً", en: "north" },
  compassNorthEast: { ar: "شمال شرق", en: "north-east" },
  compassEast: { ar: "شرقاً", en: "east" },
  compassSouthEast: { ar: "جنوب شرق", en: "south-east" },
  compassSouth: { ar: "جنوباً", en: "south" },
  compassSouthWest: { ar: "جنوب غرب", en: "south-west" },
  compassWest: { ar: "غرباً", en: "west" },
  compassNorthWest: { ar: "شمال غرب", en: "north-west" },

  catPharmacy: { ar: "صيدلية", en: "pharmacy" },
  catHospital: { ar: "مستشفى", en: "hospital" },
  catClinic: { ar: "عيادة", en: "clinic" },
  catSupermarket: { ar: "سوبرماركت", en: "supermarket" },
  catBakery: { ar: "مخبز", en: "bakery" },
  catRestaurant: { ar: "مطعم", en: "restaurant" },
  catCafe: { ar: "مقهى", en: "café" },
  catBank: { ar: "بنك", en: "bank" },
  catAtm: { ar: "صراف آلي", en: "ATM" },
  catBusStop: { ar: "موقف حافلات", en: "bus stop" },
  catStation: { ar: "محطة", en: "station" },
  catWorship: { ar: "مسجد أو دار عبادة", en: "place of worship" },
  catFuel: { ar: "محطة وقود", en: "petrol station" },
  catPolice: { ar: "مركز شرطة", en: "police station" },
  catPostOffice: { ar: "مكتب بريد", en: "post office" },
  catSchool: { ar: "مدرسة", en: "school" },
  catConvenience: { ar: "بقالة", en: "corner shop" },

  whereHeading: { ar: "*أنت هنا*", en: "*You are here*" },
  whereUnknown: {
    ar: "لم أتعرّف على اسم المكان، لكن الإحداثيات وصلت.",
    en: "I couldn't name the place, but the coordinates came through.",
  },
  nearbyHeading: { ar: "*حولك*", en: "*Around you*" },
  nearbyNone: {
    ar: "لم أجد أماكن معروفة على الخريطة قريبة منك. الخرائط المفتوحة أحياناً ناقصة في بعض المناطق.",
    en: "I couldn't find anything mapped near you. Open map data is patchy in some areas.",
  },
  /** Carries `{name}`, `{category}`, `{distance}` and `{direction}`. */
  nearbyLine: {
    ar: "• {name} ({category}) — {distance} {direction}",
    en: "• {name} ({category}) — {distance} {direction}",
  },
  nearbyStraightLine: {
    ar: "المسافات بالخط المستقيم، وليست مسار مشي.",
    en: "Distances are straight-line, not walking routes.",
  },
  locationNeeded: {
    ar: "شارك موقعك أولاً: اضغط 📎 ثم «الموقع» ثم «إرسال موقعي الحالي». سأخبرك بمكانك وما حولك وطقس المنطقة.",
    en: "Share your location first: tap 📎 → Location → Send your current location. I'll tell you where you are, what's around you, and the weather there.",
  },
  geocodeUnavailable: {
    ar: "وصلني موقعك لكن خدمة الخرائط لا تستجيب الآن. جرّب بعد قليل.",
    en: "Your location arrived, but the map service isn't responding right now. Try again shortly.",
  },
  nearbyHint: {
    ar: "قل «حولي» لأخبرك بأقرب الأماكن، أو «الطقس» لطقس هذا المكان.",
    en: "Say \"near me\" for what's around you, or \"weather\" for the forecast here.",
  },
  /** Carries `{name}`. The line that arrives just before the pin. */
  placeFound: { ar: "📍 *{name}*", en: "📍 *{name}*" },
  /** Carries `{distance}` and `{direction}`. Sent only when a pin is on file. */
  placeAway: {
    ar: "على بُعد {distance} تقريباً {direction} منك.",
    en: "About {distance} {direction} of you.",
  },
  /** Carries `{query}` — what they asked for, quoted back so they can correct it. */
  placeNotFound: {
    ar: "لم أجد مكاناً باسم «{query}». جرّب الاسم مع المدينة، مثل «بنك الأردن عمّان».",
    en: "I couldn't find a place called \"{query}\". Try the name with the city, like \"Arab Bank Amman\".",
  },

  // ── The bazaar ───────────────────────────────────────────────────────────
  //
  // Counted nouns are kept out of every sentence here on purpose. "3 listings"
  // needs one plural form in English, two in Arabic and four in Russian, and a
  // template that pretends otherwise reads as broken grammar to a native
  // speaker. `bazaarBrowseCount` says "listed right now:" and then the number,
  // which is correct in all twenty and reads perfectly well aloud.

  bazaarResultsHeading: { ar: "*في سوق Visionex*", en: "*In the Visionex bazaar*" },
  /** Carries `{name}`, `{price}`, `{shop}` and `{stock}`. */
  bazaarListingLine: { ar: "• *{name}* — {price}{shop}{stock}", en: "• *{name}* — {price}{shop}{stock}" },
  /** Carries `{shop}`. A suffix, its separator included. */
  bazaarFromShop: { ar: " — من {shop}", en: " — from {shop}" },
  bazaarOutOfStock: { ar: " (غير متوفر حالياً)", en: " (out of stock)" },
  /** Carries `{url}`. */
  bazaarBuyLink: { ar: "للشراء أو لرؤية الصور: {url}", en: "To buy or see photos: {url}" },
  /** Carries `{terms}`. */
  bazaarSearchedFor: { ar: "بحثت عن: {terms}", en: "Searched for: {terms}" },
  /** Carries `{terms}`, the words the sender used. */
  bazaarNoMatch: {
    ar: "لم أجد أي منتج مطابق لـ«{terms}» في سوق Visionex حالياً.",
    en: "Nothing in the Visionex bazaar matches \"{terms}\" right now.",
  },
  bazaarNoMatchAny: {
    ar: "لم أجد أي منتج مطابق في سوق Visionex حالياً.",
    en: "Nothing in the Visionex bazaar matches that right now.",
  },
  /** Carries `{url}`. */
  bazaarBrowseAll: { ar: "تصفّح كل المعروض هنا: {url}", en: "Browse everything listed here: {url}" },
  bazaarTryAnother: {
    ar: "أو اكتب اسماً آخر للمنتج وسأبحث مرة ثانية.",
    en: "Or give me another name for it and I'll search again.",
  },
  bazaarBrowseHeading: { ar: "*سوق Visionex*", en: "*The Visionex bazaar*" },
  /** Carries `{count}`. Never inside a counted noun — see the note above. */
  bazaarBrowseCount: { ar: "المعروض الآن: {count}", en: "Listed right now: {count}" },
  bazaarBrowseEmpty: {
    ar: "لا توجد منتجات معروضة في الوقت الحالي.",
    en: "Nothing is listed at the moment.",
  },
  /** Carries `{url}`. */
  bazaarBrowseLink: { ar: "تصفّح: {url}", en: "Browse: {url}" },
  bazaarBrowseAsk: {
    ar: "أو اسألني عن منتج معيّن — مثلاً «عندكم عسل؟» — وسأبحث لك.",
    en: "Or ask me about something specific — \"do you have honey?\" — and I'll search.",
  },
  /** Carries `{url}`. */
  bazaarUnavailable: {
    ar: "تعذّر الوصول إلى السوق الآن. جرّب بعد قليل، أو تصفّح مباشرة: {url}",
    en: "I couldn't reach the bazaar just now. Try again shortly, or browse directly: {url}",
  },

  sellHeading: { ar: "🏪 *تبيع في سوق Visionex*", en: "🏪 *Selling in the Visionex bazaar*" },
  sellStep1: {
    ar: "١. سجّل الدخول إلى حسابك على visionex.app",
    en: "1. Sign in to your account on visionex.app",
  },
  /** Carries `{url}`. */
  sellStep2: { ar: "٢. افتح السوق: {url}", en: "2. Open the bazaar: {url}" },
  /**
   * "set its tier", not "pick its tier", and «حدّد» rather than «اختر».
   *
   * Moving this sentence into the interface's vocabulary put it under the guard
   * that bans keypad words in every one of the twenty languages. The guard is
   * blunt — it cannot tell "choose a shop tier on the website" from "choose an
   * option from this menu" — and the right answer to a blunt guard protecting
   * something real is different words, not an exception.
   */
  sellStep3: {
    ar: "٣. أنشئ متجرك وحدّد مستواه، ثم أضف منتجاتك بالاسم والسعر والصورة.",
    en: "3. Create your shop, set its tier, then add products with a name, a price and a photo.",
  },
  sellNote: {
    ar: "المتجر مربوط بحسابك على الموقع، فلا أستطيع إنشاءه من هنا — لكن اسألني عن أي خطوة وسأشرحها لك بالتفصيل.",
    en: "A shop belongs to your website account, so I can't create one from here — but ask me about any step and I'll walk you through it.",
  },

  // ── The camera, and what it is armed for ─────────────────────────────────

  modeDescribe: { ar: "وصف الصورة", en: "Describe" },
  modeReadText: { ar: "قراءة النص", en: "Read text" },
  modeFindObject: { ar: "البحث عن غرض", en: "Find object" },
  modeProduct: { ar: "تعريف منتج", en: "Product" },
  modeTranslate: { ar: "الترجمة", en: "Translate" },

  /** Carries `{target}`, the thing the sender asked to find. */
  awaitFindTarget: { ar: "أرسل الصورة وسأبحث عن {target}.", en: "Send the photo and I'll look for {target}." },
  awaitFind: {
    ar: "عن أي غرض أبحث؟ قل لي ثم أرسل الصورة.",
    en: "What should I look for? Tell me, then send the photo.",
  },
  awaitRead: { ar: "أرسل الصورة وسأقرأ ما فيها.", en: "Send the photo and I'll read it." },
  awaitProduct: { ar: "أرسل صورة المنتج أو الباركود.", en: "Send a photo of the product or its barcode." },
  awaitTranslate: {
    ar: "أرسل الصورة أو النص الذي تريد ترجمته.",
    en: "Send the photo, or the text you want translated.",
  },
  awaitDescribe: { ar: "أرسل الصورة وسأصفها لك.", en: "Send the photo and I'll describe it." },

  /** Carries `{values}`, the decoded payload, already quoted line by line. */
  qrContains: {
    ar: "الرمز المقروء في الصورة يحتوي على:\n{values}",
    en: "The code in the image contains:\n{values}",
  },

  // ── How replies arrive, and what a preference change confirms ────────────

  /** Carries `{language}`, the language's own name. */
  prefLanguage: { ar: "سأتابع بـ{language}.", en: "I'll continue in {language}." },
  prefVoiceAlways: { ar: "سأرسل الردود صوتياً أيضاً.", en: "I'll send replies as voice notes too." },
  prefVoiceNever: { ar: "سأرد نصاً فقط.", en: "I'll reply with text only." },
  prefVoiceMirror: {
    ar: "سأرد بنفس طريقتك: صوت على الصوت، وكتابة على الكتابة.",
    en: "I'll answer the way you write: voice for voice, text for text.",
  },
  prefConcise: { ar: "وسأختصر.", en: "And I'll keep it brief." },
  prefDetailed: { ar: "وسأشرح بتفصيل أكثر.", en: "And I'll go into more detail." },

  voiceHeading: { ar: "*الردود الصوتية*", en: "*Voice replies*" },
  voiceBody: {
    ar: "أرد بنفس طريقتك: رسالة صوتية يقابلها رد صوتي، ورسالة مكتوبة يقابلها رد مكتوب.",
    en: "I answer the way you ask: a voice note gets a voice note back, and a typed message gets text.",
  },
  voiceNote: {
    ar: "لا يوجد إعداد تضبطه — الطريقة التي ترسل بها هي الطريقة التي أرد بها.",
    en: "There's nothing to set — how you send is how I answer.",
  },

  // ── Choosing one of your own cloned voices ────────────────────────────
  //
  // The list is the sender's own voices and nothing else. No provider id and
  // no profile id reaches these strings: `{name}` is the name the person gave
  // their voice in the studio, which is the only identifier they ever see.
  // ── Something to listen to ────────────────────────────────────────────
  //
  // Stations, never a stream: `stream_url` is hidden on purpose and playing
  // happens on the Visionex page, where the token flow is.
  radioHeading: { ar: "*محطات يمكنك الاستماع إليها*", en: "*Stations you can listen to*" },
  radioHint: { ar: "افتح هذا لتشغيل أي منها: {url}", en: "Open this to play any of them: {url}" },
  radioNone: {
    ar: "لم أجد محطة بهذا الوصف. جرّب نوعًا موسيقيًا أو بلدًا، أو شاهدها كلها: {url}",
    en: "I couldn't find a station like that. Try a genre or a country, or see them all: {url}",
  },
  radioUnavailable: {
    ar: "لم أستطع قراءة قائمة المحطات الآن. حاول بعد قليل، أو شاهدها كلها: {url}",
    en: "I couldn't reach the station list just now. Try again shortly, or see them all: {url}",
  },
  // ── When the bazaar has nothing, the catalogue might ──────────────────
  //
  // A code (VX-…) is the only identifier a customer sees: it names nothing
  // about where the offer came from. Supplier and margin stay in
  // `sourcing_results`, admin-read only, on every channel.
  sourcingHeading: { ar: "*وأيضًا في كتالوج Visionex*", en: "*Also in the Visionex catalogue*" },
  sourcingHint: {
    ar: "أرسل لي رمز المنتج الذي تريده وأكمل معك.",
    en: "Tell me the code of the one you want and I'll take it from there.",
  },
  sourcingNone: {
    ar: "لم أجد هذا في السوق ولا في الكتالوج. جرّب كلمات أخرى، أو انظر هنا: {url}",
    en: "I couldn't find that in the bazaar or the catalogue. Try different words, or look here: {url}",
  },
  sourcingUnavailable: {
    ar: "لم أستطع الوصول إلى الكتالوج الآن. حاول بعد قليل، أو انظر هنا: {url}",
    en: "I couldn't reach the catalogue just now. Try again shortly, or look here: {url}",
  },
  condNew: { ar: "جديد", en: "New" },
  condUsed: { ar: "مستعمل", en: "Used" },
  condRefurbished: { ar: "مجدّد", en: "Refurbished" },
  voiceMyVoicesHeading: { ar: "*أصواتي*", en: "*My voices*" },
  voiceMyVoicesBody: { ar: "بأي صوت أرد عليك؟", en: "Which voice should I answer in?" },
  voiceDefaultRow: { ar: "الصوت الافتراضي", en: "Default voice" },
  voiceDefaultRowDesc: { ar: "صوت Visionex المعتاد", en: "The standard Visionex voice" },
  voiceNoneNotice: {
    ar: "لا يوجد لديك صوت جاهز بعد. أنشئ واحدًا من استوديو الصوت على الموقع، وامنح الموافقة، ثم فعّله للواتساب.",
    en: "You don't have a voice ready yet. Create one in Voice Studio on the website, give your consent, then switch it on for WhatsApp.",
  },
  voiceSetTo: {
    ar: "سأرد بهذا الصوت من الآن: {name}",
    en: "I'll answer in this voice from now on: {name}",
  },
  voiceSetToDefault: {
    ar: "سأرد بالصوت الافتراضي من الآن.",
    en: "I'll answer in the default voice from now on.",
  },
  voiceGone: {
    ar: "هذا الصوت لم يعد متاحًا. سأستخدم الصوت الافتراضي.",
    en: "That voice isn't available any more. I'll use the default voice.",
  },
  voiceNeedsAccount: {
    ar: "اربط حسابك في Visionex أولًا، وستظهر أصواتك هنا.",
    en: "Link your Visionex account first, and your own voices will appear here.",
  },

  // ── News ─────────────────────────────────────────────────────────────────
  //
  // The interface around the headlines. The headlines themselves come from
  // `news_articles.translations`, which is content written by the news
  // pipeline: an article exists in the languages it was translated into, and
  // the base columns are what is left. These seven sentences exist in twenty.

  newsHeading: { ar: "*آخر الأخبار*", en: "*Latest news*" },
  /** The list's button label. Meta rejects a longer one outright: 20 characters. */
  newsButton: { ar: "الأخبار", en: "News" },
  newsEmpty: {
    ar: "لا توجد أخبار منشورة الآن. جرّب لاحقاً، أو تصفّح القسم: {url}",
    en: "There's no news published right now. Try again later, or browse the section: {url}",
  },
  newsUnavailable: {
    ar: "تعذّر الوصول إلى الأخبار الآن. جرّب بعد قليل، أو اقرأها مباشرة: {url}",
    en: "I couldn't reach the news just now. Try again shortly, or read it directly: {url}",
  },
  newsStale: {
    ar: "هذا الخبر لم يعد في القائمة. هذه آخر الأخبار من جديد:",
    en: "That item isn't in the list any more. Here's the latest again:",
  },
  /** Carries `{url}`, the canonical news page. There is no per-article URL. */
  newsLink: { ar: "اقرأ البقية: {url}", en: "Read the rest: {url}" },
  /**
   * The way back, named as a thing to tap rather than a word to type.
   *
   * It said «اكتب الأخبار» / "say news" first, and that sentence was only true
   * in two languages: the phrase parsers read Arabic and English, so a Turkish
   * sender typing "haberler" would have reached nothing. The menu row is
   * translated into all twenty and is a tap, so it is the instruction that is
   * true for everybody who reads it.
   */
  newsBackHint: {
    ar: "افتح «الأخبار» من القائمة لترى آخر الأخبار من جديد.",
    en: "Open News from the menu to see the list again.",
  },

  // ── A song, asked for by name ─────────────────────────────────────────────
  //
  // Two of these say what Visionex may and may not send, and they are not
  // small print: a thirty-second clip arriving where a whole song was expected
  // is confusing, and for somebody listening rather than looking it is the
  // difference between "it stopped" and "that is all there is". So the reason
  // is said in the same message as the audio, in the sender's own language.
  songHeading: { ar: "*الأغاني*", en: "*Songs*" },
  /** A list button. Twenty characters, or Meta rejects the message. */
  songButton: { ar: "الأغاني", en: "Songs" },
  songWhich: {
    ar: "أي أغنية تريد؟ اكتب: أغنية، ثم الاسم.",
    en: "Which song? Send: song, then its name.",
  },
  songNone: {
    ar: "ما وجدت أغنية بهذا الاسم. أضف اسم الفنان وجرّب مرة أخرى.",
    en: "I couldn't find that song. Add the artist's name and try again.",
  },
  songUnavailable: {
    ar: "تعذّر البحث عن الأغاني الآن. جرّب بعد قليل.",
    en: "I couldn't search for songs just now. Try again shortly.",
  },
  /**
   * The list's body text.
   *
   * "Tap", never "choose": the numeric interface's vocabulary was retired for a
   * reason, and a sender who cannot see the rows is told what a thing does, not
   * instructed to operate a keypad. The suite bans the older word in all twenty
   * languages, which is how this sentence was caught before it shipped.
   */
  songChoose: { ar: "اضغط على أغنية وأرسلها لك.", en: "Tap a song and I'll send it." },
  songPreviewNote: {
    ar: "هذا المقطع الرسمي، ثلاثون ثانية. لا نملك حق إرسال التسجيل كاملاً.",
    en: "This is the official thirty-second preview. We don't have the right to send the whole recording.",
  },
  /** Carries `{url}`, the shop where the whole track plays. */
  songFullLink: { ar: "اسمعها كاملة: {url}", en: "Listen in full: {url}" },
  songFreeNote: {
    ar: "هذه نسخة كاملة بترخيص حر — أداء آخر، وليس التسجيل التجاري.",
    en: "This is a complete, freely licensed recording — another performance, not the commercial one.",
  },
  /** Carries `{url}`, the page that names the licence and whoever recorded it. */
  songFreeLicence: { ar: "المصدر والترخيص: {url}", en: "Source and licence: {url}" },
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
