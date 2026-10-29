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
import { FREE_STRINGS, type FreeKey } from "./chatFreeRepliesStrings.ts";
import { SIGNUP_STRINGS } from "./chatSignupStrings.ts";
import { PLANS_URL } from "./whatsappEntitlements.ts";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./whatsappLanguages.ts";

export const SITE_URL = "https://visionex.app";

export type FreeTopic = Exclude<FreeKey, "footer">;

/** Checked in this order: the first topic with a matching keyword wins. */
const TOPICS: ReadonlyArray<readonly [Exclude<FreeTopic, "fallback">, readonly string[]]> = [
  ["contact", [
    "contact", "contact us", "support", "email you", "phone number", "call you", "talk to someone",
    "تواصل", "اتصل", "رقم الهاتف", "دعم فني", "الدعم الفني", "خدمة العملاء", "كلم", "تكلم",
    "contacto", "contacter", "kontakt", "iletisim", "связаться", "контакт", "تماس", "رابطہ", "संपर्क", "kontak", "contatto", "contato", "联系", "お問い合わせ", "문의",
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

const COMPILED = TOPICS.map(([topic, words]) => [topic, words.map(fold).filter(Boolean)] as const);

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
    .replaceAll("{plans}", PLANS_URL)
    .replaceAll("{site}", SITE_URL)
    .replaceAll("{here}", SIGNUP_STRINGS[language].here);
}

/** The whole reply: the answer, then the nudge. Never calls anything. */
export function freeReply(text: string | null | undefined, language: string): { topic: FreeTopic; body: string } {
  const l = lang(language);
  const topic = freeTopic(text);
  const pack = FREE_STRINGS[l];
  // A plans answer already carries the link; the footer would repeat it.
  const footer = topic === "plans" ? "" : `\n\n${fill(pack.footer, l)}`;
  return { topic, body: `${fill(pack[topic], l)}${footer}` };
}
