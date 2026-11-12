// The parts of the website that had no door on WhatsApp.
//
// The site has eighteen sections (`SECTIONS` in src/lib/billing/plans.ts). Eleven
// were already reachable here. Seven were not: careers, simulators, finance,
// community and messages, assistive products, the account (points, ranking,
// wishlist) and the professional tools. Each now sits under the group it belongs
// to, in the sender's language, and is either
//
//   action  a `phrase` the existing assistant pipeline answers (careers,
//           assistive products) — so the menu row cannot drift from typing the
//           same request, and the plan gate applies exactly as it does there; or
//   info    an `intro` that says what the section is and sends its address, then
//           (finance, simulators, community, account) a live part read from
//           public data — see whatsappSiteLive.ts. The section itself (a
//           simulator run, a voice call, a portfolio) is an interactive page that
//           does not fit a chat, so the address stays for that.
//
// Every title, description and sentence is written in all twenty languages here
// rather than falling back to English. Meta rejects a list row over 24
// characters (title) or 72 (description); `whatsapp-parity-nodes.test.ts` walks
// every string in every language against both limits.
//
// Pure data. No `Deno`, no fetch, no database.

import type { CatalogNode, Localized } from "./whatsappCatalog.ts";
import type { SupportedLanguage } from "./whatsappLanguages.ts";

const SITE = "https://visionex.app";

type L = SupportedLanguage;
/** `[title, description]` for an action row, `[title, description, sentence]` for an info row. */
type Row = readonly [string, string] | readonly [string, string, string];
type Table = Record<L, Row>;

function pick(table: Table, index: 0 | 1 | 2): Localized {
  const out: Partial<Record<L, string>> = {};
  for (const [lang, row] of Object.entries(table) as [L, Row][]) {
    const value = row[index];
    if (value !== undefined) out[lang] = value;
  }
  return out as Localized;
}

/** The sentence, then one address per line, in the sender's language. */
function intro(table: Table, links: readonly string[]): Localized {
  const out: Partial<Record<L, string>> = {};
  for (const [lang, row] of Object.entries(table) as [L, Row][]) {
    out[lang] = `${row[2]}\n\n${links.map((p) => `${SITE}${p}`).join("\n")}`;
  }
  return out as Localized;
}

// ── Careers (assistant answers) ────────────────────────────────────────────
const CAREER: Table = {
  en: ["Career & jobs", "CV, job search, interview practice"],
  ar: ["الوظائف والمهن", "السيرة الذاتية والبحث عن عمل والمقابلات"],
  ur: ["کیریئر اور ملازمتیں", "سی وی، ملازمت کی تلاش، انٹرویو کی مشق"],
  hi: ["करियर और नौकरी", "सीवी, नौकरी की खोज, इंटरव्यू अभ्यास"],
  id: ["Karier & lowongan", "CV, cari kerja, latihan wawancara"],
  ja: ["キャリアと求人", "履歴書、求人検索、面接練習"],
  it: ["Carriera e lavoro", "CV, ricerca lavoro, colloqui"],
  ko: ["커리어와 구직", "이력서, 구직, 면접 연습"],
  nl: ["Carrière & banen", "CV, solliciteren, gesprekstraining"],
  pl: ["Kariera i praca", "CV, szukanie pracy, rozmowy"],
  vi: ["Nghề nghiệp, việc làm", "CV, tìm việc, luyện phỏng vấn"],
  bn: ["ক্যারিয়ার ও চাকরি", "সিভি, চাকরি খোঁজা, ইন্টারভিউ অনুশীলন"],
  fa: ["شغل و کاریابی", "رزومه، جست‌وجوی کار، تمرین مصاحبه"],
  es: ["Carrera y empleo", "CV, buscar trabajo, entrevistas"],
  de: ["Karriere & Jobs", "Lebenslauf, Jobsuche, Vorstellungsgespräch"],
  pt: ["Carreira e emprego", "CV, busca de emprego, entrevistas"],
  zh: ["职业与求职", "简历、找工作、面试练习"],
  tr: ["Kariyer ve iş", "Özgeçmiş, iş arama, mülakat pratiği"],
  fr: ["Carrière et emploi", "CV, recherche d'emploi, entretiens"],
  ru: ["Карьера и работа", "Резюме, поиск работы, собеседования"],
};

// ── Simulators (address) ───────────────────────────────────────────────────
const SIMULATORS: Table = {
  en: ["Simulators", "Practice real jobs and run a business",
    "Hands-on simulators — farms, workshops, repair shops, logistics and more — are on the website. Open them here:"],
  ar: ["المحاكيات", "تدرّب على مهن حقيقية وأدر مشروعاً",
    "المحاكيات العملية — مزارع وورش ومحال صيانة ولوجستيات وغيرها — موجودة على الموقع. افتحها من هنا:"],
  ur: ["سمیولیٹرز", "حقیقی پیشے سیکھیں اور کاروبار چلائیں",
    "عملی سمیولیٹرز — فارم، ورکشاپ، مرمت کی دکانیں، لاجسٹکس اور بہت کچھ — ویب سائٹ پر ہیں۔ یہاں سے کھولیں:"],
  hi: ["सिमुलेटर", "असली पेशे सीखें, कारोबार चलाएँ",
    "प्रैक्टिकल सिमुलेटर — खेत, वर्कशॉप, रिपेयर शॉप, लॉजिस्टिक्स और बहुत कुछ — वेबसाइट पर हैं। यहाँ से खोलें:"],
  id: ["Simulator", "Latih pekerjaan nyata dan jalankan bisnis",
    "Simulator praktik — peternakan, bengkel, reparasi, logistik, dan lainnya — ada di situs web. Buka di sini:"],
  ja: ["シミュレーター", "実際の仕事を練習し、事業を運営", "農場、工房、修理店、物流などの実践シミュレーターはウェブサイトにあります。こちらから開けます:"],
  it: ["Simulatori", "Prova mestieri reali e gestisci un'attività",
    "Simulatori pratici — fattorie, officine, riparazioni, logistica e altro — sono sul sito. Aprili da qui:"],
  ko: ["시뮬레이터", "실제 직업 연습과 사업 운영", "농장, 공방, 수리점, 물류 등 실습 시뮬레이터는 웹사이트에 있습니다. 여기서 열어 보세요:"],
  nl: ["Simulatoren", "Oefen echte beroepen en run een bedrijf",
    "Praktische simulatoren — boerderijen, werkplaatsen, reparatie, logistiek en meer — staan op de website. Open ze hier:"],
  pl: ["Symulatory", "Ćwicz prawdziwe zawody, prowadź firmę",
    "Praktyczne symulatory — farmy, warsztaty, serwisy, logistyka i więcej — są na stronie. Otwórz je tutaj:"],
  vi: ["Trình mô phỏng", "Luyện nghề thật và điều hành doanh nghiệp",
    "Các trình mô phỏng thực hành — nông trại, xưởng, tiệm sửa chữa, hậu cần và hơn thế — có trên trang web. Mở tại đây:"],
  bn: ["সিমুলেটর", "বাস্তব পেশা অনুশীলন করুন, ব্যবসা চালান",
    "বাস্তব সিমুলেটর — খামার, কর্মশালা, মেরামতের দোকান, লজিস্টিকস ও আরও — ওয়েবসাইটে আছে। এখান থেকে খুলুন:"],
  fa: ["شبیه‌ساز‌ها", "حرفه‌های واقعی را تمرین کنید", "شبیه‌ساز‌های عملی — مزرعه، کارگاه، تعمیرگاه، لجستیک و بیشتر — در وب‌سایت هستند. از اینجا باز کنید:"],
  es: ["Simuladores", "Practica oficios reales y dirige un negocio",
    "Los simuladores prácticos — granjas, talleres, reparaciones, logística y más — están en el sitio web. Ábrelos aquí:"],
  de: ["Simulatoren", "Echte Berufe üben, ein Geschäft führen",
    "Praxis-Simulatoren — Farmen, Werkstätten, Reparatur, Logistik und mehr — gibt es auf der Website. Hier öffnen:"],
  pt: ["Simuladores", "Pratique profissões reais e gerencie um negócio",
    "Simuladores práticos — fazendas, oficinas, reparos, logística e mais — estão no site. Abra aqui:"],
  zh: ["模拟器", "练习真实职业，经营一门生意", "农场、工坊、维修店、物流等实操模拟器都在网站上。从这里打开："],
  tr: ["Simülatörler", "Gerçek meslekleri dene, işletme yönet",
    "Çiftlik, atölye, tamir, lojistik ve daha fazlası — uygulamalı simülatörler web sitesinde. Buradan açın:"],
  fr: ["Simulateurs", "Pratiquez de vrais métiers, gérez une activité",
    "Les simulateurs pratiques — fermes, ateliers, réparation, logistique et plus — sont sur le site. Ouvrez-les ici :"],
  ru: ["Симуляторы", "Практика реальных профессий и бизнес",
    "Практические симуляторы — фермы, мастерские, ремонт, логистика и другое — есть на сайте. Откройте здесь:"],
};

// ── Finance (address) ──────────────────────────────────────────────────────
const FINANCE: Table = {
  en: ["Markets & finance", "Currencies, stocks and market news",
    "Markets, currencies, stocks, an economic calendar and market news are on the website:"],
  ar: ["الأسواق والمال", "العملات والأسهم وأخبار الأسواق",
    "الأسواق والعملات والأسهم والتقويم الاقتصادي وأخبار الأسواق موجودة على الموقع:"],
  ur: ["مارکیٹس اور مالیات", "کرنسیاں، اسٹاکس اور مارکیٹ کی خبریں",
    "مارکیٹس، کرنسیاں، اسٹاکس، معاشی کیلنڈر اور مارکیٹ کی خبریں ویب سائٹ پر ہیں:"],
  hi: ["बाज़ार और वित्त", "मुद्राएँ, शेयर और बाज़ार की खबरें",
    "बाज़ार, मुद्राएँ, शेयर, आर्थिक कैलेंडर और बाज़ार की खबरें वेबसाइट पर हैं:"],
  id: ["Pasar & keuangan", "Mata uang, saham, dan berita pasar",
    "Pasar, mata uang, saham, kalender ekonomi, dan berita pasar ada di situs web:"],
  ja: ["市場と金融", "為替、株式、マーケットニュース", "市場、為替、株式、経済カレンダー、マーケットニュースはウェブサイトにあります:"],
  it: ["Mercati e finanza", "Valute, azioni e notizie di mercato",
    "Mercati, valute, azioni, calendario economico e notizie di mercato sono sul sito:"],
  ko: ["시장과 금융", "환율, 주식, 시장 뉴스", "시장, 환율, 주식, 경제 캘린더, 시장 뉴스는 웹사이트에 있습니다:"],
  nl: ["Markten & financiën", "Valuta, aandelen en marktnieuws",
    "Markten, valuta, aandelen, een economische agenda en marktnieuws staan op de website:"],
  pl: ["Rynki i finanse", "Waluty, akcje i wiadomości rynkowe",
    "Rynki, waluty, akcje, kalendarz ekonomiczny i wiadomości rynkowe są na stronie:"],
  vi: ["Thị trường, tài chính", "Tiền tệ, cổ phiếu và tin thị trường",
    "Thị trường, tiền tệ, cổ phiếu, lịch kinh tế và tin thị trường có trên trang web:"],
  bn: ["বাজার ও অর্থ", "মুদ্রা, শেয়ার ও বাজারের খবর", "বাজার, মুদ্রা, শেয়ার, অর্থনৈতিক ক্যালেন্ডার ও বাজারের খবর ওয়েবসাইটে আছে:"],
  fa: ["بازار و مالی", "ارز، سهام و اخبار بازار", "بازارها، ارزها، سهام، تقویم اقتصادی و اخبار بازار در وب‌سایت هستند:"],
  es: ["Mercados y finanzas", "Divisas, acciones y noticias del mercado",
    "Mercados, divisas, acciones, calendario económico y noticias del mercado están en el sitio web:"],
  de: ["Märkte & Finanzen", "Währungen, Aktien und Marktnachrichten",
    "Märkte, Währungen, Aktien, ein Wirtschaftskalender und Marktnachrichten gibt es auf der Website:"],
  pt: ["Mercados e finanças", "Moedas, ações e notícias do mercado",
    "Mercados, moedas, ações, calendário econômico e notícias do mercado estão no site:"],
  zh: ["市场与金融", "货币、股票和市场新闻", "市场、货币、股票、经济日历和市场新闻都在网站上："],
  tr: ["Piyasa ve finans", "Döviz, hisse ve piyasa haberleri",
    "Piyasalar, döviz, hisseler, ekonomik takvim ve piyasa haberleri web sitesinde:"],
  fr: ["Marchés et finance", "Devises, actions et actualité des marchés",
    "Les marchés, devises, actions, calendrier économique et actualités des marchés sont sur le site :"],
  ru: ["Рынки и финансы", "Валюты, акции и новости рынка", "Рынки, валюты, акции, экономический календарь и новости рынка — на сайте:"],
};

// ── Community and messages (address) ───────────────────────────────────────
const COMMUNITY: Table = {
  en: ["Community", "Discussions, messages and voice rooms",
    "Discussions, private messages and live voice rooms are on the website:"],
  ar: ["المجتمع", "نقاشات ورسائل وغرف صوتية",
    "النقاشات والرسائل الخاصة والغرف الصوتية المباشرة موجودة على الموقع:"],
  ur: ["کمیونٹی", "گفتگو، پیغامات اور وائس رومز", "گفتگو، نجی پیغامات اور لائیو وائس رومز ویب سائٹ پر ہیں:"],
  hi: ["समुदाय", "चर्चा, संदेश और वॉइस रूम", "चर्चाएँ, निजी संदेश और लाइव वॉइस रूम वेबसाइट पर हैं:"],
  id: ["Komunitas", "Diskusi, pesan, dan ruang suara", "Diskusi, pesan pribadi, dan ruang suara langsung ada di situs web:"],
  ja: ["コミュニティ", "ディスカッション、メッセージ、ボイスルーム", "ディスカッション、個人メッセージ、ライブのボイスルームはウェブサイトにあります:"],
  it: ["Community", "Discussioni, messaggi e stanze vocali", "Discussioni, messaggi privati e stanze vocali dal vivo sono sul sito:"],
  ko: ["커뮤니티", "토론, 메시지, 음성 룸", "토론, 개인 메시지, 실시간 음성 룸은 웹사이트에 있습니다:"],
  nl: ["Community", "Discussies, berichten en spraakkamers", "Discussies, privéberichten en live spraakkamers staan op de website:"],
  pl: ["Społeczność", "Dyskusje, wiadomości i pokoje głosowe", "Dyskusje, prywatne wiadomości i pokoje głosowe na żywo są na stronie:"],
  vi: ["Cộng đồng", "Thảo luận, tin nhắn và phòng thoại", "Thảo luận, tin nhắn riêng và phòng thoại trực tiếp có trên trang web:"],
  bn: ["কমিউনিটি", "আলোচনা, বার্তা ও ভয়েস রুম", "আলোচনা, ব্যক্তিগত বার্তা ও লাইভ ভয়েস রুম ওয়েবসাইটে আছে:"],
  fa: ["جامعه", "گفتگو، پیام و اتاق‌های صوتی", "گفتگوها، پیام‌های خصوصی و اتاق‌های صوتی زنده در وب‌سایت هستند:"],
  es: ["Comunidad", "Debates, mensajes y salas de voz", "Los debates, mensajes privados y salas de voz en vivo están en el sitio web:"],
  de: ["Community", "Diskussionen, Nachrichten, Sprachräume", "Diskussionen, private Nachrichten und Live-Sprachräume gibt es auf der Website:"],
  pt: ["Comunidade", "Debates, mensagens e salas de voz", "Debates, mensagens privadas e salas de voz ao vivo estão no site:"],
  zh: ["社区", "讨论、消息和语音房间", "讨论、私信和实时语音房间都在网站上："],
  tr: ["Topluluk", "Tartışmalar, mesajlar, sesli odalar", "Tartışmalar, özel mesajlar ve canlı sesli odalar web sitesinde:"],
  fr: ["Communauté", "Discussions, messages, salons vocaux", "Les discussions, messages privés et salons vocaux en direct sont sur le site :"],
  ru: ["Сообщество", "Обсуждения, сообщения, голосовые комнаты", "Обсуждения, личные сообщения и голосовые комнаты — на сайте:"],
};

// ── Assistive products (assistant answers) ─────────────────────────────────
const ASSISTIVE: Table = {
  en: ["Assistive products", "Find devices that make life easier"],
  ar: ["المنتجات المساعدة", "اعثر على أجهزة تسهّل الحياة"],
  ur: ["معاون مصنوعات", "زندگی آسان کرنے والے آلات تلاش کریں"],
  hi: ["सहायक उत्पाद", "जीवन आसान करने वाले उपकरण खोजें"],
  id: ["Produk bantu", "Temukan perangkat yang memudahkan hidup"],
  ja: ["支援製品", "暮らしを助ける機器を探す"],
  it: ["Prodotti assistivi", "Trova dispositivi che semplificano la vita"],
  ko: ["보조 제품", "생활을 편하게 하는 기기 찾기"],
  nl: ["Hulpmiddelen", "Vind apparaten die het leven makkelijker maken"],
  pl: ["Produkty wspomagające", "Znajdź urządzenia ułatwiające życie"],
  vi: ["Sản phẩm hỗ trợ", "Tìm thiết bị giúp cuộc sống dễ hơn"],
  bn: ["সহায়ক পণ্য", "জীবন সহজ করার ডিভাইস খুঁজুন"],
  fa: ["محصولات کمکی", "دستگاه‌های آسان‌کننده زندگی را پیدا کنید"],
  es: ["Productos de apoyo", "Encuentra dispositivos que facilitan la vida"],
  de: ["Hilfsmittel", "Geräte finden, die das Leben erleichtern"],
  pt: ["Produtos assistivos", "Encontre dispositivos que facilitam a vida"],
  zh: ["辅助产品", "查找让生活更轻松的设备"],
  tr: ["Yardımcı ürünler", "Hayatı kolaylaştıran cihazları bul"],
  fr: ["Produits d'assistance", "Trouvez des appareils qui facilitent la vie"],
  ru: ["Товары для жизни", "Найдите устройства для удобной жизни"],
};

// ── The account (address) ──────────────────────────────────────────────────
const ACCOUNT: Table = {
  en: ["My account", "Points, ranking, wishlist and profile",
    "Your points and wallet, the leaderboard, your wishlist and your profile are on the website:"],
  ar: ["حسابي", "النقاط والترتيب وقائمة الأمنيات والملف الشخصي",
    "نقاطك ومحفظتك ولوحة الصدارة وقائمة أمنياتك وملفك الشخصي موجودة على الموقع:"],
  ur: ["میرا اکاؤنٹ", "پوائنٹس، رینکنگ، وش لسٹ اور پروفائل",
    "آپ کے پوائنٹس اور والٹ، لیڈر بورڈ، وش لسٹ اور پروفائل ویب سائٹ پر ہیں:"],
  hi: ["मेरा खाता", "पॉइंट, रैंकिंग, विशलिस्ट और प्रोफ़ाइल",
    "आपके पॉइंट और वॉलेट, लीडरबोर्ड, विशलिस्ट और प्रोफ़ाइल वेबसाइट पर हैं:"],
  id: ["Akun saya", "Poin, peringkat, wishlist, dan profil",
    "Poin dan dompet Anda, papan peringkat, wishlist, dan profil ada di situs web:"],
  ja: ["マイアカウント", "ポイント、ランキング、ウィッシュリスト", "ポイントとウォレット、ランキング、ウィッシュリスト、プロフィールはウェブサイトにあります:"],
  it: ["Il mio account", "Punti, classifica, lista desideri e profilo",
    "I tuoi punti e il portafoglio, la classifica, la lista desideri e il profilo sono sul sito:"],
  ko: ["내 계정", "포인트, 순위, 위시리스트, 프로필", "포인트와 지갑, 순위표, 위시리스트, 프로필은 웹사이트에 있습니다:"],
  nl: ["Mijn account", "Punten, ranglijst, wensenlijst en profiel",
    "Je punten en portemonnee, het klassement, je wensenlijst en je profiel staan op de website:"],
  pl: ["Moje konto", "Punkty, ranking, lista życzeń i profil",
    "Twoje punkty i portfel, ranking, lista życzeń i profil są na stronie:"],
  vi: ["Tài khoản của tôi", "Điểm, xếp hạng, danh sách mong muốn",
    "Điểm và ví của bạn, bảng xếp hạng, danh sách mong muốn và hồ sơ có trên trang web:"],
  bn: ["আমার অ্যাকাউন্ট", "পয়েন্ট, র‍্যাঙ্কিং, উইশলিস্ট ও প্রোফাইল",
    "আপনার পয়েন্ট ও ওয়ালেট, লিডারবোর্ড, উইশলিস্ট ও প্রোফাইল ওয়েবসাইটে আছে:"],
  fa: ["حساب من", "امتیاز، رتبه، فهرست علاقه‌مندی و نمایه",
    "امتیاز و کیف پول، جدول رتبه‌بندی، فهرست علاقه‌مندی و نمایه شما در وب‌سایت هستند:"],
  es: ["Mi cuenta", "Puntos, clasificación, deseos y perfil",
    "Tus puntos y monedero, la clasificación, tu lista de deseos y tu perfil están en el sitio web:"],
  de: ["Mein Konto", "Punkte, Rangliste, Wunschliste, Profil",
    "Deine Punkte und dein Wallet, die Rangliste, deine Wunschliste und dein Profil findest du auf der Website:"],
  pt: ["Minha conta", "Pontos, ranking, lista de desejos e perfil",
    "Seus pontos e carteira, o ranking, sua lista de desejos e seu perfil estão no site:"],
  zh: ["我的账户", "积分、排名、心愿单和个人资料", "你的积分和钱包、排行榜、心愿单和个人资料都在网站上："],
  tr: ["Hesabım", "Puanlar, sıralama, istek listesi, profil",
    "Puanlarınız ve cüzdanınız, liderlik tablosu, istek listeniz ve profiliniz web sitesinde:"],
  fr: ["Mon compte", "Points, classement, favoris et profil",
    "Vos points et portefeuille, le classement, votre liste d'envies et votre profil sont sur le site :"],
  ru: ["Мой аккаунт", "Баллы, рейтинг, избранное и профиль",
    "Ваши баллы и кошелёк, рейтинг, список желаний и профиль — на сайте:"],
};

// ── Professional tools (address) ───────────────────────────────────────────
const PROFESSIONAL: Table = {
  en: ["Professional tools", "File studio, media studio and more",
    "Professional tools, the file studio and the AI media studio are on the website. To convert a file here, just send it and say the format you want:"],
  ar: ["الأدوات المهنية", "استوديو الملفات والوسائط وغيرها",
    "الأدوات المهنية واستوديو الملفات واستوديو الوسائط الذكي موجودة على الموقع. لتحويل ملف هنا أرسله واذكر الصيغة التي تريدها:"],
  ur: ["پیشہ ورانہ ٹولز", "فائل اسٹوڈیو، میڈیا اسٹوڈیو اور مزید",
    "پیشہ ورانہ ٹولز، فائل اسٹوڈیو اور اے آئی میڈیا اسٹوڈیو ویب سائٹ پر ہیں۔ یہاں فائل بدلنے کے لیے اسے بھیجیں اور مطلوبہ فارمیٹ لکھیں:"],
  hi: ["प्रोफ़ेशनल टूल्स", "फ़ाइल स्टूडियो, मीडिया स्टूडियो और अधिक",
    "प्रोफ़ेशनल टूल्स, फ़ाइल स्टूडियो और AI मीडिया स्टूडियो वेबसाइट पर हैं। यहाँ फ़ाइल बदलने के लिए उसे भेजें और फ़ॉर्मेट बताएँ:"],
  id: ["Alat profesional", "Studio file, studio media, dan lainnya",
    "Alat profesional, studio file, dan studio media AI ada di situs web. Untuk mengonversi file di sini, kirim file dan sebutkan formatnya:"],
  ja: ["プロ向けツール", "ファイルスタジオ、メディアスタジオなど",
    "プロ向けツール、ファイルスタジオ、AIメディアスタジオはウェブサイトにあります。ここでファイルを変換するには、ファイルを送って形式を伝えてください:"],
  it: ["Strumenti pro", "Studio file, studio media e altro",
    "Strumenti professionali, studio file e studio media AI sono sul sito. Per convertire un file qui, invialo e indica il formato:"],
  ko: ["전문가 도구", "파일 스튜디오, 미디어 스튜디오 등",
    "전문가 도구, 파일 스튜디오, AI 미디어 스튜디오는 웹사이트에 있습니다. 여기서 파일을 변환하려면 파일을 보내고 원하는 형식을 알려 주세요:"],
  nl: ["Professionele tools", "Bestandsstudio, mediastudio en meer",
    "Professionele tools, de bestandsstudio en de AI-mediastudio staan op de website. Om hier een bestand om te zetten, stuur het en noem het formaat:"],
  pl: ["Narzędzia zawodowe", "Studio plików, studio mediów i więcej",
    "Narzędzia zawodowe, studio plików i studio mediów AI są na stronie. Aby przekonwertować plik tutaj, wyślij go i podaj format:"],
  vi: ["Công cụ pro", "Studio tệp, studio media và hơn nữa",
    "Công cụ chuyên nghiệp, studio tệp và studio media AI có trên trang web. Để chuyển đổi tệp tại đây, hãy gửi tệp và nói định dạng bạn muốn:"],
  bn: ["পেশাদার টুল", "ফাইল স্টুডিও, মিডিয়া স্টুডিও ও আরও",
    "পেশাদার টুল, ফাইল স্টুডিও ও এআই মিডিয়া স্টুডিও ওয়েবসাইটে আছে। এখানে ফাইল রূপান্তর করতে ফাইল পাঠিয়ে ফরম্যাট জানান:"],
  fa: ["ابزارهای حرفه‌ای", "استودیوی فایل، رسانه و بیشتر",
    "ابزارهای حرفه‌ای، استودیوی فایل و استودیوی رسانه هوشمند در وب‌سایت هستند. برای تبدیل فایل در اینجا، آن را بفرستید و قالب را بگویید:"],
  es: ["Herramientas pro", "Estudio de archivos, de medios y más",
    "Las herramientas profesionales, el estudio de archivos y el estudio de medios con IA están en el sitio web. Para convertir un archivo aquí, envíalo e indica el formato:"],
  de: ["Profi-Tools", "Dateistudio, Mediastudio und mehr",
    "Profi-Tools, das Dateistudio und das KI-Mediastudio gibt es auf der Website. Um hier eine Datei umzuwandeln, sende sie und nenne das Format:"],
  pt: ["Ferramentas pro", "Estúdio de arquivos, de mídia e mais",
    "As ferramentas profissionais, o estúdio de arquivos e o estúdio de mídia com IA estão no site. Para converter um arquivo aqui, envie-o e diga o formato:"],
  zh: ["专业工具", "文件工作室、媒体工作室等", "专业工具、文件工作室和 AI 媒体工作室都在网站上。要在这里转换文件，请发送文件并说明所需格式："],
  tr: ["Profesyonel araçlar", "Dosya stüdyosu, medya stüdyosu ve fazlası",
    "Profesyonel araçlar, dosya stüdyosu ve yapay zekâ medya stüdyosu web sitesinde. Burada dosya dönüştürmek için dosyayı gönderin ve biçimi söyleyin:"],
  fr: ["Outils pro", "Studio de fichiers, studio média et plus",
    "Les outils professionnels, le studio de fichiers et le studio média IA sont sur le site. Pour convertir un fichier ici, envoyez-le et indiquez le format :"],
  ru: ["Инструменты pro", "Студия файлов, студия медиа и другое",
    "Профессиональные инструменты, студия файлов и ИИ-студия медиа — на сайте. Чтобы преобразовать файл здесь, отправьте его и укажите формат:"],
};

// ── What the assistant says when these two rows open ───────────────────────
//
// Careers and assistive products are answered by the assistant, so the row opens
// it with a sentence that says what to ask, then points at the section.
function introFrom(sentences: Record<L, string>, links: readonly string[]): Localized {
  const out: Partial<Record<L, string>> = {};
  for (const [lang, sentence] of Object.entries(sentences) as [L, string][]) {
    out[lang] = `${sentence}\n\n${links.map((p) => `${SITE}${p}`).join("\n")}`;
  }
  return out as Localized;
}

const CAREER_ASK: Record<L, string> = {
  en: "Tell me what you need — improving your CV, finding jobs or practising an interview — and I'll help. More on the website:",
  ar: "أخبرني بما تحتاج — تحسين سيرتك الذاتية أو البحث عن وظائف أو التدرّب على مقابلة — وسأساعدك. المزيد على الموقع:",
  ur: "بتائیں آپ کو کیا چاہیے — سی وی بہتر بنانا، ملازمتیں تلاش کرنا یا انٹرویو کی مشق — میں مدد کروں گا۔ مزید ویب سائٹ پر:",
  hi: "बताइए आपको क्या चाहिए — सीवी सुधारना, नौकरी ढूँढना या इंटरव्यू का अभ्यास — मैं मदद करूँगा। और जानकारी वेबसाइट पर:",
  id: "Katakan apa yang Anda butuhkan — memperbaiki CV, mencari kerja, atau berlatih wawancara — saya akan membantu. Selengkapnya di situs web:",
  ja: "必要なことを教えてください。履歴書の改善、求人探し、面接の練習などをお手伝いします。詳しくはウェブサイトで:",
  it: "Dimmi di cosa hai bisogno — migliorare il CV, cercare lavoro o provare un colloquio — e ti aiuto. Altro sul sito:",
  ko: "필요한 것을 알려 주세요. 이력서 개선, 구직, 면접 연습을 도와 드립니다. 자세한 내용은 웹사이트에서:",
  nl: "Vertel me wat je nodig hebt — je cv verbeteren, werk zoeken of een gesprek oefenen — en ik help je. Meer op de website:",
  pl: "Powiedz, czego potrzebujesz — poprawy CV, szukania pracy lub ćwiczenia rozmowy — a pomogę. Więcej na stronie:",
  vi: "Hãy cho tôi biết bạn cần gì — cải thiện CV, tìm việc hoặc luyện phỏng vấn — tôi sẽ giúp. Xem thêm trên trang web:",
  bn: "আপনার কী দরকার বলুন — সিভি উন্নত করা, চাকরি খোঁজা বা ইন্টারভিউ অনুশীলন — আমি সাহায্য করব। আরও ওয়েবসাইটে:",
  fa: "بگویید چه نیاز دارید — بهتر کردن رزومه، پیدا کردن کار یا تمرین مصاحبه — کمک می‌کنم. بیشتر در وب‌سایت:",
  es: "Dime qué necesitas — mejorar tu CV, buscar empleo o practicar una entrevista — y te ayudo. Más en el sitio web:",
  de: "Sag mir, was du brauchst — Lebenslauf verbessern, Jobs finden oder ein Gespräch üben — und ich helfe dir. Mehr auf der Website:",
  pt: "Diga o que você precisa — melhorar o CV, encontrar vagas ou treinar uma entrevista — e eu ajudo. Mais no site:",
  zh: "告诉我你需要什么——完善简历、找工作或练习面试——我来帮你。更多内容见网站：",
  tr: "Neye ihtiyacın olduğunu söyle — özgeçmişi geliştirmek, iş bulmak ya da mülakat çalışmak — yardım edeyim. Daha fazlası web sitesinde:",
  fr: "Dites-moi ce dont vous avez besoin — améliorer votre CV, chercher un emploi ou préparer un entretien — et je vous aide. Plus sur le site :",
  ru: "Скажите, что нужно — улучшить резюме, найти работу или потренировать собеседование — и я помогу. Подробнее на сайте:",
};

const ASSISTIVE_ASK: Record<L, string> = {
  en: "Tell me what you need — for example a talking watch, a braille display or a magnifier — and I'll suggest options. More on the website:",
  ar: "أخبرني بما تحتاج — مثل ساعة ناطقة أو شاشة برايل أو مكبّر — وسأقترح عليك خيارات. المزيد على الموقع:",
  ur: "بتائیں آپ کو کیا چاہیے — جیسے بولنے والی گھڑی، بریل ڈسپلے یا میگنیفائر — میں آپشنز تجویز کروں گا۔ مزید ویب سائٹ پر:",
  hi: "बताइए आपको क्या चाहिए — जैसे बोलने वाली घड़ी, ब्रेल डिस्प्ले या मैग्निफ़ायर — मैं विकल्प सुझाऊँगा। और जानकारी वेबसाइट पर:",
  id: "Katakan apa yang Anda butuhkan — misalnya jam bicara, display braille, atau kaca pembesar — saya akan menyarankan pilihan. Selengkapnya di situs web:",
  ja: "必要なものを教えてください。音声時計、点字ディスプレイ、拡大鏡などの選択肢をご提案します。詳しくはウェブサイトで:",
  it: "Dimmi di cosa hai bisogno — ad esempio un orologio parlante, un display braille o una lente — e ti propongo delle opzioni. Altro sul sito:",
  ko: "필요한 것을 알려 주세요. 예: 음성 시계, 점자 디스플레이, 확대경. 옵션을 추천해 드립니다. 자세한 내용은 웹사이트에서:",
  nl: "Vertel me wat je nodig hebt — bijvoorbeeld een sprekend horloge, een brailleleesregel of een loep — en ik stel opties voor. Meer op de website:",
  pl: "Powiedz, czego potrzebujesz — na przykład mówiącego zegarka, monitora brajlowskiego lub lupy — a zaproponuję opcje. Więcej na stronie:",
  vi: "Hãy cho tôi biết bạn cần gì — ví dụ đồng hồ nói, màn hình chữ nổi hoặc kính lúp — tôi sẽ gợi ý lựa chọn. Xem thêm trên trang web:",
  bn: "আপনার কী দরকার বলুন — যেমন কথা বলা ঘড়ি, ব্রেইল ডিসপ্লে বা ম্যাগনিফায়ার — আমি বিকল্প সুপারিশ করব। আরও ওয়েবসাইটে:",
  fa: "بگویید چه نیاز دارید — مثلاً ساعت گویا، نمایشگر بریل یا ذره‌بین — گزینه‌ها را پیشنهاد می‌کنم. بیشتر در وب‌سایت:",
  es: "Dime qué necesitas — por ejemplo un reloj parlante, una línea braille o una lupa — y te sugiero opciones. Más en el sitio web:",
  de: "Sag mir, was du brauchst — zum Beispiel eine sprechende Uhr, eine Braillezeile oder eine Lupe — und ich schlage Optionen vor. Mehr auf der Website:",
  pt: "Diga o que você precisa — por exemplo um relógio falante, uma linha braille ou uma lupa — e eu sugiro opções. Mais no site:",
  zh: "告诉我你需要什么——例如语音手表、盲文显示器或放大镜——我来推荐。更多内容见网站：",
  tr: "Neye ihtiyacın olduğunu söyle — örneğin konuşan saat, braille ekran ya da büyüteç — seçenekler önereyim. Daha fazlası web sitesinde:",
  fr: "Dites-moi ce dont vous avez besoin — par exemple une montre parlante, une plage braille ou une loupe — et je propose des options. Plus sur le site :",
  ru: "Скажите, что нужно — например, говорящие часы, брайлевский дисплей или лупа — и я предложу варианты. Подробнее на сайте:",
};

export const PARITY_NODES: readonly CatalogNode[] = [
  {
    id: "explore.career",
    parent: "explore",
    order: 20,
    kind: "action",
    enabled: true,
    emoji: "💼",
    title: pick(CAREER, 0),
    description: pick(CAREER, 1),
    aliases: {
      ar: ["وظائف", "الوظائف", "سيرة ذاتية", "السيرة الذاتية", "البحث عن عمل"],
      en: ["career", "careers", "jobs", "cv", "resume", "job search"],
    },
    handler: "ai_ask",
    requires: ["ai"],
    accepts: ["text", "audio"],
    intro: introFrom(CAREER_ASK, ["/careers"]),
  },
  {
    id: "explore.simulations",
    parent: "explore",
    order: 21,
    kind: "action",
    enabled: true,
    emoji: "🏭",
    title: pick(SIMULATORS, 0),
    description: pick(SIMULATORS, 1),
    aliases: { ar: ["المحاكيات", "محاكي", "محاكاة"], en: ["simulators", "simulator", "simulation", "business simulator"] },
    handler: "info",
    accepts: ["text"],
    intro: intro(SIMULATORS, ["/business-simulator", "/simulations-summary"]),
  },
  {
    id: "explore.finance",
    parent: "explore",
    order: 22,
    kind: "action",
    enabled: true,
    emoji: "📈",
    title: pick(FINANCE, 0),
    description: pick(FINANCE, 1),
    aliases: { ar: ["الأسواق", "المال", "الأسهم", "العملات"], en: ["markets", "finance", "stocks", "currencies"] },
    handler: "info",
    accepts: ["text"],
    intro: intro(FINANCE, ["/finance"]),
  },
  {
    id: "headlines.community",
    parent: "headlines",
    order: 20,
    kind: "action",
    enabled: true,
    emoji: "👥",
    title: pick(COMMUNITY, 0),
    description: pick(COMMUNITY, 1),
    aliases: { ar: ["المجتمع", "الغرف الصوتية", "الرسائل"], en: ["community", "voice rooms", "messages"] },
    handler: "info",
    accepts: ["text"],
    intro: intro(COMMUNITY, ["/community", "/messages", "/community/voice-rooms"]),
  },
  {
    id: "bazaar.assistive",
    parent: "bazaar",
    order: 20,
    kind: "action",
    enabled: true,
    emoji: "🦯",
    title: pick(ASSISTIVE, 0),
    description: pick(ASSISTIVE, 1),
    aliases: {
      ar: ["المنتجات المساعدة", "اجهزة مساعدة", "أجهزة مساعدة"],
      en: ["assistive products", "assistive devices", "assistive technology"],
    },
    handler: "ai_ask",
    requires: ["ai"],
    accepts: ["text", "audio"],
    intro: introFrom(ASSISTIVE_ASK, ["/assistive-products"]),
  },
  {
    id: "more.account",
    parent: "more",
    order: 20,
    kind: "action",
    enabled: true,
    emoji: "👤",
    title: pick(ACCOUNT, 0),
    description: pick(ACCOUNT, 1),
    aliases: { ar: ["حسابي", "نقاطي", "لوحة الصدارة"], en: ["my account", "points", "leaderboard", "wishlist", "profile"] },
    handler: "info",
    accepts: ["text"],
    intro: intro(ACCOUNT, ["/profile", "/leaderboard", "/wishlist", "/coins-store"]),
  },
  {
    id: "explore.professional",
    parent: "explore",
    order: 23,
    kind: "action",
    enabled: true,
    emoji: "🛠️",
    title: pick(PROFESSIONAL, 0),
    description: pick(PROFESSIONAL, 1),
    aliases: { ar: ["الأدوات المهنية", "استوديو الملفات"], en: ["professional tools", "file studio", "media studio"] },
    handler: "info",
    accepts: ["text"],
    intro: intro(PROFESSIONAL, ["/professional-tools", "/services/file-studio", "/services/ai-media-studio"]),
  },
];
