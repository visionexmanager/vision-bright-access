// The numbered menu: ten things, each reachable three ways.
//
// WhatsApp has no settings screen and no toolbar, so everything this assistant
// can do has to be *said* to be discoverable. A written menu already existed
// and it worked — if you could read it, remember the trigger word, and type it
// back. This adds the two cheaper ways in:
//
//   1. tap a row in an interactive list;
//   2. or just send the number.
//
// The number is the one that matters here. Tapping a list means opening a modal
// and navigating it with a screen reader; typing "3" is one keystroke, works on
// every handset, survives a bad connection, and — the point — can be *spoken*
// into a voice note. All three land on the same place: the phrase the sender
// would have said anyway, handed to the parsers that already exist. A menu row
// is not a second implementation of the weather, it is a shortcut to the words.
//
// Pure and provider-free: no `Deno`, no fetch. The Vitest suite pins every row
// against the real parsers, which is what stops a row from quietly becoming a
// button that does nothing.

export type MenuAction =
  | "weather"
  | "where_am_i"
  | "nearby"
  | "read_text"
  | "describe"
  | "find_object"
  | "translate"
  | "bazaar"
  | "voice"
  | "human";

export interface MenuItem {
  action: MenuAction;
  /** What the sender types or hears. Stable: people memorise these. */
  number: number;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /**
   * The words this row stands in for.
   *
   * Fed straight to the existing parsers instead of dispatching on the action,
   * so a row can never drift away from what the same request typed by hand
   * would do. The suite asserts each of these against the real parser.
   */
  phraseAr: string;
  phraseEn: string;
  /** Which section it appears under in the interactive list. */
  section: "around" | "camera" | "more";
}

/**
 * How long a bare number is read as a menu choice.
 *
 * Outside this window "3" is just the number three — an answer to a question,
 * a quantity, a house number — and reading it as a menu tap would hijack an
 * ordinary sentence. A tapped row carries its own id and is honoured whenever
 * it arrives, because tapping is unambiguous in a way that typing is not.
 */
export const MENU_SELECTION_TTL_MS = 15 * 60 * 1000;

/** Prefix on every row id, so a tapped row is recognisable at a glance. */
export const MENU_ROW_PREFIX = "menu_";

export const MENU_ITEMS: readonly MenuItem[] = [
  {
    action: "weather",
    number: 1,
    titleAr: "1 الطقس",
    titleEn: "1 Weather",
    descriptionAr: "طقس مكانك أو أي مدينة",
    descriptionEn: "Where you are, or any city",
    phraseAr: "الطقس",
    phraseEn: "weather",
    section: "around",
  },
  {
    action: "where_am_i",
    number: 2,
    titleAr: "2 موقعي",
    titleEn: "2 My location",
    descriptionAr: "أين أنا الآن",
    descriptionEn: "Where am I right now",
    phraseAr: "وين أنا",
    phraseEn: "where am I",
    section: "around",
  },
  {
    action: "nearby",
    number: 3,
    titleAr: "3 حولي",
    titleEn: "3 Near me",
    descriptionAr: "أقرب صيدلية أو مطعم أو موقف",
    descriptionEn: "Closest pharmacy, café or stop",
    phraseAr: "شو حولي",
    phraseEn: "what is near me",
    section: "around",
  },
  {
    action: "read_text",
    number: 4,
    titleAr: "4 اقرأ لي",
    titleEn: "4 Read text",
    descriptionAr: "أقرأ نص صورة أو ورقة",
    descriptionEn: "Text from a photo or a page",
    phraseAr: "اقرأ",
    phraseEn: "read this",
    section: "camera",
  },
  {
    action: "describe",
    number: 5,
    titleAr: "5 صف لي",
    titleEn: "5 Describe",
    descriptionAr: "أصف ما في الصورة",
    descriptionEn: "What is in the picture",
    phraseAr: "صف لي",
    phraseEn: "describe this",
    section: "camera",
  },
  {
    action: "find_object",
    number: 6,
    titleAr: "6 وين غرضي",
    titleEn: "6 Find a thing",
    descriptionAr: "أدلّك على غرض داخل الصورة",
    descriptionEn: "Locate something in the photo",
    phraseAr: "وين غرضي",
    phraseEn: "find my keys",
    section: "camera",
  },
  {
    action: "translate",
    number: 7,
    titleAr: "7 ترجم",
    titleEn: "7 Translate",
    descriptionAr: "صورة أو نص ترسله",
    descriptionEn: "A photo, or text you send",
    phraseAr: "ترجم",
    phraseEn: "translate",
    section: "camera",
  },
  {
    action: "bazaar",
    number: 8,
    titleAr: "8 طلب منتج",
    titleEn: "8 Find a product",
    descriptionAr: "أبحث لك في سوق Visionex",
    descriptionEn: "Search the Visionex bazaar",
    phraseAr: "السوق",
    phraseEn: "the bazaar",
    section: "more",
  },
  {
    action: "voice",
    number: 9,
    titleAr: "9 الردود الصوتية",
    titleEn: "9 Voice replies",
    descriptionAr: "صوت، كتابة، أو مثل ما ترسل",
    descriptionEn: "Voice, text, or match me",
    // Answered on the spot rather than routed: this row explains the three
    // settings and says which one is on. Changing it silently from a menu tap
    // would be the same mistake the preference parser exists to avoid.
    phraseAr: "",
    phraseEn: "",
    section: "more",
  },
  {
    action: "human",
    number: 10,
    titleAr: "10 موظف بشري",
    titleEn: "10 A person",
    descriptionAr: "أحوّلك لشخص من الفريق",
    descriptionEn: "Hand you to the team",
    phraseAr: "بدي أحكي مع موظف",
    phraseEn: "I want to speak to a person",
    section: "more",
  },
];

/** The Meta ceiling: ten rows across all sections of one list. */
export const MAX_LIST_ROWS = 10;

const SECTION_TITLE_AR: Record<MenuItem["section"], string> = {
  around: "حولك",
  camera: "الصورة والنص",
  more: "أخرى",
};

const SECTION_TITLE_EN: Record<MenuItem["section"], string> = {
  around: "Around you",
  camera: "Photos and text",
  more: "More",
};

export const menuItemByNumber = (n: number): MenuItem | null =>
  MENU_ITEMS.find((item) => item.number === n) ?? null;

export const menuItemById = (id: string | null | undefined): MenuItem | null => {
  if (!id || !id.startsWith(MENU_ROW_PREFIX)) return null;
  const action = id.slice(MENU_ROW_PREFIX.length);
  return MENU_ITEMS.find((item) => item.action === action) ?? null;
};

/**
 * Read a number the sender sent on its own.
 *
 * Arabic-Indic digits are accepted because that is what an Arabic keyboard
 * produces — ٣ and 3 are the same key to the person pressing it, and treating
 * only one of them as a choice would make the menu work for half the audience.
 * Anything longer than a number and a stray full stop is a sentence, not a tap.
 */
export function parseMenuNumber(input: string | null | undefined): MenuItem | null {
  const text = (input ?? "").trim();
  if (!text || text.length > 4) return null;

  const western = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const match = western.match(/^([0-9]{1,2})[.)\s]*$/);
  if (!match) return null;

  return menuItemByNumber(Number(match[1]));
}

/**
 * The two things worth doing that have no row.
 *
 * Ten rows is Meta's ceiling, and these two lost the argument for a place:
 * sending a file and opening a shop both start with an action the sender takes
 * anyway — attaching the PDF, or asking about selling — where the ten rows are
 * all things that start with a question. Dropping them from the menu entirely
 * would still be losing them, since a capability nobody announces does not
 * exist here, so they are named in the body text instead, which is also the
 * text that goes out when the tappable list is refused.
 */
const EXTRAS_AR = "وأيضاً: أرسل PDF أو ملفاً نصياً وألخّصه لك، وقل «أبيع» لأشرح كيف تفتح متجرك.";
const EXTRAS_EN = "Also: send a PDF or a text file and I'll summarise it, or say \"sell\" to open a shop.";

/**
 * The menu as text.
 *
 * Sent as the body of the interactive message *and* used on its own when the
 * interactive send fails, so the numbers are never only inside a modal. Each
 * line is short enough to be heard without losing the number that opens it.
 */
export function menuText(language: "ar" | "en"): string {
  const lines = MENU_ITEMS.map((item) =>
    language === "ar" ? `${item.titleAr} — ${item.descriptionAr}` : `${item.titleEn} — ${item.descriptionEn}`
  );
  return language === "ar"
    ? [
      "*القائمة*",
      "",
      ...lines,
      "",
      EXTRAS_AR,
      "",
      "أرسل الرقم فقط — مثلاً «1» للطقس — أو اضغط «اختر» في الرسالة. الرسالة الصوتية تعمل أيضاً.",
    ].join("\n")
    : [
      "*Menu*",
      "",
      ...lines,
      "",
      EXTRAS_EN,
      "",
      "Just send the number — \"1\" for weather — or tap Choose on the message. A voice note works too.",
    ].join("\n");
}

export interface InteractiveList {
  type: "list";
  header: { type: "text"; text: string };
  body: { text: string };
  footer: { text: string };
  action: {
    button: string;
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description: string }>;
    }>;
  };
}

/**
 * The same menu as a tappable list.
 *
 * Meta's limits are hard errors, not warnings — a title over 24 characters or
 * an eleventh row rejects the whole message with a 400, and the sender gets
 * nothing at all. Everything below is inside those limits, and the suite
 * asserts it so a future row cannot silently break the menu for everyone.
 */
export function menuListMessage(language: "ar" | "en"): InteractiveList {
  const ar = language === "ar";
  const sections = (["around", "camera", "more"] as const).map((section) => ({
    title: ar ? SECTION_TITLE_AR[section] : SECTION_TITLE_EN[section],
    rows: MENU_ITEMS.filter((item) => item.section === section).map((item) => ({
      id: `${MENU_ROW_PREFIX}${item.action}`,
      title: ar ? item.titleAr : item.titleEn,
      description: ar ? item.descriptionAr : item.descriptionEn,
    })),
  }));

  return {
    type: "list",
    header: { type: "text", text: ar ? "قائمة Visionex" : "Visionex menu" },
    body: {
      // The two capabilities that have no row of their own are named here as
      // well as in the text version, so somebody who only ever sees the
      // tappable menu still hears that they exist.
      text: ar
        ? `اختر رقماً من القائمة، أو أرسل الرقم كرسالة — مثلاً «1» للطقس.\n\n${EXTRAS_AR}`
        : `Pick a number from the list, or just send the number — "1" for weather.\n\n${EXTRAS_EN}`,
    },
    footer: { text: ar ? "اكتب «قائمة» لعرضها مجدداً" : "Say \"menu\" to see this again" },
    action: {
      button: ar ? "اختر" : "Choose",
      sections,
    },
  };
}

/** The words a chosen row stands in for, in the language being answered in. */
export const menuPhrase = (item: MenuItem, language: "ar" | "en"): string =>
  language === "ar" ? item.phraseAr : item.phraseEn;
