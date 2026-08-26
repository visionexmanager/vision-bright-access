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
