/**
 * news-generate — Daily AI news generation + newsletter dispatch
 *
 * Auth: Bearer CRON_SECRET
 *
 * Flow:
 *  1. Call 1 — Generate one article per category (see CATEGORIES) in English + Arabic (full: title, description, content)
 *  2. Call 2 — Translate title + description to 9 more languages (es,de,pt,zh,tr,fr,ru,ur,hi)
 *  3. Merge into translations JSONB and insert into news_articles
 *  4. Send personalised digest to newsletter_subscribers in their language via Resend
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// "breaking" is excluded from the newsletter loop below (§5) — it's a
// page-only, AI-generated section for urgent/time-sensitive items, never
// emailed to subscribers.
const CATEGORIES = [
  { key: "breaking",      nameEn: "Breaking News",              nameAr: "أخبار عاجلة",              icon: "AlertTriangle" },
  { key: "technology",    nameEn: "Technology & Innovation",    nameAr: "التكنولوجيا والابتكار",    icon: "Cpu" },
  { key: "ai",            nameEn: "Artificial Intelligence",    nameAr: "الذكاء الاصطناعي",         icon: "Brain" },
  { key: "marketplace",   nameEn: "E-Commerce & Marketplace",   nameAr: "التجارة الإلكترونية",       icon: "ShoppingBag" },
  { key: "games",         nameEn: "Games & Entertainment",      nameAr: "الألعاب والترفيه",         icon: "Gamepad2" },
  { key: "academy",       nameEn: "Education & Training",       nameAr: "التعليم والتدريب",         icon: "GraduationCap" },
  { key: "health",        nameEn: "Health & Medicine",          nameAr: "الصحة والطب",              icon: "Heart" },
  { key: "legal",         nameEn: "Law & Rights",               nameAr: "القانون والحقوق",          icon: "Scale" },
  { key: "business",      nameEn: "Business & Economy",         nameAr: "الأعمال والاقتصاد",        icon: "TrendingUp" },
  { key: "travel",        nameEn: "Travel & Tourism",           nameAr: "السفر والسياحة",           icon: "Plane" },
  { key: "beauty",        nameEn: "Beauty & Lifestyle",         nameAr: "الجمال وأسلوب الحياة",     icon: "Sparkles" },
  { key: "sports",        nameEn: "Sports & Fitness",           nameAr: "الرياضة واللياقة",         icon: "Trophy" },
  { key: "music",         nameEn: "Music & Arts",               nameAr: "الموسيقى والفنون",         icon: "Music" },
  { key: "psychology",    nameEn: "Psychology & Mental Health", nameAr: "الصحة النفسية",            icon: "SmilePlus" },
  { key: "community",     nameEn: "Community & Social",         nameAr: "المجتمع والتواصل",         icon: "Globe" },
  { key: "accessibility", nameEn: "Accessibility",              nameAr: "إمكانية الوصول",           icon: "Accessibility" },
  { key: "platform",      nameEn: "Platform Updates",           nameAr: "تحديثات المنصة",           icon: "Rocket" },
  { key: "entertainment", nameEn: "Live TV & Radio",            nameAr: "البث المباشر والترفيه",     icon: "Tv" },
  { key: "nutrition",     nameEn: "Nutrition & Wellness",       nameAr: "التغذية والعافية",          icon: "Apple" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];
type SupportedLang = "en" | "ar" | "es" | "de" | "pt" | "zh" | "tr" | "fr" | "ru" | "ur" | "hi";

const RTL_LANGS: SupportedLang[] = ["ar", "ur"];

interface ArticleFull  { title: string; description: string; content: string }
interface ArticleShort { title: string; description: string }

type TranslationMap = {
  en: ArticleFull;
  ar: ArticleFull;
} & Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>;

interface GeneratedArticle {
  category: CategoryKey;
  translations: TranslationMap;
}

// ── Email static strings per language ────────────────────────────────────────

const EMAIL_STRINGS: Record<SupportedLang, { title: string; intro: string; cta: string }> = {
  en: { title: "Daily News Digest",          intro: "Here are today's top stories selected for you:",         cta: "Read all news" },
  ar: { title: "النشرة الإخبارية اليومية",  intro: "إليك أبرز أخبار اليوم المختارة لك:",                    cta: "قراءة كل الأخبار" },
  es: { title: "Resumen diario de noticias", intro: "Aquí están las principales noticias de hoy para ti:",    cta: "Leer todas las noticias" },
  de: { title: "Tägliche Nachrichtenübersicht", intro: "Hier sind die Top-Nachrichten des Tages für dich:",   cta: "Alle Nachrichten lesen" },
  pt: { title: "Resumo diário de notícias",  intro: "Aqui estão as principais notícias de hoje para você:",  cta: "Ler todas as notícias" },
  zh: { title: "每日新闻摘要",                intro: "以下是今天为您精选的热点新闻：",                          cta: "阅读所有新闻" },
  tr: { title: "Günlük Haber Özeti",         intro: "İşte bugün sizin için seçilen önemli haberler:",         cta: "Tüm haberleri oku" },
  fr: { title: "Résumé quotidien des actualités", intro: "Voici les principales actualités du jour pour vous:", cta: "Lire toutes les actualités" },
  ru: { title: "Ежедневный дайджест новостей", intro: "Вот главные новости дня, выбранные для вас:",          cta: "Читать все новости" },
  ur: { title: "روزانہ خبروں کا خلاصہ",     intro: "آج کی اہم خبریں جو آپ کے لیے منتخب کی گئی ہیں:",      cta: "تمام خبریں پڑھیں" },
  hi: { title: "दैनिक समाचार सारांश",        intro: "आज की शीर्ष खबरें जो आपके लिए चुनी गई हैं:",          cta: "सभी समाचार पढ़ें" },
};

// Warm per-subscriber greeting, shown above everything else. Generic
// fallback for subscribers who never gave a name.
const GREETINGS: Record<SupportedLang, string> = {
  en: "Hello! We hope you're doing well today.",
  ar: "مرحبًا! نتمنى أن تكون بخير اليوم.",
  es: "¡Hola! Esperamos que estés muy bien hoy.",
  de: "Hallo! Wir hoffen, es geht dir heute gut.",
  pt: "Olá! Esperamos que você esteja bem hoje.",
  zh: "你好！希望你今天一切顺利。",
  tr: "Merhaba! Bugün iyi olduğunu umuyoruz.",
  fr: "Bonjour ! Nous espérons que vous allez bien aujourd'hui.",
  ru: "Здравствуйте! Надеемся, у вас сегодня всё хорошо.",
  ur: "السلام علیکم! امید ہے آپ آج بخیر ہوں گے۔",
  hi: "नमस्ते! उम्मीद है आप आज अच्छे होंगे।",
};

// Used instead of GREETINGS when the subscriber gave their name.
const GREETINGS_NAMED: Record<SupportedLang, string> = {
  en: "Hello, {name}! We hope you're doing well today.",
  ar: "مرحبًا {name}! نتمنى أن تكون بخير اليوم.",
  es: "¡Hola, {name}! Esperamos que estés muy bien hoy.",
  de: "Hallo {name}! Wir hoffen, es geht dir heute gut.",
  pt: "Olá, {name}! Esperamos que você esteja bem hoje.",
  zh: "你好，{name}！希望你今天一切顺利。",
  tr: "Merhaba {name}! Bugün iyi olduğunu umuyoruz.",
  fr: "Bonjour {name} ! Nous espérons que vous allez bien aujourd'hui.",
  ru: "Здравствуйте, {name}! Надеемся, у вас сегодня всё хорошо.",
  ur: "السلام علیکم {name}! امید ہے آپ آج بخیر ہوں گے۔",
  hi: "नमस्ते {name}! उम्मीद है आप आज अच्छे होंगे।",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}

const QUOTE_LABEL: Record<SupportedLang, string> = {
  en: "Quote of the Day", ar: "مقولة اليوم", es: "Frase del Día", de: "Zitat des Tages",
  pt: "Frase do Dia", zh: "每日一语", tr: "Günün Sözü", fr: "Citation du Jour",
  ru: "Цитата дня", ur: "آج کا اقتباس", hi: "आज का विचार",
};

// Rotates by day-of-year so every subscriber gets the same quote on a given
// day, regardless of language — picked once per invocation, not per article.
const DAILY_QUOTES: Record<SupportedLang, string>[] = [
  { en: "Today is a fresh page — write something good on it.", ar: "اليوم صفحة جديدة — اكتب فيها شيئًا جميلًا.", es: "Hoy es una página en blanco — escribe algo bueno en ella.", de: "Heute ist eine neue Seite — schreibe etwas Gutes hinein.", pt: "Hoje é uma página em branco — escreva algo bom nela.", zh: "今天是崭新的一页——在上面写下美好的事情吧。", tr: "Bugün yepyeni bir sayfa — üzerine güzel bir şey yaz.", fr: "Aujourd'hui est une page vierge — écrivez-y quelque chose de beau.", ru: "Сегодня — чистая страница. Напишите на ней что-то хорошее.", ur: "آج ایک نیا صفحہ ہے — اس پر کچھ اچھا لکھیں۔", hi: "आज एक नया पन्ना है — इस पर कुछ अच्छा लिखिए।" },
  { en: "Small steps, taken daily, lead to big changes.", ar: "الخطوات الصغيرة، إذا تكررت يوميًا، تؤدي إلى تغييرات كبيرة.", es: "Los pequeños pasos, tomados a diario, llevan a grandes cambios.", de: "Kleine Schritte, täglich gegangen, führen zu großen Veränderungen.", pt: "Pequenos passos, dados diariamente, levam a grandes mudanças.", zh: "每天坚持的小小努力，终将带来巨大的改变。", tr: "Her gün atılan küçük adımlar büyük değişimlere yol açar.", fr: "De petits pas, faits chaque jour, mènent à de grands changements.", ru: "Маленькие шаги, сделанные каждый день, приводят к большим переменам.", ur: "روزانہ اٹھائے گئے چھوٹے قدم بڑی تبدیلیوں کی طرف لے جاتے ہیں۔", hi: "रोज़ उठाए गए छोटे कदम बड़े बदलाव लाते हैं।" },
  { en: "Your potential is greater than any challenge you'll face today.", ar: "قدراتك أكبر من أي تحدٍ ستواجهه اليوم.", es: "Tu potencial es mayor que cualquier desafío que enfrentarás hoy.", de: "Dein Potenzial ist größer als jede Herausforderung, der du heute begegnest.", pt: "Seu potencial é maior do que qualquer desafio que você enfrentará hoje.", zh: "你的潜力远大于今天将面对的任何挑战。", tr: "Potansiyelin, bugün karşılaşacağın her zorluktan daha büyük.", fr: "Votre potentiel est plus grand que n'importe quel défi que vous rencontrerez aujourd'hui.", ru: "Ваш потенциал больше, чем любая трудность, с которой вы столкнётесь сегодня.", ur: "آپ کی صلاحیت آج کے کسی بھی چیلنج سے بڑی ہے۔", hi: "आपकी क्षमता आज आने वाली किसी भी चुनौती से बड़ी है।" },
  { en: "Progress, not perfection, is what moves you forward.", ar: "التقدم، لا الكمال، هو ما يدفعك إلى الأمام.", es: "El progreso, no la perfección, es lo que te hace avanzar.", de: "Fortschritt, nicht Perfektion, bringt dich voran.", pt: "Progresso, não perfeição, é o que te faz avançar.", zh: "推动你前进的是进步，而不是完美。", tr: "Seni ileriye taşıyan mükemmellik değil, ilerlemedir.", fr: "C'est le progrès, pas la perfection, qui vous fait avancer.", ru: "Не совершенство, а прогресс движет вас вперёд.", ur: "کمال نہیں، پیش رفت ہی آپ کو آگے بڑھاتی ہے۔", hi: "पूर्णता नहीं, प्रगति ही आपको आगे बढ़ाती है।" },
  { en: "Every sunrise is a new chance to begin again.", ar: "كل شروق شمس هو فرصة جديدة للبدء من جديد.", es: "Cada amanecer es una nueva oportunidad para comenzar de nuevo.", de: "Jeder Sonnenaufgang ist eine neue Chance, neu zu beginnen.", pt: "Cada nascer do sol é uma nova chance de recomeçar.", zh: "每一次日出都是重新开始的新机会。", tr: "Her gün doğuşu yeniden başlamak için yeni bir fırsattır.", fr: "Chaque lever de soleil est une nouvelle chance de recommencer.", ru: "Каждый рассвет — это новый шанс начать заново.", ur: "ہر طلوعِ آفتاب دوبارہ شروع کرنے کا ایک نیا موقع ہے۔", hi: "हर सूर्योदय फिर से शुरुआत करने का एक नया मौका है।" },
  { en: "Believe in your ability to figure things out as you go.", ar: "ثق بقدرتك على إيجاد الحلول كلما تقدمت في طريقك.", es: "Confía en tu capacidad para resolver las cosas sobre la marcha.", de: "Vertraue darauf, dass du die Dinge unterwegs herausfinden wirst.", pt: "Confie na sua capacidade de resolver as coisas ao longo do caminho.", zh: "相信自己有能力在前行的过程中解决问题。", tr: "İlerledikçe işleri çözebileceğine inan.", fr: "Croyez en votre capacité à trouver des solutions au fur et à mesure.", ru: "Верьте в свою способность разбираться с трудностями по ходу дела.", ur: "اپنی اس صلاحیت پر یقین رکھیں کہ آپ آگے بڑھتے ہوئے راستہ خود تلاش کر لیں گے۔", hi: "आगे बढ़ते हुए रास्ता खुद खोज लेने की अपनी क्षमता पर भरोसा रखें।" },
  { en: "Kindness today is a gift that returns to you tomorrow.", ar: "اللطف اليوم هدية تعود إليك غدًا.", es: "La amabilidad de hoy es un regalo que vuelve a ti mañana.", de: "Freundlichkeit heute ist ein Geschenk, das morgen zu dir zurückkehrt.", pt: "A gentileza de hoje é um presente que volta para você amanhã.", zh: "今天的善意，是明天回馈给你的礼物。", tr: "Bugünkü nezaket, yarın sana geri dönen bir hediyedir.", fr: "La gentillesse d'aujourd'hui est un cadeau qui vous revient demain.", ru: "Доброта сегодня — это подарок, который вернётся к вам завтра.", ur: "آج کی مہربانی وہ تحفہ ہے جو کل آپ کے پاس لوٹ کر آتا ہے۔", hi: "आज की दयालुता वह उपहार है जो कल आपके पास लौट आता है।" },
  { en: "The best time to start was yesterday. The next best time is now.", ar: "أفضل وقت للبدء كان بالأمس، وثاني أفضل وقت هو الآن.", es: "El mejor momento para empezar fue ayer. El siguiente mejor momento es ahora.", de: "Der beste Zeitpunkt zum Anfangen war gestern. Der zweitbeste ist jetzt.", pt: "O melhor momento para começar foi ontem. O próximo melhor momento é agora.", zh: "开始的最佳时机是昨天，其次是现在。", tr: "Başlamak için en iyi zaman dündü. Bir sonraki en iyi zaman ise şimdi.", fr: "Le meilleur moment pour commencer était hier. Le second meilleur moment, c'est maintenant.", ru: "Лучшее время начать было вчера. Следующее по важности — сейчас.", ur: "شروع کرنے کا بہترین وقت کل تھا، اور دوسرا بہترین وقت ابھی ہے۔", hi: "शुरू करने का सबसे अच्छा समय कल था। अगला सबसे अच्छा समय अभी है।" },
  { en: "You don't have to see the whole staircase, just take the first step.", ar: "لست بحاجة لرؤية السلم كاملًا، فقط اخطُ الخطوة الأولى.", es: "No tienes que ver toda la escalera, solo da el primer paso.", de: "Du musst nicht die ganze Treppe sehen, mach einfach den ersten Schritt.", pt: "Você não precisa ver toda a escada, apenas dê o primeiro passo.", zh: "你不需要看清整段楼梯，只需迈出第一步。", tr: "Tüm merdiveni görmene gerek yok, sadece ilk adımı at.", fr: "Vous n'avez pas besoin de voir tout l'escalier, faites juste le premier pas.", ru: "Не обязательно видеть всю лестницу — просто сделайте первый шаг.", ur: "آپ کو پوری سیڑھی دیکھنے کی ضرورت نہیں، بس پہلا قدم اٹھائیں۔", hi: "आपको पूरी सीढ़ी देखने की ज़रूरत नहीं, बस पहला कदम उठाइए।" },
  { en: "A positive mindset turns obstacles into opportunities.", ar: "العقلية الإيجابية تحوّل العقبات إلى فرص.", es: "Una mentalidad positiva convierte los obstáculos en oportunidades.", de: "Eine positive Einstellung verwandelt Hindernisse in Chancen.", pt: "Uma mentalidade positiva transforma obstáculos em oportunidades.", zh: "积极的心态能把障碍变成机遇。", tr: "Olumlu bir bakış açısı engelleri fırsatlara dönüştürür.", fr: "Un état d'esprit positif transforme les obstacles en opportunités.", ru: "Позитивный настрой превращает препятствия в возможности.", ur: "مثبت سوچ رکاوٹوں کو مواقع میں بدل دیتی ہے۔", hi: "सकारात्मक सोच बाधाओं को अवसरों में बदल देती है।" },
  { en: "Growth happens outside your comfort zone — lean into it today.", ar: "النمو يحدث خارج منطقة الراحة — تقبّل ذلك اليوم.", es: "El crecimiento ocurre fuera de tu zona de confort — atrévete hoy.", de: "Wachstum geschieht außerhalb deiner Komfortzone — wage es heute.", pt: "O crescimento acontece fora da zona de conforto — arrisque-se hoje.", zh: "成长发生在舒适圈之外——今天就勇敢迈出去吧。", tr: "Gelişim, konfor alanının dışında gerçekleşir — bugün bunu göze al.", fr: "La croissance se produit en dehors de votre zone de confort — osez aujourd'hui.", ru: "Рост происходит за пределами зоны комфорта — сделайте шаг туда сегодня.", ur: "ترقی آپ کے آرام دہ دائرے سے باہر ہوتی ہے — آج اسے اپنائیں۔", hi: "विकास आपके कम्फर्ट ज़ोन से बाहर होता है — आज इसे अपनाइए।" },
  { en: "Consistency beats intensity — show up for yourself today.", ar: "الاستمرارية أقوى من الاندفاع اللحظي — كن حاضرًا لنفسك اليوم.", es: "La constancia vence a la intensidad — preséntate para ti mismo hoy.", de: "Beständigkeit schlägt Intensität — sei heute für dich selbst da.", pt: "A constância vence a intensidade — apareça para si mesmo hoje.", zh: "坚持胜过一时的冲劲——今天为自己出席。", tr: "Süreklilik, yoğunluktan daha değerlidir — bugün kendin için orada ol.", fr: "La régularité l'emporte sur l'intensité — présentez-vous pour vous-même aujourd'hui.", ru: "Постоянство важнее интенсивности — будьте сегодня рядом с собой.", ur: "تسلسل شدت پر غالب آتا ہے — آج اپنے لیے حاضر رہیں۔", hi: "निरंतरता तीव्रता पर भारी पड़ती है — आज खुद के लिए मौजूद रहिए।" },
  { en: "Your best days are built one good decision at a time.", ar: "أفضل أيامك تُبنى بقرار جيد واحد في كل مرة.", es: "Tus mejores días se construyen con una buena decisión a la vez.", de: "Deine besten Tage entstehen durch eine gute Entscheidung nach der anderen.", pt: "Seus melhores dias são construídos com uma boa decisão de cada vez.", zh: "你最好的日子，是由一个个正确的决定累积而成的。", tr: "En iyi günlerin, bir seferde bir iyi kararla inşa edilir.", fr: "Vos meilleurs jours se construisent une bonne décision à la fois.", ru: "Ваши лучшие дни строятся из хороших решений, принятых одно за другим.", ur: "آپ کے بہترین دن ایک وقت میں ایک اچھے فیصلے سے تعمیر ہوتے ہیں۔", hi: "आपके सबसे अच्छे दिन एक-एक अच्छे फैसले से बनते हैं।" },
  { en: "Gratitude turns what you have into enough.", ar: "الامتنان يحوّل ما تملكه إلى كافٍ.", es: "La gratitud convierte lo que tienes en suficiente.", de: "Dankbarkeit macht das, was du hast, zu genug.", pt: "A gratidão transforma o que você tem em suficiente.", zh: "感恩能让你拥有的一切都变得足够。", tr: "Şükran, sahip olduğun şeyi yeterli hale getirir.", fr: "La gratitude transforme ce que vous avez en suffisance.", ru: "Благодарность превращает то, что у вас есть, в достаточное.", ur: "شکرگزاری آپ کے پاس موجود چیز کو کافی بنا دیتی ہے۔", hi: "कृतज्ञता आपके पास जो है उसे पर्याप्त बना देती है।" },
];

function quoteOfTheDay(now: Date): Record<SupportedLang, string> {
  const dayOfYear = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000,
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

// ── AI Call 1: Generate en + ar (full articles) ───────────────────────────────

async function generateEnAr(dateEn: string): Promise<Array<{ category: CategoryKey; en: ArticleFull; ar: ArticleFull }>> {
  const categoryList = CATEGORIES.map((c) => `"${c.key}": ${c.nameEn} / ${c.nameAr}`).join("\n");

  const prompt = `You are a professional news editor for Visionex, a multilingual tech platform. Today is ${dateEn}.

Write one informative news article per category in BOTH English and Arabic.

Categories:
${categoryList}

Special instruction for the "breaking" category: unlike the others, this is
not a topic domain — write it as genuinely urgent, time-sensitive breaking
news (a major platform incident, a significant real-world development, an
urgent security/regulatory update). It should read as urgent, not routine.

Category accuracy is critical: each article's "category" field must be the
exact key of the topic its content is actually about — never place a story
under a category it doesn't genuinely belong to just to fill a slot, and
never swap two categories' content between each other. If you are unsure a
real-world event fits a category, write a general educational piece
strictly about that category's own topic instead.

Return ONLY this JSON (no extra text):
{
  "articles": [
    {
      "category": "technology",
      "en": { "title": "5-10 word title", "description": "15-30 word summary", "content": "2-3 paragraph article body, 120-200 words" },
      "ar": { "title": "عنوان 5-10 كلمات", "description": "ملخص 15-30 كلمة", "content": "نص المقال فقرتان أو ثلاث، 120-200 كلمة" }
    }
  ]
}

Write one article for each of the ${CATEGORIES.length} categories. Journalistic, neutral, informative tone.`;

  return await aiCall(prompt, 16000);
}

// ── AI Call 2: Translate title + description to 9 languages ──────────────────

async function translateToOtherLangs(
  articles: Array<{ category: CategoryKey; en: ArticleFull }>,
): Promise<Record<CategoryKey, Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>>> {
  const input = articles.map((a) => ({
    category: a.category,
    title: a.en.title,
    description: a.en.description,
  }));

  const prompt = `Translate the following ${input.length} news article titles and descriptions from English into these 9 languages:
- es (Spanish), de (German), pt (Portuguese), zh (Chinese Simplified),
  tr (Turkish), fr (French), ru (Russian), ur (Urdu), hi (Hindi)

Articles:
${JSON.stringify(input)}

Return ONLY this JSON (no extra text):
{
  "translations": [
    {
      "category": "technology",
      "es": { "title": "...", "description": "..." },
      "de": { "title": "...", "description": "..." },
      "pt": { "title": "...", "description": "..." },
      "zh": { "title": "...", "description": "..." },
      "tr": { "title": "...", "description": "..." },
      "fr": { "title": "...", "description": "..." },
      "ru": { "title": "...", "description": "..." },
      "ur": { "title": "...", "description": "..." },
      "hi": { "title": "...", "description": "..." }
    }
  ]
}`;

  const result = await aiCall(prompt, 12000);
  // Build a map: category → { es: {...}, de: {...}, ... }
  const map: Record<string, Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>> = {};
  for (const row of result) {
    map[row.category] = row;
    delete (map[row.category] as Record<string, unknown>)["category"];
  }
  return map as Record<CategoryKey, Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>>;
}

// ── Generic AI caller ─────────────────────────────────────────────────────────

async function aiCall(prompt: string, maxTokens: number): Promise<// deno-lint-ignore no-explicit-any
any[]> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    // Return whichever top-level array exists
    return parsed.articles ?? parsed.translations ?? [];
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text: string = data.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in Anthropic response");
    const parsed = JSON.parse(match[0]);
    return parsed.articles ?? parsed.translations ?? [];
  }

  throw new Error("No AI API key — set OPENAI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets");
}

// ── Email Builder ─────────────────────────────────────────────────────────────

function buildDigestEmail(
  articles: GeneratedArticle[],
  lang: SupportedLang,
  dateStr: string,
  quote: Record<SupportedLang, string>,
  subscriberName?: string | null,
): string {
  const isRtl = RTL_LANGS.includes(lang);
  const dir = isRtl ? "rtl" : "ltr";
  const str = EMAIL_STRINGS[lang] ?? EMAIL_STRINGS.en;
  const greeting = subscriberName
    ? (GREETINGS_NAMED[lang] ?? GREETINGS_NAMED.en).replace("{name}", escapeHtml(subscriberName))
    : (GREETINGS[lang] ?? GREETINGS.en);
  const quoteLabel = QUOTE_LABEL[lang] ?? QUOTE_LABEL.en;
  const quoteText = quote[lang] ?? quote.en;

  const articlesHtml = articles.map((a) => {
    const tr = a.translations[lang] ?? a.translations.en;
    const cat = CATEGORIES.find((c) => c.key === a.category);
    const catName = lang === "ar" ? (cat?.nameAr ?? a.category) : (cat?.nameEn ?? a.category);
    const accent = isRtl ? "border-right:4px solid #6d28d9" : "border-left:4px solid #6d28d9";
    return `
      <div style="margin-bottom:24px;padding:20px;border:1px solid #e5e7eb;border-radius:10px;${accent}">
        <p style="margin:0 0 4px;font-size:11px;color:#6d28d9;font-weight:700;text-transform:uppercase">${catName}</p>
        <h2 style="margin:0 0 8px;font-size:17px;color:#111827;font-weight:700;line-height:1.4">${tr.title}</h2>
        <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.65">${tr.description}</p>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:620px;margin:auto">
    <div style="background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0">
      <div style="font-size:44px">📰</div>
      <h1 style="color:#fff;margin:12px 0 4px;font-size:22px;font-weight:800">${str.title}</h1>
      <p style="color:#c4b5fd;margin:0;font-size:14px">${dateStr} · Visionex</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
      <p style="color:#111827;font-size:16px;font-weight:600;margin:0 0 20px">${greeting}</p>
      <div style="margin:0 0 24px;padding:18px 20px;background:#f5f3ff;border-radius:10px;text-align:center">
        <p style="margin:0 0 6px;font-size:11px;color:#6d28d9;font-weight:700;text-transform:uppercase;letter-spacing:0.04em">${quoteLabel}</p>
        <p style="margin:0;font-size:15px;color:#4c1d95;font-style:italic;line-height:1.6">${quoteText}</p>
      </div>
      <p style="color:#374151;font-size:15px;margin:0 0 24px">${str.intro}</p>
      ${articlesHtml}
      <div style="margin-top:28px;text-align:center">
        <a href="https://visionex.app/news" style="background:#6d28d9;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">${str.cta}</a>
      </div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px">
        <p style="margin:0">© 2026 <a href="https://visionex.app" style="color:#6d28d9;text-decoration:none">Visionex</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";

  // Allow cron secret OR admin JWT
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`;
  let isAdmin = false;

  if (!isCron) {
    // Check if caller is an authenticated admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false }, global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const { data: profile } = await userClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
    }
  }

  if (!isCron && !isAdmin) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const dateEn = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  // calendar: "gregory" forced explicitly — "ar-SA" resolves to the Hijri
  // calendar in some ICU builds (Deno's included), which silently produced
  // Hijri dates in Arabic-language newsletter emails.
  const dateAr = now.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric", calendar: "gregory" });

  // newsletter_only=true: skip generation, just send emails for today's articles
  const url = new URL(req.url);
  const newsletterOnly = url.searchParams.get("newsletter_only") === "true"
    || req.headers.get("x-newsletter-only") === "true";

  let articles: GeneratedArticle[] = [];

  if (!newsletterOnly) {
    // Skip generation if today's articles already exist (e.g. this endpoint
    // called twice in one day) — otherwise every call inserts a duplicate batch.
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const { count: existingCount } = await supabase
      .from("news_articles")
      .select("id", { count: "exact", head: true })
      .gte("published_at", todayStart);
    if (existingCount && existingCount > 0) {
      return Response.json({ generated: 0, note: "Articles for today already exist — skipped to avoid duplicates" }, { headers: CORS });
    }

    // ── 1. Generate en + ar (full articles) ──────────────────────────────────
    let enArArticles: Awaited<ReturnType<typeof generateEnAr>>;
    try {
      enArArticles = await generateEnAr(dateEn);
    } catch (err) {
      console.error("[news-generate] Call 1 failed:", err);
      return Response.json({ error: "AI generation failed", details: String(err) }, { status: 500, headers: CORS });
    }

    const validEnAr = enArArticles.filter(
      (a) => CATEGORIES.some((c) => c.key === a.category) && a.en?.title && a.ar?.title,
    );

    if (validEnAr.length === 0) {
      return Response.json({ error: "AI returned no valid articles" }, { status: 500, headers: CORS });
    }

    // ── 2. Translate title + description to 9 more languages ─────────────────
    let extraTranslations: Record<CategoryKey, Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>> = {} as never;
    try {
      extraTranslations = await translateToOtherLangs(validEnAr);
    } catch (err) {
      console.warn("[news-generate] Call 2 (translations) failed, continuing without extra langs:", err);
    }

    // ── 3. Merge into final articles ──────────────────────────────────────────
    articles = validEnAr.map((a) => ({
      category: a.category,
      translations: {
        en: a.en,
        ar: a.ar,
        ...(extraTranslations[a.category] ?? {}),
      } as TranslationMap,
    }));

    // ── 4. Build DB rows ───────────────────────────────────────────────────────
    const rows = articles.map((a) => ({
      title:        a.translations.en.title,
      description:  a.translations.en.description,
      content:      a.translations.en.content,
      category:     a.category,
      icon_name:    CATEGORIES.find((c) => c.key === a.category)!.icon,
      published:    true,
      published_at: now.toISOString(),
      translations: a.translations,
    }));

    const { error: insertErr } = await supabase.from("news_articles").insert(rows);
    if (insertErr) {
      console.error("[news-generate] insert error:", insertErr);
      return Response.json({ error: "DB insert failed", details: insertErr.message }, { status: 500, headers: CORS });
    }
    console.log(`[news-generate] inserted ${rows.length} articles in 11 languages`);
  } else {
    // Fetch today's articles from DB for newsletter
    const today = now.toISOString().split("T")[0];
    const { data: todayArticles } = await supabase
      .from("news_articles")
      .select("category, translations")
      .gte("published_at", `${today}T00:00:00Z`)
      .eq("published", true);

    if (!todayArticles?.length) {
      return Response.json({ emailsSent: 0, note: "No articles found for today" }, { headers: CORS });
    }

    articles = todayArticles.map((row) => ({
      category: row.category as CategoryKey,
      translations: row.translations as TranslationMap,
    }));
  }

  // ── 5. Send newsletter digests ────────────────────────────────────────────
  // "breaking" is page-only — never emailed, no matter what a subscriber picked.
  const newsletterArticles = articles.filter((a) => a.category !== "breaking");

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return Response.json({ generated: articles.length, emailsSent: 0, note: "RESEND_API_KEY not configured" }, { headers: CORS });
  }

  const todayDateStr = now.toISOString().split("T")[0];

  const { data: allSubscribers } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, topics, lang, name, last_sent_date");

  // Guard against double-sends (manual retry, or the schedule firing twice
  // in one day): skip anyone already emailed today rather than sending again.
  const subscribers = (allSubscribers ?? []).filter((s) => s.last_sent_date !== todayDateStr);
  const alreadySent = (allSubscribers?.length ?? 0) - subscribers.length;
  if (alreadySent > 0) {
    console.log(`[news-generate] skipping ${alreadySent} subscriber(s) already emailed today`);
  }

  if (!subscribers.length || newsletterArticles.length === 0) {
    return Response.json({ generated: articles.length, emailsSent: 0 }, { headers: CORS });
  }

  const FROM = Deno.env.get("RESEND_FROM") ?? "Visionex News <news@visionex.app>";
  const EMAIL_SUBJECTS: Record<SupportedLang, string> = {
    en: `📰 Visionex Daily News — ${dateEn}`,
    ar: `📰 أخبار Visionex اليومية — ${dateAr}`,
    es: `📰 Noticias diarias de Visionex — ${dateEn}`,
    de: `📰 Visionex Tagesnachrichten — ${dateEn}`,
    pt: `📰 Notícias diárias da Visionex — ${dateEn}`,
    zh: `📰 Visionex 每日新闻 — ${dateEn}`,
    tr: `📰 Visionex Günlük Haberler — ${dateEn}`,
    fr: `📰 Actualités quotidiennes Visionex — ${dateEn}`,
    ru: `📰 Ежедневные новости Visionex — ${dateEn}`,
    ur: `📰 Visionex روزانہ خبریں — ${dateAr}`,
    hi: `📰 Visionex दैनिक समाचार — ${dateEn}`,
  };

  let emailsSent = 0;
  let emailsFailed = 0;
  let lastError: string | undefined;
  const todaysQuote = quoteOfTheDay(now);
  const sentIds: string[] = [];

  for (const sub of subscribers) {
    const subTopics: string[] = sub.topics ?? [];
    // English fallback (not Arabic) for subscribers with no recorded
    // language preference — defaulting an unknown subscriber to Arabic
    // isn't "their language", it's just a guess, and English is the more
    // neutral one when we genuinely don't know.
    const subLang: SupportedLang = (sub.lang in EMAIL_STRINGS) ? sub.lang as SupportedLang : "en";

    const subCategories = subTopics
      .filter((t) => t.startsWith("news-"))
      .map((t) => t.replace("news-", ""));

    const relevantArticles = subCategories.length === 0
      ? newsletterArticles
      : newsletterArticles.filter((a) => subCategories.includes(a.category));

    if (relevantArticles.length === 0) continue;

    const dateStr = subLang === "ar" || subLang === "ur" ? dateAr : dateEn;
    const html = buildDigestEmail(relevantArticles, subLang, dateStr, todaysQuote, sub.name);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [sub.email],
          subject: EMAIL_SUBJECTS[subLang] ?? EMAIL_SUBJECTS.en,
          html,
        }),
      });
      if (res.ok) {
        emailsSent++;
        sentIds.push(sub.id);
      } else {
        emailsFailed++;
        const body = await res.text().catch(() => "");
        lastError = `${res.status}: ${body}`;
        console.error(`[news-generate] Resend send failed for ${sub.email}:`, lastError);
      }
    } catch (err) {
      emailsFailed++;
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[news-generate] Resend fetch threw for ${sub.email}:`, lastError);
    }
  }

  if (sentIds.length > 0) {
    const { error: markSentErr } = await supabase
      .from("newsletter_subscribers")
      .update({ last_sent_date: todayDateStr })
      .in("id", sentIds);
    if (markSentErr) {
      console.error("[news-generate] failed to record last_sent_date:", markSentErr.message);
    }
  }

  console.log(`[news-generate] emails sent=${emailsSent} failed=${emailsFailed}`);
  return Response.json({
    generated: articles.length, emailsSent, emailsFailed,
    ...(lastError ? { lastError } : {}),
    date: now.toISOString().split("T")[0],
  }, { headers: CORS });
});
