// What Visionex offers on WhatsApp, as data.
//
// One tree, declared once. The navigation engine reads it, the menus render
// from it, and the tests walk it — so adding a feature is an entry in the array
// below plus, if it needs one, a handler in the webhook's handler map. Nothing
// in the engine names a feature, which is the property that lets the next
// developer add, reorder or disable one without touching the engine at all.
//
// Two kinds of node:
//
//   menu   - has children, and its number opens them
//   action - a leaf. Either it carries `phrase`, the words it stands in for,
//            which are handed to the conversational pipeline that already
//            answers them; or it names a `handler` the webhook implements.
//
// The `phrase` mechanism is deliberate and is the reason this engine did not
// need to reimplement anything. "3" and «الطقس» arrive at exactly the same
// code, so a menu row cannot drift away from what typing the request does, and
// a feature that works in conversation works from the menu for free.
//
// Pure and provider-free: no `Deno`, no fetch, no database. Every rule here is
// exercised by the Vitest suite directly.

export type Language = "ar" | "en";

/** Both languages of one string. Every user-visible label carries both. */
export interface Localized {
  ar: string;
  en: string;
}

export const localized = (value: Localized, language: Language): string => value[language];

/**
 * What a feature needs from the environment to be usable.
 *
 * Declared rather than checked inline so a missing key turns into "not
 * available right now" in the sender's language, instead of a feature that
 * accepts a tap and then fails somewhere downstream.
 */
export type Capability = "ai" | "vision" | "speech_to_text" | "text_to_speech" | "location" | "bazaar";

/** The message kinds a feature can act on while it is the current one. */
export type MessageKind = "text" | "image" | "audio" | "document" | "video" | "location" | "interactive";

/** Handlers the engine can name; the webhook maps each id to an implementation. */
export type HandlerId =
  | "ai_ask"          // the assistant: the next message is a question
  | "ai_voice"        // the assistant: the next voice note is a question
  | "ai_new"          // the assistant: close this thread and open another
  | "voice_settings"  // explain and set how replies are delivered
  | "human"           // hand over to a person
  | "help"            // the navigation commands
  | "coming_soon";    // declared, announced, not built yet

export interface CatalogNode {
  /** Stable id. Persisted in the session, so renaming one is a migration. */
  id: string;
  /** Parent id; `null` only for the root. */
  parent: string | null;
  /** Position under the parent. The number the sender types is derived, never stored. */
  order: number;
  kind: "menu" | "action";
  /** Off means announced as unavailable rather than hidden — see `hidden`. */
  enabled: boolean;
  /** Kept out of the menu entirely. Used for the root and for internal nodes. */
  hidden?: boolean;
  title: Localized;
  description: Localized;
  /** An emoji is decoration only: every title reads correctly without it. */
  emoji?: string;
  requires?: readonly Capability[];
  /** Action only: the words this stands in for, given to the existing pipeline. */
  phrase?: Localized;
  /** Action only: a handler the webhook implements. */
  handler?: HandlerId;
  /** Which message kinds this feature acts on once it is current. */
  accepts?: readonly MessageKind[];
  /** Shown when the feature becomes current, before anything is sent. */
  intro?: Localized;
}

export const ROOT_ID = "main";

/**
 * The tree.
 *
 * Order within a parent is the order of the numbers a sender types, and it is
 * `order` that decides it, not array position — reordering is editing one
 * number. Ten top-level entries is the ceiling Meta's interactive list allows
 * and about the ceiling a person can hold in their head at once.
 */
export const CATALOG: readonly CatalogNode[] = [
  {
    id: ROOT_ID,
    parent: null,
    order: 0,
    kind: "menu",
    enabled: true,
    hidden: true,
    title: { ar: "قائمة Visionex", en: "Visionex menu" },
    description: { ar: "الخدمات المتاحة", en: "Everything Visionex can do here" },
  },

  // ── Main menu ───────────────────────────────────────────────────────────
  {
    id: "assistant",
    parent: ROOT_ID,
    order: 1,
    kind: "menu",
    enabled: true,
    emoji: "🤖",
    title: { ar: "المساعد الذكي", en: "AI Assistant" },
    description: { ar: "اسأل أي سؤال، كتابةً أو صوتاً", en: "Ask anything, typed or spoken" },
    requires: ["ai"],
  },
  {
    id: "assistant.ask",
    parent: "assistant",
    order: 1,
    kind: "action",
    enabled: true,
    title: { ar: "اسأل المساعد", en: "Ask AI" },
    description: { ar: "اكتب سؤالك وأجيبك", en: "Type your question" },
    handler: "ai_ask",
    requires: ["ai"],
    accepts: ["text", "audio"],
    intro: {
      ar: "تفضل، اكتب سؤالك. أنا أتذكر سياق حديثنا، و«0» للرجوع.",
      en: "Go ahead — send me your question. I'll keep the thread in mind. Send 0 to go back.",
    },
  },
  {
    id: "assistant.voice",
    parent: "assistant",
    order: 2,
    kind: "action",
    enabled: true,
    title: { ar: "سؤال صوتي", en: "Voice question" },
    description: { ar: "أرسل سؤالك برسالة صوتية", en: "Send your question as a voice note" },
    handler: "ai_voice",
    requires: ["ai", "speech_to_text"],
    accepts: ["audio", "text"],
    intro: {
      ar: "أرسل سؤالك برسالة صوتية وسأسمعه وأجيبك. «0» للرجوع.",
      en: "Send your question as a voice note and I'll listen and answer. Send 0 to go back.",
    },
  },
  {
    id: "assistant.new",
    parent: "assistant",
    order: 3,
    kind: "action",
    enabled: true,
    title: { ar: "محادثة جديدة", en: "New conversation" },
    description: { ar: "ابدأ من صفحة بيضاء", en: "Start a fresh thread" },
    handler: "ai_new",
    requires: ["ai"],
    accepts: ["text"],
  },
  {
    id: "voice",
    parent: ROOT_ID,
    order: 2,
    kind: "action",
    enabled: true,
    emoji: "🎙️",
    title: { ar: "المساعد الصوتي", en: "Voice Assistant" },
    description: { ar: "تكلم بدل الكتابة، واختر كيف أرد", en: "Talk instead of typing, and how I answer" },
    handler: "voice_settings",
    requires: ["speech_to_text"],
    accepts: ["text", "audio"],
  },
  {
    id: "ocr",
    parent: ROOT_ID,
    order: 3,
    kind: "menu",
    enabled: true,
    emoji: "📷",
    title: { ar: "قراءة الصور والنصوص", en: "OCR and photos" },
    description: { ar: "أقرأ وأصف وأترجم ما في الصورة", en: "Read, describe or translate a photo" },
    requires: ["vision"],
  },
  {
    id: "academy",
    parent: ROOT_ID,
    order: 4,
    kind: "action",
    enabled: false,
    emoji: "🎓",
    title: { ar: "أكاديمية Visionex", en: "Visionex Academy" },
    description: { ar: "الدورات والتعلّم", en: "Courses and learning" },
    handler: "coming_soon",
  },
  {
    id: "kids",
    parent: ROOT_ID,
    order: 5,
    kind: "action",
    enabled: false,
    emoji: "🧸",
    title: { ar: "عالم الأطفال", en: "VisionKids" },
    description: { ar: "قصص وألعاب تعليمية", en: "Stories and learning games" },
    handler: "coming_soon",
  },
  {
    id: "news",
    parent: ROOT_ID,
    order: 6,
    kind: "action",
    enabled: false,
    emoji: "📰",
    title: { ar: "الأخبار", en: "News" },
    description: { ar: "آخر الأخبار", en: "The latest headlines" },
    handler: "coming_soon",
  },
  {
    id: "sports",
    parent: ROOT_ID,
    order: 7,
    kind: "action",
    enabled: false,
    emoji: "⚽",
    title: { ar: "الرياضة", en: "Sports" },
    description: { ar: "النتائج والمباريات", en: "Scores and fixtures" },
    handler: "coming_soon",
  },
  {
    id: "services",
    parent: ROOT_ID,
    order: 8,
    kind: "menu",
    enabled: true,
    emoji: "🧭",
    title: { ar: "خدمات Visionex", en: "Visionex Services" },
    description: { ar: "الطقس، موقعك، ما حولك، والسوق", en: "Weather, location, nearby, the bazaar" },
  },
  {
    id: "support",
    parent: ROOT_ID,
    order: 9,
    kind: "menu",
    enabled: true,
    emoji: "🆘",
    title: { ar: "الدعم", en: "Support" },
    description: { ar: "موظف بشري وشرح الأوامر", en: "A person, and how to get around" },
  },
  {
    id: "more",
    parent: ROOT_ID,
    order: 10,
    kind: "menu",
    enabled: true,
    emoji: "➕",
    title: { ar: "المزيد", en: "More" },
    description: { ar: "اللغة والإعدادات", en: "Language and settings" },
  },

  // ── Reading a photo ─────────────────────────────────────────────────────
  {
    id: "ocr.read",
    parent: "ocr",
    order: 1,
    kind: "action",
    enabled: true,
    title: { ar: "اقرأ لي", en: "Read the text" },
    description: { ar: "أقرأ النص المكتوب كما هو", en: "Exactly as written" },
    phrase: { ar: "اقرأ", en: "read this" },
    accepts: ["image", "text"],
  },
  {
    id: "ocr.describe",
    parent: "ocr",
    order: 2,
    kind: "action",
    enabled: true,
    title: { ar: "صف لي الصورة", en: "Describe the photo" },
    description: { ar: "أصف ما أمامك", en: "What is in front of you" },
    phrase: { ar: "صف لي", en: "describe this" },
    accepts: ["image", "text"],
  },
  {
    id: "ocr.find",
    parent: "ocr",
    order: 3,
    kind: "action",
    enabled: true,
    title: { ar: "ابحث عن غرض", en: "Find a thing" },
    description: { ar: "أدلّك على غرض داخل الصورة", en: "Locate something in the photo" },
    phrase: { ar: "وين غرضي", en: "find my keys" },
    accepts: ["image", "text"],
  },
  {
    id: "ocr.product",
    parent: "ocr",
    order: 4,
    kind: "action",
    enabled: true,
    title: { ar: "تعريف منتج", en: "Identify a product" },
    description: { ar: "الاسم والصلاحية والمكوّنات", en: "Name, expiry and ingredients" },
    phrase: { ar: "منتج", en: "product label" },
    accepts: ["image", "text"],
  },
  {
    id: "ocr.translate",
    parent: "ocr",
    order: 5,
    kind: "action",
    enabled: true,
    title: { ar: "ترجم", en: "Translate" },
    description: { ar: "صورة أو نص ترسله", en: "A photo, or text you send" },
    phrase: { ar: "ترجم", en: "translate" },
    accepts: ["image", "text"],
  },
  {
    id: "ocr.document",
    parent: "ocr",
    order: 6,
    kind: "action",
    enabled: true,
    title: { ar: "ملف PDF", en: "A PDF or file" },
    description: { ar: "أرسل الملف وألخّصه لك", en: "Send it and I'll summarise it" },
    handler: "coming_soon",
    accepts: ["document", "text"],
    intro: {
      ar: "أرسل ملف PDF أو ملفاً نصياً وسألخّصه لك أو أجيبك عمّا فيه.",
      en: "Send a PDF or a text file and I'll summarise it or answer questions about it.",
    },
  },

  // ── Services ────────────────────────────────────────────────────────────
  {
    id: "services.weather",
    parent: "services",
    order: 1,
    kind: "action",
    enabled: true,
    title: { ar: "الطقس", en: "Weather" },
    description: { ar: "طقس مكانك أو أي مدينة", en: "Where you are, or any city" },
    phrase: { ar: "الطقس", en: "weather" },
    accepts: ["text", "location"],
  },
  {
    id: "services.where",
    parent: "services",
    order: 2,
    kind: "action",
    enabled: true,
    title: { ar: "أين أنا", en: "Where am I" },
    description: { ar: "عنوان مكانك الحالي", en: "Your current place" },
    phrase: { ar: "وين أنا", en: "where am I" },
    requires: ["location"],
    accepts: ["text", "location"],
  },
  {
    id: "services.nearby",
    parent: "services",
    order: 3,
    kind: "action",
    enabled: true,
    title: { ar: "ما حولي", en: "Near me" },
    description: { ar: "أقرب صيدلية أو مطعم أو موقف", en: "Closest pharmacy, café or stop" },
    phrase: { ar: "شو حولي", en: "what is near me" },
    requires: ["location"],
    accepts: ["text", "location"],
  },
  {
    id: "services.bazaar",
    parent: "services",
    order: 4,
    kind: "action",
    enabled: true,
    title: { ar: "طلب منتج", en: "Find a product" },
    description: { ar: "أبحث لك في سوق Visionex", en: "Search the Visionex bazaar" },
    phrase: { ar: "السوق", en: "the bazaar" },
    requires: ["bazaar"],
    accepts: ["text"],
  },
  {
    id: "services.sell",
    parent: "services",
    order: 5,
    kind: "action",
    enabled: true,
    title: { ar: "أريد أن أبيع", en: "I want to sell" },
    description: { ar: "كيف تفتح متجرك", en: "How to open a shop" },
    phrase: { ar: "أبيع", en: "I want to sell" },
    accepts: ["text"],
  },

  // ── Support ─────────────────────────────────────────────────────────────
  {
    id: "support.human",
    parent: "support",
    order: 1,
    kind: "action",
    enabled: true,
    title: { ar: "موظف بشري", en: "Talk to a person" },
    description: { ar: "أحوّلك لشخص من الفريق", en: "Hand you to the team" },
    phrase: { ar: "بدي أحكي مع موظف", en: "I want to speak to a person" },
    accepts: ["text"],
  },
  {
    id: "support.help",
    parent: "support",
    order: 2,
    kind: "action",
    enabled: true,
    title: { ar: "شرح الأوامر", en: "How to get around" },
    description: { ar: "الرجوع، الإلغاء، القائمة", en: "Back, cancel, menu" },
    handler: "help",
    accepts: ["text"],
  },

  // ── More ────────────────────────────────────────────────────────────────
  {
    id: "more.voice",
    parent: "more",
    order: 1,
    kind: "action",
    enabled: true,
    title: { ar: "الردود الصوتية", en: "Voice replies" },
    description: { ar: "صوت، كتابة، أو مثل ما ترسل", en: "Voice, text, or match me" },
    handler: "voice_settings",
    accepts: ["text"],
  },
  {
    id: "more.language",
    parent: "more",
    order: 2,
    kind: "action",
    enabled: true,
    title: { ar: "اللغة", en: "Language" },
    description: { ar: "قل «احكي معي بالإنجليزي» مثلاً", en: "Say \"reply in Arabic\", for example" },
    handler: "coming_soon",
    accepts: ["text"],
    intro: {
      ar: "قل لي بأي لغة تريد أن أرد — مثلاً «احكي معي بالإنجليزي» — وسأتابع بها.",
      en: "Tell me which language to answer in — \"reply in Arabic\", for example — and I'll keep to it.",
    },
  },
  {
    id: "more.help",
    parent: "more",
    order: 3,
    kind: "action",
    enabled: true,
    title: { ar: "شرح الأوامر", en: "How to get around" },
    description: { ar: "الرجوع، الإلغاء، القائمة", en: "Back, cancel, menu" },
    handler: "help",
    accepts: ["text"],
  },
];

// ── Lookups ───────────────────────────────────────────────────────────────

const BY_ID = new Map(CATALOG.map((node) => [node.id, node]));

export const nodeById = (id: string | null | undefined): CatalogNode | null =>
  (id ? BY_ID.get(id) ?? null : null);

/** The children of a node, in menu order, excluding hidden ones. */
export function childrenOf(id: string): CatalogNode[] {
  return CATALOG
    .filter((node) => node.parent === id && !node.hidden)
    .sort((a, b) => a.order - b.order);
}

/**
 * The child a typed number selects.
 *
 * Position in the rendered menu, not `order`, so a gap left by a removed entry
 * never leaves a hole in the numbering the sender is reading.
 */
export function childAt(parentId: string, choice: number): CatalogNode | null {
  const children = childrenOf(parentId);
  if (choice < 1 || choice > children.length) return null;
  return children[choice - 1];
}

/** The number a node is shown as under its parent, or 0 if it is not shown. */
export function numberOf(node: CatalogNode): number {
  if (!node.parent) return 0;
  return childrenOf(node.parent).findIndex((child) => child.id === node.id) + 1;
}

/** Root-first path to a node: ["main", "ocr", "ocr.read"]. */
export function pathTo(id: string): string[] {
  const path: string[] = [];
  let cursor = nodeById(id);
  while (cursor) {
    path.unshift(cursor.id);
    cursor = nodeById(cursor.parent);
  }
  return path;
}

/** Every capability any enabled node needs. Used to check the environment once. */
export function requiredCapabilities(): Capability[] {
  const all = new Set<Capability>();
  for (const node of CATALOG) {
    if (!node.enabled) continue;
    for (const capability of node.requires ?? []) all.add(capability);
  }
  return [...all];
}

// ── The tappable version ──────────────────────────────────────────────────

/** Meta's hard limits on an interactive list. Breaking one rejects the message. */
export const LIST_LIMITS = {
  rows: 10,
  rowTitle: 24,
  rowDescription: 72,
  button: 20,
  header: 60,
  body: 1_024,
  footer: 60,
} as const;

export interface InteractiveList {
  type: "list";
  header: { type: "text"; text: string };
  body: { text: string };
  footer: { text: string };
  action: {
    button: string;
    sections: Array<{ title: string; rows: Array<{ id: string; title: string; description: string }> }>;
  };
}

const clip = (text: string, limit: number): string =>
  text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;

/**
 * One menu as a tappable list.
 *
 * Never the only copy of what it says: Meta refuses an interactive message
 * outright outside the 24-hour service window, and the caller sends
 * `renderMenu` as text either way. Clipping is a last resort that keeps a
 * too-long label from rejecting the whole message — the suite asserts nothing
 * in the catalog actually reaches it, so the clip is a seatbelt, not a design.
 */
export function listMessageFor(nodeId: string, language: Language): InteractiveList | null {
  const node = nodeById(nodeId);
  if (!node) return null;
  const children = childrenOf(nodeId).slice(0, LIST_LIMITS.rows);
  if (children.length === 0) return null;

  const ar = language === "ar";
  return {
    type: "list",
    header: { type: "text", text: clip(localized(node.title, language), LIST_LIMITS.header) },
    body: {
      text: clip(
        ar
          ? "اختر رقماً، أو أرسل الرقم كرسالة. «0» للرجوع و«مساعدة» لبقية الأوامر."
          : "Pick a number, or just send the number. 0 goes back, \"help\" explains the rest.",
        LIST_LIMITS.body,
      ),
    },
    footer: {
      text: clip(ar ? "Visionex" : "Visionex", LIST_LIMITS.footer),
    },
    action: {
      button: clip(ar ? "اختر" : "Choose", LIST_LIMITS.button),
      sections: [{
        title: clip(localized(node.title, language), LIST_LIMITS.rowTitle),
        rows: children.map((child) => ({
          id: child.id,
          title: clip(`${numberOf(child)}. ${localized(child.title, language)}`, LIST_LIMITS.rowTitle),
          description: clip(localized(child.description, language), LIST_LIMITS.rowDescription),
        })),
      }],
    },
  };
}
