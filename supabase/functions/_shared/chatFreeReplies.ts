// A free answer for someone who is not subscribed yet.
//
// The subscription gate stops every paid provider for a sender without a plan,
// and used to leave them in silence after one notice. This gives them a warm,
// useful answer instead — from fixed text only. No model, no speech, no search,
// no database read about them: matching is keywords over the message, and the
// sentences are in `chatFreeRepliesStrings.ts`. Every answer ends with the plans
// link and the in-chat sign-up phrase, which is the whole point.
//
// Nothing here states a price or a limit; those change and live behind the link.

import { fold } from "./chatSignup.ts";
import { LEXICON } from "./chatPhraseLexicon.ts";
import { FREE_STRINGS, type FreeKey } from "./chatFreeRepliesStrings.ts";
import { GUIDE_STRINGS, SITE_PLANS, SITE_PRICES, type GuideKey } from "./chatSiteGuideStrings.ts";
import { DISCOVER_STRINGS } from "./chatDiscoverStrings.ts";
import { SIGNUP_STRINGS } from "./chatSignupStrings.ts";
import { PLANS_URL } from "./whatsappEntitlements.ts";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./whatsappLanguages.ts";

export const SITE_URL = "https://visionex.app";

export type FreeTopic = Exclude<FreeKey, "footer"> | GuideKey | "choose";

/** Checked in this order: the first topic with a matching keyword wins. */
const TOPICS: ReadonlyArray<readonly [Exclude<FreeTopic, "fallback">, readonly string[]]> = [
  ["contact", [
    "contact", "contact us", "support", "email you", "phone number", "call you", "talk to someone",
    "تواصل", "اتصل", "رقم الهاتف", "دعم فني", "الدعم الفني", "خدمة العملاء", "كلم", "تكلم",
    "contacto", "contacter", "kontakt", "iletisim", "связаться", "контакт", "تماس", "رابطہ", "संपर्क", "kontak", "contatto", "contato", "联系", "お問い合わせ", "문의",
  ]],
  ["choose", [
    "help me choose", "which plan suits me", "which plan is best for me", "recommend", "suggest a plan", "what do you recommend", "best plan for me", "what should i choose",
    "ساعدني اختار", "اي باقه تناسبني", "ما الانسب لي", "انصحني", "رشح لي", "شو بتنصحني", "ايش تنصحني", "اي باقه الافضل",
    "conseille moi", "recomiendame", "empfiehl mir", "bana oner", "посоветуйте", "порекомендуйте", "پیشنهاد بده", "مجھے مشورہ", "मुझे सुझाव", "sarankan", "consigliami", "recomenda me", "raad me aan", "polec mi", "gợi ý giúp", "পরামর্শ দিন", "推荐一个", "おすすめ", "추천해",
  ]],
  // ── The site, section by section, and what a plan opens (chatSiteGuideStrings.ts) ──
  ["tiers", [
    "difference between plans", "difference between the plans", "difference between", "compare plans", "compare the plans", "which plan", "what does basic include", "what s in basic", "basic plan", "pro plan", "business plan", "kids plan", "plan comparison", "what is included in",
    "الفرق بين الباقات", "ما الفرق", "ايش تشمل", "ماذا تشمل", "باقه بيزك", "باقه برو", "باقه بزنس", "اي باقه", "مقارنه",
    "quelle offre", "difference entre", "que plan", "diferencia entre", "unterschied", "welcher tarif", "hangi paket", "какой тариф", "разница", "تفاوت", "کدام طرح", "کون سا پلان", "सबसे अच्छा प्लान", "paket mana", "quale piano", "qual plano", "welk abonnement", "który plan", "gói nào", "কোন প্ল্যান", "哪个套餐", "どのプラン", "어떤 요금제",
  ]],
  ["benefits", [
    "benefits", "advantages", "why subscribe", "worth it", "what do i get", "what will i get", "what do subscribers get", "perks",
    "فوائد", "مميزات", "ماذا استفيد", "ماذا سأحصل", "لماذا اشترك", "شو بستفيد", "ايش الفايده", "فايده", "ميزات الاشتراك",
    "avantages", "pourquoi s abonner", "ventajas", "beneficios", "vorteile", "avantajlar", "neden abone", "преимущества", "что я получу", "مزایا", "چه سودی", "فائدہ", "फायदे", "manfaat", "keuntungan", "vantaggi", "benefici", "vantagens", "voordelen", "korzysci", "loi ich", "সুবিধা", "好处", "优势", "メリット", "特典", "혜택", "장점",
  ]],
  ["sections", [
    "sections", "what s on the site", "what is on the site", "site map", "what does the site have", "what services", "services do you have",
    "اقسام", "الاقسام", "ماذا يوجد في الموقع", "ايش في الموقع", "شو في الموقع", "محتوي الموقع", "خدمات الموقع",
    "rubriques", "secciones", "bereiche", "bolumler", "разделы", "بخش ها", "حصے", "सेक्शन", "bagian situs", "sezioni", "secoes", "onderdelen", "sekcje", "phan muc", "বিভাগ", "栏目", "板块", "セクション", "섹션",
  ]],
  ["academy", [
    "academy", "courses", "lessons", "اكاديميه", "دورات", "كورسات", "دروس", "cours", "curso", "kurs", "akademi", "академия", "курсы", "学院", "课程", "アカデミー", "講座", "아카데미", "강의",
  ]],
  ["library", [
    "library", "books", "audiobooks", "مكتبه", "كتب", "livres", "libros", "bucher", "kitap", "kutuphane", "книги", "библиотека", "图书馆", "ライブラリ", "도서관",
  ]],
  ["arcade", [
    "arcade", "games", "العاب", "لعبه", "jeux", "juegos", "spiele", "oyun", "игры", "游戏", "ゲーム", "게임",
  ]],
  ["kids", [
    "kids", "children", "visionkids", "اطفال", "طفل", "ولاد", "enfants", "ninos", "kinder", "cocuk", "дети", "儿童", "孩子", "子ども", "어린이",
  ]],
  ["marketplace", [
    "marketplace", "bazaar", "shop", "store", "سوق", "متجر", "تسوق", "boutique", "tienda", "markt", "pazar", "магазин", "маркет", "市集", "商店", "マーケット", "마켓",
  ]],
  ["free", [
    "what is free", "free features", "without subscription", "free access", "مجان", "مجاني", "بدون اشتراك", "gratuit", "gratis", "kostenlos", "ucretsiz", "бесплатно", "免费", "無料", "무료",
  ]],
  ["pro", [
    "career hub", "career", "jobs", "visionex tv", "live tv", "tv", "radio", "voice rooms", "simulations", "simulator",
    "وظائف", "توظيف", "تلفزيون", "راديو", "غرف صوتيه", "محاكاه", "emploi", "carrera", "karriere", "kariyer", "карьера", "职业", "求人", "커리어",
  ]],
  ["business", [
    "media studio", "ai media studio", "generate images", "generate video", "library studio", "publish a book", "professional tools", "file studio", "finance hub", "vx finance",
    "استوديو", "توليد صور", "توليد فيديو", "نشر كتاب", "ادوات مهنيه", "مركز مالي",
  ]],
  ["plans", [
    "plan", "plans", "price", "prices", "pricing", "cost", "subscribe", "subscription", "how much", "pay", "payment", "fee",
    "باقه", "باقات", "سعر", "اسعار", "كم سعر", "اشتراك", "اشترك", "ادفع", "دفع", "تكلفه", "بكم",
    "tarif", "prix", "abonnement", "precio", "suscripcion", "preis", "abonnieren", "fiyat", "abone", "цена", "тариф", "подписка", "قیمت", "اشتراک", "قیمت", "कीमत", "सब्सक्रिप्शन", "harga", "langganan", "prezzo", "abbonamento", "preco", "assinatura", "价格", "订阅", "料金", "価格", "가격", "구독", "cena", "subskrypcja", "gia", "đăng ký gói", "দাম", "সাবস্ক্রিপশন", "prijs",
  ]],
  ["accessibility", [
    "accessibility", "accessible", "blind", "screen reader", "nvda", "jaws", "voiceover", "talkback", "low vision", "visually impaired",
    "كفيف", "ضعاف البصر", "قارئ الشاشه", "قارئه الشاشه", "امكانيه الوصول", "ذوي الاعاقه", "اعاقه",
    "accesibilidad", "accessibilite", "barrierefrei", "erisilebilir", "доступность", "незрячий", "دسترس", "نابینا", "رسائی", "सुगम्य", "aksesibilitas", "accessibilita", "acessibilidade", "无障碍", "视障", "アクセシビリティ", "접근성", "dostepnosc", "khả năng tiếp cận", "প্রবেশগম্য", "toegankelijk",
  ]],
  ["languages", [
    "language", "languages", "arabic", "english", "translate", "translation",
    "لغه", "لغات", "ترجم", "عربي", "انجليزي",
    "idioma", "langue", "sprache", "dil", "язык", "زبان", "زبانیں", "भाषा", "bahasa", "lingua", "idiomas", "语言", "言語", "언어", "jezyk", "ngôn ngữ", "ভাষা", "taal",
  ]],
  ["features", [
    "what can you do", "what do you do", "features", "services", "what is included", "help me", "what can i do",
    "ماذا تفعل", "شو بتعمل", "ايش تسوي", "خدمات", "ميزات", "مميزات", "ماذا يوجد", "شو في", "وش عندكم",
    "que puedes hacer", "que peux tu faire", "was kannst du", "neler yapabilirsin", "что ты умеешь", "چه کاری", "आप क्या कर", "apa yang bisa", "cosa puoi fare", "o que voce faz", "你能做什么", "何ができ", "무엇을 할", "co potrafisz", "bạn làm được gì", "কী করতে পারেন", "wat kun je",
  ]],
  ["assistant", [
    // Hand-written core, then the mined words below are merged in.
    "weather", "forecast", "news headlines", "radio", "podcast", "playlist", "play some music", "play music", "what s the news", "reminder", "alarm", "play music", "play a song", "recipe", "traffic", "translate this", "set a timer",
    "الطقس", "الجو", "نشره الاخبار", "اخر الاخبار", "ذكرني", "منبه", "شغل", "اغنيه", "موسيقى", "وصفه", "طبخه", "ترجم لي", "مؤقت",
    "meteo", "quel temps", "tiempo hoy", "que tiempo hace", "wetter", "hava durumu", "погода", "новости", "آب و هوا", "موسم", "मौसम", "cuaca", "tempo", "previsioni", "날씨", "天気", "ニュース", "アラーム", "音楽", "レシピ", "天气", "新闻", "闹钟", "音乐", "食谱", "pogoda", "thời tiết", "আবহাওয়া", "weer",
  ]],
  ["about", [
    "what is visionex", "about visionex", "who are you", "what is this", "tell me about", "about you",
    "ما هو", "ما هي", "من انتم", "من انت", "عن visionex", "عنكم", "تعريف", "شو هاد", "شو هذا",
    "quien eres", "qui es tu", "wer bist du", "sen kimsin", "кто ты", "кто вы", "تو کی", "आप कौन", "siapa kamu", "chi sei", "quem e voce", "你是谁", "あなたは誰", "누구세요", "kim jestes", "bạn là ai", "আপনি কে", "wie ben je",
  ]],
  ["thanks", [
    "thanks", "thank you", "thx",
    "شكرا", "شكراً", "يعطيك العافيه", "مشكور", "تسلم",
    "gracias", "merci", "danke", "tesekkur", "sagol", "спасибо", "ممنون", "مرسی", "شکریہ", "धन्यवाद", "terima kasih", "grazie", "obrigado", "obrigada", "谢谢", "ありがとう", "감사", "dziekuje", "cảm ơn", "ধন্যবাদ", "bedankt",
  ]],
  ["greeting", [
    "hi", "hello", "hey", "good morning", "good evening", "start", "help",
    "مرحبا", "اهلا", "السلام عليكم", "سلام", "هلا", "صباح الخير", "مساء الخير", "هاي", "ابدا", "مساعده",
    "hola", "bonjour", "salut", "hallo", "guten tag", "merhaba", "привет", "здравствуйте", "درود", "नमस्ते", "halo", "ciao", "ola", "oi", "你好", "こんにちは", "안녕", "czesc", "xin chào", "হ্যালো", "hoi",
  ]],
];

const MAX_CHARS = 160;

/** Latin and Cyrillic keywords match whole words. Arabic-script, Indic, CJK and Hangul ones match anywhere: they take prefixes (ال, و) or have no spaces. */
const SCRIPTLESS = /[؀-ۿऀ-৿぀-ヿ㐀-鿿가-힯]/u;

// Words and phrases mined from MASSIVE (see scripts/lexicon): every language's
// list is merged, because a sender writes in a language the detector may not name.
const MINED: Partial<Record<FreeTopic, string[]>> = {
  greeting: Object.values(LEXICON).flatMap((l) => l.greeting),
  assistant: Object.values(LEXICON).flatMap((l) => l.assistant),
};

const COMPILED = TOPICS.map(
  ([topic, words]) => [topic, [...new Set([...words, ...(MINED[topic] ?? [])].map(fold).filter(Boolean))]] as const,
);

/** Topics that name something a plan opens, and the sections each one means. */
const INTEREST: Partial<Record<FreeTopic, readonly string[]>> = {
  academy: ["academy"],
  library: ["library"],
  arcade: ["arcade"],
  kids: ["kids"],
  marketplace: ["marketplace"],
  assistant: ["assistant"],
  pro: ["tv", "radio", "career"],
  business: ["mediaStudio"],
};

function matches(padded: string, words: readonly string[]): boolean {
  for (const w of words) if (SCRIPTLESS.test(w) ? padded.includes(w) : padded.includes(` ${w} `)) return true;
  return false;
}

/** The sections a message shows interest in (every matching topic, not just the first). */
export function interests(text: string | null | undefined): string[] {
  const raw = (text ?? "").trim();
  if (!raw || raw.length > MAX_CHARS) return [];
  const padded = ` ${fold(raw)} `;
  const out = new Set<string>();
  for (const [topic, words] of COMPILED) {
    const sections = INTEREST[topic];
    if (sections && matches(padded, words)) sections.forEach((x) => out.add(x));
  }
  return [...out];
}

/** The cheapest plan that covers every wanted section; Kids only if the children's world was asked for. */
export function recommendPlan(wanted: readonly string[]) {
  if (wanted.length === 0) return null;
  for (const plan of SITE_PLANS) {
    if (plan.id === "kids" && !wanted.includes("kids")) continue;
    if (wanted.every((w) => (plan.sections as readonly string[]).includes(w))) return plan;
  }
  return null;
}

/** Which topic the message is about, or "fallback". */
export function freeTopic(text: string | null | undefined): FreeTopic {
  const raw = (text ?? "").trim();
  if (!raw || raw.length > MAX_CHARS) return "fallback";
  const padded = ` ${fold(raw)} `;
  for (const [topic, words] of COMPILED) {
    for (const w of words) {
      if (SCRIPTLESS.test(w) ? padded.includes(w) : padded.includes(` ${w} `)) return topic;
    }
  }
  return "fallback";
}

function lang(language: string): SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language) ? (language as SupportedLanguage) : "en";
}

function fill(template: string, language: SupportedLanguage): string {
  return template
    .replaceAll("{basic}", String(SITE_PRICES.basic))
    .replaceAll("{pro}", String(SITE_PRICES.pro))
    .replaceAll("{business}", String(SITE_PRICES.business))
    .replaceAll("{kids}", String(SITE_PRICES.kids))
    .replaceAll("{plans}", PLANS_URL)
    .replaceAll("{site}", SITE_URL)
    .replaceAll("{here}", SIGNUP_STRINGS[language].here);
}

/** The whole reply: the answer, then the nudge. Never calls anything. */
export function freeReply(text: string | null | undefined, language: string): { topic: FreeTopic; body: string; plan?: string } {
  const l = lang(language);
  const topic = freeTopic(text);
  const pack = FREE_STRINGS[l];
  const discover = fill(DISCOVER_STRINGS[l].discover, l);

  // «help me choose» is only the question.
  if (topic === "choose") return { topic, body: `${discover}\n\n${fill(pack.footer, l)}` };

  const sentence = topic in GUIDE_STRINGS.en ? GUIDE_STRINGS[l][topic as GuideKey] : pack[topic as Exclude<FreeKey, "footer" | "choose">];
  const parts = [fill(sentence, l)];

  // Lead the conversation: if they named something a plan opens, recommend the plan
  // that covers it; if they did not, ask what they enjoy. Thanks and contact stay plain.
  const plan = recommendPlan(interests(text));
  if (plan) {
    parts.push(DISCOVER_STRINGS[l].recommend.replaceAll("{plan}", plan.name).replaceAll("{price}", String(plan.price)));
  } else if (topic !== "thanks" && topic !== "contact") {
    parts.push(discover);
  }
  // A plans answer already carries the link; the footer would repeat it.
  if (topic !== "plans") parts.push(fill(pack.footer, l));
  return { topic, body: parts.join("\n\n"), ...(plan ? { plan: plan.id } : {}) };
}
