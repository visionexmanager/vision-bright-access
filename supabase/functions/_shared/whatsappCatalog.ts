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

import { NODE_TEXT } from "./whatsappCatalogLocales.ts";
import type { SupportedLanguage } from "./whatsappLanguages.ts";

/**
 * The language a menu is rendered in.
 *
 * Every language the site speaks, not two. It was `"ar" | "en"` while the only
 * way to reach this menu was to type at it in one of those; a sender now picks
 * their language from a list before they ever see a feature, and a menu that
 * could not answer in the language they just chose would make the choice a lie.
 */
export type Language = SupportedLanguage;

/**
 * One user-visible string, in as many languages as it has been written in.
 *
 * English is the only one required. That is not a preference — it is the
 * fallback, and making it structural means a label can never resolve to
 * `undefined` and be sent as the word "undefined" to somebody who cannot see
 * that it is wrong. Arabic is required too, because every string in this
 * repository already had it and losing one would be a regression.
 *
 * A language a string has not been written in yet reads in English. Visibly
 * incomplete beats invisibly broken, and the suite reports which are which.
 */
export type Localized =
  & { en: string; ar: string }
  & Partial<Record<SupportedLanguage, string>>;

/** One string, in the sender's language, or in English when it has no other. */
export const localized = (value: Localized, language: Language): string =>
  value[language] ?? value.en;

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
  | "language_menu"   // offer the language list again
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
  /**
   * Words that name this feature outright, beyond its `phrase`.
   *
   * Whole-message matches only, and the router folds case, punctuation and the
   * diacritics an Arabic keyboard adds. This is not the feature's parser — the
   * weather still reads "what's the weather in Amman tomorrow" itself. What
   * these buy is a *name*: an id for the words, so a switched-off feature can
   * be refused rather than quietly answered by the assistant instead.
   */
  aliases?:
    & { readonly ar: readonly string[]; readonly en: readonly string[] }
    & Partial<Record<SupportedLanguage, readonly string[]>>;
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
const BASE_CATALOG: readonly CatalogNode[] = [
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
    aliases: { ar: ["المساعد", "الذكاء الاصطناعي"], en: ["ai", "assistant", "ai assistant"] },
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
  // ── The three groups the site is organised by ───────────────────────────
  //
  // Added when the top level hit Meta's ten-row ceiling with ten rows and no
  // room for an eleventh: the songs feature had to be buried inside Services,
  // three menus away from the radio it belongs beside. Grouping is what buys
  // the headroom back, and the groups are the site's own — Listen, VXBazaar,
  // Explore — so somebody who knows visionex.app knows this menu.
  //
  // No id here was renamed to fit: a node id is persisted in sessions and named
  // in the production feature flags, so only `parent` and `order` moved.
  {
    id: "listen",
    parent: ROOT_ID,
    order: 3,
    kind: "menu",
    enabled: true,
    emoji: "🎧",
    title: { ar: "استمع", en: "Listen" },
    description: { ar: "الراديو والأغاني", en: "Radio and songs" },
  },
  {
    id: "bazaar",
    parent: ROOT_ID,
    order: 4,
    kind: "menu",
    enabled: true,
    emoji: "🛍️",
    // The site calls it VXBazaar everywhere, including in Arabic. Here it
    // cannot: an Arabic menu carries no Latin beyond «Visionex» and «PDF»,
    // because a screen reader set to Arabic spells the rest out letter by
    // letter. The brand survives in the eighteen languages whose script is
    // Latin already.
    title: { ar: "سوق Visionex", en: "VXBazaar" },
    description: { ar: "تسوّق، بِع، وتابع طلباتك", en: "Shop, sell, track your orders" },
    // No aliases on any of the three groups. «السوق» and "shop" are the words
    // `services.bazaar` already answers to, and a word that resolves to two
    // nodes resolves to whichever the sort happened to put first.
  },
  {
    id: "explore",
    parent: ROOT_ID,
    order: 6,
    kind: "menu",
    enabled: true,
    emoji: "🧭",
    title: { ar: "تعلّم واستكشف", en: "Learn & explore" },
    description: { ar: "الأكاديمية والأطفال والأخبار", en: "Academy, kids and news" },
  },
  {
    id: "ocr",
    parent: ROOT_ID,
    order: 2,
    kind: "menu",
    enabled: true,
    emoji: "📷",
    title: { ar: "قراءة الصور والنصوص", en: "OCR and photos" },
    description: { ar: "أقرأ وأصف وأترجم ما في الصورة", en: "Read, describe or translate a photo" },
    requires: ["vision"],
  },
  {
    id: "academy",
    parent: "explore",
    order: 1,
    kind: "action",
    // Switched on with IVX: the node used to say "coming soon" because there
    // was nothing behind it. There is now — adaptive practice that shares one
    // student's progress with the website.
    enabled: true,
    emoji: "🎓",
    title: { ar: "أكاديمية IVX", en: "IVX Academy" },
    description: { ar: "تعلّم يتكيّف معك", en: "Learning that adapts to you" },
    aliases: {
      ar: ["أكاديمية", "اكاديمية", "تعلم", "تعلّم", "دراسة", "IVX"],
      en: ["academy", "learn", "study", "practice", "ivx"],
    },
    phrase: { ar: "تعلّم", en: "learn" },
    accepts: ["text"],
  },
  {
    id: "kids",
    parent: "explore",
    order: 2,
    kind: "action",
    enabled: false,
    emoji: "🧸",
    title: { ar: "عالم الأطفال", en: "VisionKids" },
    description: { ar: "قصص وألعاب تعليمية", en: "Stories and learning games" },
    handler: "coming_soon",
  },
  {
    // Switched on when the WhatsApp side was built. It reads the same
    // `news_articles` rows the website's own /news page reads, so there is one
    // feed and one place it is published from — see `whatsappNews.ts`.
    id: "news",
    parent: "explore",
    order: 3,
    kind: "action",
    enabled: true,
    emoji: "📰",
    title: { ar: "الأخبار", en: "News" },
    description: { ar: "آخر الأخبار", en: "The latest headlines" },
    // The only node whose words are written in all twenty languages, and the
    // reason is `whatsappNews.ts`: asking for the news is one word, and one
    // word is exactly what language detection cannot read. A lone "noticias"
    // carries no Spanish function word and no ñ, so it is detected as English
    // and, before this list existed, was answered by the assistant instead of
    // by the feature the sender had just named. Every other node is reached by
    // a sentence, which detection does read.
    //
    // Written pre-folded where a keyboard has a choice — Arabic without hamza,
    // Persian with and without the ZWNJ — because `normaliseAlias` folds the
    // message but cannot guess which spelling was meant.
    aliases: {
      ar: ["اخبار", "الاخبار", "اخر الاخبار", "اخبار اليوم", "الاخبار اليوم", "جديد الاخبار"],
      en: ["news", "the news", "latest news", "headlines"],
      ur: ["خبریں", "تازہ خبریں", "تازہ ترین خبریں", "خبرنامہ"],
      hi: ["समाचार", "ताजा समाचार", "खबर", "न्यूज़"],
      id: ["berita", "berita terbaru", "kabar terbaru"],
      ja: ["ニュース", "最新ニュース", "最新のニュース"],
      it: ["notizie", "le notizie", "ultime notizie"],
      ko: ["뉴스", "최신 뉴스", "최신 소식"],
      nl: ["nieuws", "het nieuws", "laatste nieuws"],
      pl: ["wiadomości", "najnowsze wiadomości", "aktualności"],
      vi: ["tin tức", "tin mới", "tin mới nhất"],
      bn: ["খবর", "সংবাদ", "সর্বশেষ খবর"],
      fa: ["اخبار", "خبرها", "آخرین اخبار", "تازه‌ترین خبرها", "تازه ترین خبرها"],
      es: ["noticias", "las noticias", "últimas noticias"],
      de: ["nachrichten", "aktuelle nachrichten", "neuigkeiten"],
      pt: ["notícias", "as notícias", "últimas notícias"],
      zh: ["新闻", "最新新闻", "最新消息", "新聞"],
      tr: ["haberler", "son haberler"],
      fr: ["actualités", "les actualités", "nouvelles", "dernières nouvelles"],
      ru: ["новости", "последние новости", "свежие новости"],
    },
    phrase: { ar: "الأخبار", en: "news" },
    accepts: ["text"],
  },
  {
    id: "sports",
    parent: "explore",
    order: 4,
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
    order: 5,
    kind: "menu",
    enabled: true,
    emoji: "🧭",
    title: { ar: "خدمات Visionex", en: "Visionex Services" },
    // The bazaar moved to its own group, so this no longer promises it.
    description: { ar: "الطقس، أين أنت، وما حولك", en: "Weather, where you are, what is nearby" },
  },
  {
    id: "support",
    parent: ROOT_ID,
    order: 7,
    kind: "menu",
    enabled: true,
    emoji: "🆘",
    title: { ar: "الدعم", en: "Support" },
    description: { ar: "موظف بشري وكيفية الاستخدام", en: "A person, and how to get around" },
  },
  {
    id: "more",
    parent: ROOT_ID,
    order: 8,
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
    aliases: { ar: ["اقرا لي", "اقرأ لي"], en: ["read", "read text"] },
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
    aliases: { ar: ["صف", "وصف"], en: ["describe", "describe photo"] },
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
    aliases: { ar: ["وين غرضي", "دور على"], en: ["find", "find object"] },
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
    aliases: { ar: ["المنتج", "باركود"], en: ["product", "barcode"] },
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
    aliases: { ar: ["ترجمة", "ترجملي"], en: ["translation", "translate this"] },
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
    aliases: { ar: ["الجو", "طقس"], en: ["weather", "forecast"] },
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
    aliases: { ar: ["اين انا", "وين انا", "موقعي"], en: ["where am i", "my location"] },
    phrase: { ar: "وين أنا", en: "where am I" },
    requires: ["location"],
    accepts: ["text", "location"],
  },
  {
    id: "services.place",
    parent: "services",
    order: 3,
    kind: "action",
    enabled: true,
    title: { ar: "موقع مكان", en: "Find a place" },
    description: { ar: "أرسل لي موقع بنك أو شركة", en: "A bank, a shop, a company" },
    aliases: {
      ar: ["موقع", "لوكيشن", "عنوان", "ابعتلي موقع"],
      en: ["location of", "address of", "find a place"],
    },
    phrase: { ar: "ابعتلي موقع بنك الأردن", en: "send me the location of Arab Bank" },
    // No pin required: this one answers from a name, which is what makes it
    // the location question somebody can ask before they have shared anything.
    accepts: ["text"],
  },
  {
    id: "services.convert",
    parent: "services",
    order: 5,
    kind: "action",
    enabled: true,
    title: { ar: "تحويل ملف", en: "Convert a file" },
    description: { ar: "صوت أو فيديو إلى صيغة أخرى", en: "Audio or video, to another format" },
    aliases: {
      ar: ["حوّل", "حول ملف", "تحويل"],
      en: ["convert", "convert file", "change format"],
    },
    phrase: { ar: "حوّل ملف", en: "convert a file" },
    // The file is the input and it arrives as its own message, so tapping this
    // row asks for one. Sending a file with a format named skips the row
    // entirely, which is the path most people will actually take — this exists
    // so the capability can be found by somebody who does not know it is there.
    accepts: ["text"],
  },
  {
    id: "services.nearby",
    parent: "services",
    order: 4,
    kind: "action",
    enabled: true,
    title: { ar: "ما حولي", en: "Near me" },
    description: { ar: "أقرب صيدلية أو مطعم أو موقف", en: "Closest pharmacy, café or stop" },
    aliases: { ar: ["حولي", "شو حواليي", "ما حولي"], en: ["near me", "nearby"] },
    phrase: { ar: "شو حولي", en: "what is near me" },
    requires: ["location"],
    accepts: ["text", "location"],
  },
  {
    id: "services.plan",
    parent: "services",
    order: 5,
    kind: "action",
    enabled: true,
    title: { ar: "باقتي", en: "My plan" },
    description: { ar: "رصيد اليوم وما تبقّى", en: "Today's allowance and what's left" },
    aliases: {
      ar: ["باقتي", "اشتراكي", "رصيدي", "كم باقي"],
      en: ["my plan", "my subscription", "usage", "allowance"],
    },
    phrase: { ar: "باقتي", en: "my plan" },
    accepts: ["text"],
  },
  {
    id: "services.bazaar",
    parent: "bazaar",
    order: 1,
    kind: "action",
    enabled: true,
    title: { ar: "طلب منتج", en: "Find a product" },
    description: { ar: "أبحث لك في سوق Visionex", en: "Search the Visionex bazaar" },
    aliases: { ar: ["البازار", "المتجر"], en: ["bazaar", "the shop"] },
    phrase: { ar: "السوق", en: "the bazaar" },
    requires: ["bazaar"],
    accepts: ["text"],
  },
  {
    id: "services.sell",
    parent: "bazaar",
    order: 2,
    kind: "action",
    enabled: true,
    title: { ar: "أريد أن أبيع", en: "I want to sell" },
    description: { ar: "كيف تفتح متجرك", en: "How to open a shop" },
    aliases: { ar: ["ابيع", "بدي ابيع"], en: ["sell", "i want to sell"] },
    phrase: { ar: "أبيع", en: "I want to sell" },
    accepts: ["text"],
  },
  {
    // Appended at the end rather than placed next to the bazaar, because the
    // order of these rows is something a screen-reader user learns by position.
    // The right place for a new row is after the ones people have memorised.
    id: "services.orders",
    parent: "bazaar",
    order: 3,
    kind: "action",
    enabled: true,
    title: { ar: "طلباتي", en: "My orders" },
    description: { ar: "حالة طلبك من سوق Visionex", en: "Where your bazaar order is" },
    aliases: { ar: ["طلبي", "طلباتي", "حاله الطلب"], en: ["my orders", "order status", "track my order"] },
    phrase: { ar: "طلباتي", en: "my orders" },
    requires: ["bazaar"],
    accepts: ["text"],
  },
  {
    // Keyless by construction: a table read, no provider, no key. That is not
    // incidental — a WhatsApp feature here has to work without one, and a test
    // enforces it.
    id: "services.radio",
    parent: "listen",
    order: 1,
    kind: "action",
    enabled: true,
    title: { ar: "استمع للراديو", en: "Listen to radio" },
    description: { ar: "محطات من كل العالم", en: "Stations from around the world" },
    aliases: { ar: ["راديو", "إذاعة", "أغاني", "اغاني"], en: ["radio", "music", "songs"] },
    phrase: { ar: "موسيقى", en: "music" },
    accepts: ["text"],
  },
  {
    // The other half of listening, and deliberately a separate row: the radio
    // answers "play me something", this answers "play me *this*". Keyless too —
    // see `whatsappSongs.ts` for which two catalogues, and why a commercial
    // recording is never the thing that gets sent.
    //
    // Its aliases are the singular word for one song in each language, never
    // the plural: «أغاني» and "music" belong to the radio row above, and a
    // sender who says either wants a station, not a search box.
    id: "services.songs",
    parent: "listen",
    order: 2,
    kind: "action",
    enabled: true,
    title: { ar: "الأغاني", en: "Songs" },
    description: { ar: "أغنية بالاسم، أرسلها لك", en: "Name a song and I'll send it" },
    aliases: {
      ar: ["اغنية", "أغنية", "بدي اغنية"],
      en: ["song", "a song", "play a song"],
      ur: ["گانا"],
      hi: ["गाना", "गीत"],
      id: ["lagu"],
      ja: ["曲"],
      it: ["canzone"],
      ko: ["노래"],
      nl: ["liedje", "nummer"],
      pl: ["piosenka"],
      vi: ["bài hát"],
      bn: ["গান"],
      fa: ["آهنگ", "ترانه"],
      es: ["canción", "cancion"],
      de: ["lied"],
      pt: ["música", "musica"],
      zh: ["歌曲", "歌"],
      tr: ["şarkı", "sarki"],
      fr: ["chanson"],
      ru: ["песня"],
    },
    phrase: { ar: "أغنية", en: "song" },
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
    aliases: { ar: ["موظف", "موظف بشري", "بدي حدا"], en: ["human", "agent", "person"] },
    phrase: { ar: "بدي أحكي مع موظف", en: "I want to speak to a person" },
    accepts: ["text"],
  },
  {
    id: "support.help",
    parent: "support",
    order: 2,
    kind: "action",
    enabled: true,
    title: { ar: "كيف أتنقل", en: "How to get around" },
    description: { ar: "كيف يعمل هذا المساعد", en: "How this assistant works" },
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
    description: { ar: "أرد بنفس طريقتك", en: "I answer the way you ask" },
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
    description: { ar: "غيّر اللغة التي أرد بها", en: "Change the language I answer in" },
    aliases: { ar: ["اللغة", "غير اللغة"], en: ["language", "change language"] },
    handler: "language_menu",
    accepts: ["text"],
  },
  {
    id: "more.help",
    parent: "more",
    order: 3,
    kind: "action",
    enabled: true,
    title: { ar: "كيف أتنقل", en: "How to get around" },
    description: { ar: "كيف يعمل هذا المساعد", en: "How this assistant works" },
    handler: "help",
    accepts: ["text"],
  },
];

// ── The tree, in every language ───────────────────────────────────────────
//
// A node above declares English and Arabic inline, which is what somebody
// adding a feature has to write and all they have to write. The other eighteen
// languages live in `whatsappCatalogLocales.ts`, keyed by node id, and are
// folded in here — once, at module load, so every reader downstream sees one
// tree and there is no second place a label can be looked up from.
//
// Merged rather than replaced: a language missing from the table keeps whatever
// the node declared, and `localized` falls back to English past that. Adding a
// feature therefore never breaks a build, and adding a translation is a data
// edit that touches no code at all.

export const CATALOG: readonly CatalogNode[] = BASE_CATALOG.map((node) => {
  const text = NODE_TEXT[node.id];
  if (!text) return node;
  return {
    ...node,
    title: { ...node.title, ...text.title },
    description: { ...node.description, ...text.description },
  };
});

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
 * The children a sender is *shown*.
 *
 * Everything `childrenOf` returns, minus whatever a live feature flag has
 * switched off. A flag is turned at three in the morning because a provider is
 * down, and a row that answers a tap with "that isn't available" is a row that
 * wasted somebody's time — for a screen-reader user, one more thing to listen
 * past on every menu until the flag comes back off.
 *
 * A node whose `enabled` is false in the catalog is a different thing and stays
 * visible. That is a feature Visionex has announced and not built yet, and
 * removing Academy and VisionKids from the menu would tell the audience waiting
 * for them that they had been cancelled. They are shown, and opening one says
 * so in the sender's own language.
 *
 * Deliberately *not* what `childAt` counts against. A number is a legacy
 * command now, and a number that meant News last week has to still mean News
 * this week — even while News is flagged off, in which case it is refused
 * rather than silently redirected to whatever moved up into its place.
 */
export function visibleChildrenOf(id: string, disabled: readonly string[] = []): CatalogNode[] {
  if (disabled.length === 0) return childrenOf(id);
  return childrenOf(id).filter((child) => !isFlaggedOff(child, disabled));
}

/**
 * How many of a menu's ten rows are spent on the way out.
 *
 * At the top there is nowhere to go. Everywhere else both Back and Main menu
 * are offered — including one level down, where they lead to the same place:
 * somebody who cannot see the screen should not have to work out that on this
 * particular menu the two coincide.
 *
 * The rule lives here, next to the ten, because two things need it:
 * `whatsappInteractive.ts` builds the rows, and `offeredChildrenOf` below
 * decides what a tap may execute — and those two answers must be the same
 * answer. The main menu itself is at exactly ten children and takes no controls,
 * which is why this stays 0 at the top rather than reserving room there.
 */
export function controlRowCount(nodeId: string): number {
  return pathTo(nodeId).length <= 1 ? 0 : 2;
}

/**
 * The children a menu actually puts in front of somebody.
 *
 * `visibleChildrenOf` minus whatever does not fit: Meta allows ten rows in a
 * list *in total*, controls included, and an eleventh is not truncated — the
 * whole message is rejected. So a menu with too many children shows the first
 * few and the rest are unreachable.
 *
 * That is what makes this the security-relevant answer rather than a rendering
 * detail. A row nobody can be shown is a row nobody can have tapped, so an id
 * naming one did not come from a message this channel sent. The router refuses
 * it here, at the same function the menu is built from, which is the only way
 * the two can be guaranteed to agree.
 *
 * Today no menu is over its ceiling — the main menu is at exactly ten and every
 * submenu is well under. This is the guard for the eleventh row somebody adds.
 */
export function offeredChildrenOf(id: string, disabled: readonly string[] = []): CatalogNode[] {
  const room = LIST_LIMITS.rows - controlRowCount(id);
  return visibleChildrenOf(id, disabled).slice(0, Math.max(room, 0));
}

/**
 * Whether this node is a row this channel is structurally capable of showing.
 *
 * The root is not: it is hidden and has no parent to be listed under. A hidden
 * node is not. A node past its parent's ten-row ceiling is not — this channel
 * has never rendered it, so nobody can have tapped it.
 *
 * ── Why the live flags are deliberately not consulted ───────────────────────
 *
 * A flagged-off feature *is* a real row that people have really seen, and it
 * has a much better answer than "that option has moved": `isAvailable` refuses
 * it and the sender is told the service is closed, in their own language. So
 * the flag stays where it was, at the gate, and this asks the narrower question
 * — could this row ever have been on a menu at all?
 *
 * Asking it with no flags applied is also the stricter reading. A flag frees a
 * slot, so a row that does not fit today might fit while something above it is
 * switched off; refusing on the unflagged layout means a flag can never widen
 * what a stale id may execute.
 */
export function isOffered(node: CatalogNode | null | undefined): boolean {
  if (!node || node.hidden || !node.parent) return false;
  return offeredChildrenOf(node.parent, []).some((child) => child.id === node.id);
}

/** Whether a live flag has switched this node, or anything above it, off. */
export function isFlaggedOff(node: CatalogNode | null | undefined, disabled: readonly string[]): boolean {
  let cursor: CatalogNode | null = node ?? null;
  while (cursor) {
    if (disabled.includes(cursor.id)) return true;
    cursor = nodeById(cursor.parent);
  }
  return false;
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

/**
 * Every word that names a node, its `phrase` first.
 *
 * The canonical phrase is an alias by definition — it is what the menu row
 * stands in for — so it never has to be written twice.
 */
export function aliasesOf(node: CatalogNode, language: Language): string[] {
  const phrase = node.phrase ? [localized(node.phrase, language)] : [];
  // English when this language has no list of its own — the same fallback
  // `localized` makes one line above, and for the same reason.
  //
  // It used to be `[...node.aliases[language]]`, which for any of the eighteen
  // languages that are not Arabic or English spread `undefined` and threw
  // `TypeError: node.aliases[language] is not iterable`. Every typed message
  // reaches the router, so a Turkish or Urdu sender met that error instead of
  // an answer — on every message, not only in the menu. The suite now resolves
  // an alias in all twenty languages so this cannot come back.
  const extra = node.aliases?.[language] ?? node.aliases?.en ?? [];
  return [...phrase, ...extra].filter((word) => word.trim().length > 0);
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

// ── Turning a feature off without a deploy ────────────────────────────────
//
// `enabled` in the catalog is the compile-time answer: a feature nobody has
// built yet. This is the runtime one, read from `site_settings` — the table
// Visionex already keeps its configuration in, and the same one the owner's
// phone number comes from. Editing a row there takes a feature off every menu
// on the next message, which is what you want at three in the morning when a
// provider is down and the alternative is a deploy.
//
//   key:   whatsapp_features
//   value: { "disabled": ["news", "services.bazaar"] }
//
// Ids, not numbers: a number is a position and positions move, so a row that
// disabled "3" would disable something else the moment the menu was reordered.

/** Read the disabled list out of whatever the settings row holds. */
export function parseDisabledFeatures(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const disabled = (value as { disabled?: unknown }).disabled;
  if (!Array.isArray(disabled)) return [];
  // Only ids this build actually has: a stale id names nothing and would
  // otherwise sit in the list looking like it was doing something.
  return disabled.filter((id): id is string => typeof id === "string" && !!nodeById(id));
}

/**
 * Whether a node can be opened right now.
 *
 * Both answers have to agree. A parent that is off takes its children with it —
 * otherwise a disabled menu would still be reachable by anything that knows a
 * child's id, which is exactly the bypass the flag is there to prevent.
 */
export function isAvailable(
  node: CatalogNode | null | undefined,
  disabled: readonly string[] = [],
): boolean {
  let cursor: CatalogNode | null = node ?? null;
  while (cursor) {
    if (!cursor.enabled || disabled.includes(cursor.id)) return false;
    cursor = nodeById(cursor.parent);
  }
  return true;
}

// ── What Meta will accept ─────────────────────────────────────────────────
//
// The limits live here, next to the labels they constrain, so the test that
// walks every title and description can check them against the catalog without
// importing the sender. Building the messages themselves is
// `whatsappInteractive.ts`: this file is data and lookups, and a file that both
// declares the menu and knows how to post it to Meta is two files.

/** Meta's hard limits on an interactive message. Breaking one rejects the send. */
export const LIST_LIMITS = {
  /** Rows in a list, in total, across every section. Not per section. */
  rows: 10,
  /** Reply buttons on a button message. */
  buttons: 3,
  rowTitle: 24,
  rowDescription: 72,
  buttonTitle: 20,
  button: 20,
  header: 60,
  body: 1_024,
  footer: 60,
} as const;
