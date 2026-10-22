// Fixed answers to the three questions people ask most that have one true,
// public, sender-independent answer.
//
//   trial     what the free week opens (and what it does not)
//   language  where the language is changed
//   contact   how to reach the team
//
// Same rules as `localIntentCatalogue.ts`: the whole message must be the phrase,
// nothing here depends on who is asking, and an unrecognised message goes to the
// model exactly as before. Every statement below is pinned to the code that
// owns it by `src/test/local-faq.test.ts`: the trial length to `TRIAL_DAYS`,
// the sections to `TRIAL_SECTIONS`, the language count to `LOCALES`, the
// contact page to a registered route. If one of those changes, the test fails
// until this text agrees — a stale FAQ is worse than none.
//
// A question about *this person's* trial ("how many days do I have left") is
// not here and never will be: that is account data, read by the code that owns
// it, never from a phrase list.

import type { Locale } from "./localIntentCatalogue.ts";

export type FaqIntent = "trial" | "language" | "contact";
export const FAQ_INTENTS: readonly FaqIntent[] = ["trial", "language", "contact"];

/** Bumped whenever any text below changes, so a cached copy elsewhere can be told apart. */
export const FAQ_VERSION = "2026.10.22.1";

/** Where each answer points, or null for none. Every path is a public route. */
export const FAQ_PATHS: Record<FaqIntent, string | null> = {
  trial: "/pricing",
  language: null,
  contact: "/contact-us",
};

export const FAQ_PHRASES: Record<FaqIntent, Record<Locale, string[]>> = {
  trial: {
    en: ["free trial", "what is the free trial", "what does the free trial include"],
    ar: ["التجربة المجانية", "ما هي التجربة المجانية"],
    ur: ["مفت آزمائش"],
    hi: ["मुफ़्त ट्रायल", "फ्री ट्रायल"],
    id: ["percobaan gratis", "uji coba gratis"],
    ja: ["無料トライアル", "無料体験"],
    it: ["prova gratuita"],
    ko: ["무료 체험"],
    nl: ["gratis proefperiode"],
    pl: ["okres próbny", "bezpłatny okres próbny"],
    vi: ["dùng thử miễn phí"],
    bn: ["বিনামূল্যে ট্রায়াল"],
    fa: ["آزمایش رایگان"],
    es: ["prueba gratuita", "prueba gratis"],
    de: ["kostenlose testphase"],
    pt: ["teste gratuito", "teste grátis"],
    zh: ["免费试用"],
    tr: ["ücretsiz deneme"],
    fr: ["essai gratuit"],
    ru: ["бесплатный пробный период"],
  },
  language: {
    en: ["change language", "change the language"],
    ar: ["تغيير اللغة", "غير اللغة"],
    ur: ["زبان تبدیل کریں"],
    hi: ["भाषा बदलें"],
    id: ["ganti bahasa"],
    ja: ["言語を変更", "言語変更"],
    it: ["cambia lingua", "cambiare lingua"],
    ko: ["언어 변경"],
    nl: ["taal wijzigen", "taal veranderen"],
    pl: ["zmień język"],
    vi: ["đổi ngôn ngữ"],
    bn: ["ভাষা পরিবর্তন"],
    fa: ["تغییر زبان"],
    es: ["cambiar idioma", "cambiar el idioma"],
    de: ["sprache ändern"],
    pt: ["mudar idioma", "mudar o idioma"],
    zh: ["切换语言", "更改语言"],
    tr: ["dili değiştir"],
    fr: ["changer de langue", "changer la langue"],
    ru: ["сменить язык", "изменить язык"],
  },
  contact: {
    en: ["contact", "contact us", "contact support", "how can i contact you"],
    ar: ["اتصل بنا", "تواصل معنا"],
    ur: ["ہم سے رابطہ کریں"],
    hi: ["संपर्क करें", "हमसे संपर्क करें"],
    id: ["hubungi kami"],
    ja: ["お問い合わせ"],
    it: ["contattaci"],
    ko: ["문의하기"],
    nl: ["contact opnemen", "neem contact op"],
    pl: ["skontaktuj się"],
    vi: ["liên hệ"],
    bn: ["যোগাযোগ করুন"],
    fa: ["تماس با ما"],
    es: ["contáctanos", "contacto"],
    de: ["kontakt", "kontaktiere uns"],
    pt: ["fale conosco", "contato"],
    zh: ["联系我们"],
    tr: ["bize ulaşın", "iletişim"],
    fr: ["contactez-nous", "nous contacter"],
    ru: ["связаться с вами", "контакты"],
  },
};

export const FAQ_REPLIES: Record<FaqIntent, Record<Locale, string>> = {
  trial: {
    en: "Every new account gets a free 7-day trial. It opens the news, the community, the assistive products, the Academy, the Library and the Arcade. The AI assistant and the other services need a paid plan.",
    ar: "يحصل كل حساب جديد على تجربة مجانية لمدة 7 أيام. تفتح لك الأخبار والمجتمع والمنتجات المساعدة والأكاديمية والمكتبة والألعاب. أما المساعد الذكي والخدمات الأخرى فتحتاج إلى خطة مدفوعة.",
    ur: "ہر نئے اکاؤنٹ کو 7 دن کی مفت آزمائش ملتی ہے۔ اس میں خبریں، کمیونٹی، معاون مصنوعات، اکیڈمی، لائبریری اور آرکیڈ شامل ہیں۔ اے آئی اسسٹنٹ اور دوسری خدمات کے لیے ادائیگی والا پلان درکار ہے۔",
    hi: "हर नए खाते को 7 दिन का मुफ़्त ट्रायल मिलता है। इसमें समाचार, समुदाय, सहायक उत्पाद, अकादमी, लाइब्रेरी और आर्केड शामिल हैं। एआई सहायक और अन्य सेवाओं के लिए सशुल्क योजना चाहिए।",
    id: "Setiap akun baru mendapat percobaan gratis 7 hari. Isinya berita, komunitas, produk bantu, Akademi, Perpustakaan, dan Arcade. Asisten AI dan layanan lainnya memerlukan paket berbayar.",
    ja: "新規アカウントには7日間の無料トライアルがあります。ニュース、コミュニティ、支援製品、アカデミー、ライブラリ、アーケードが利用できます。AIアシスタントやその他のサービスには有料プランが必要です。",
    it: "Ogni nuovo account ha una prova gratuita di 7 giorni. Include notizie, community, prodotti assistivi, Accademia, Biblioteca e Arcade. L'assistente IA e gli altri servizi richiedono un piano a pagamento.",
    ko: "새 계정에는 7일 무료 체험이 제공됩니다. 뉴스, 커뮤니티, 보조 제품, 아카데미, 라이브러리, 아케이드를 이용할 수 있어요. AI 어시스턴트와 다른 서비스는 유료 플랜이 필요합니다.",
    nl: "Elk nieuw account krijgt een gratis proefperiode van 7 dagen. Die omvat nieuws, de community, hulpmiddelen, de Academie, de Bibliotheek en de Arcade. De AI-assistent en de andere diensten vereisen een betaald abonnement.",
    pl: "Każde nowe konto ma 7-dniowy bezpłatny okres próbny. Obejmuje wiadomości, społeczność, produkty wspomagające, Akademię, Bibliotekę i Arcade. Asystent AI i pozostałe usługi wymagają płatnego planu.",
    vi: "Mỗi tài khoản mới được dùng thử miễn phí 7 ngày. Gói này mở tin tức, cộng đồng, sản phẩm hỗ trợ, Học viện, Thư viện và Arcade. Trợ lý AI và các dịch vụ khác cần gói trả phí.",
    bn: "প্রতিটি নতুন অ্যাকাউন্ট 7 দিনের বিনামূল্যে ট্রায়াল পায়। এতে সংবাদ, কমিউনিটি, সহায়ক পণ্য, একাডেমি, লাইব্রেরি ও আর্কেড পাওয়া যায়। এআই সহকারী ও অন্যান্য সেবার জন্য পেইড প্ল্যান লাগে।",
    fa: "هر حساب جدید 7 روز آزمایش رایگان دارد. این دوره اخبار، جامعه، محصولات کمکی، آکادمی، کتابخانه و آرکید را باز می‌کند. دستیار هوش مصنوعی و سایر خدمات به طرح پولی نیاز دارند.",
    es: "Cada cuenta nueva tiene una prueba gratuita de 7 días. Abre las noticias, la comunidad, los productos de asistencia, la Academia, la Biblioteca y el Arcade. El asistente de IA y los demás servicios requieren un plan de pago.",
    de: "Jedes neue Konto erhält eine kostenlose Testphase von 7 Tagen. Sie schaltet Nachrichten, Community, Hilfsmittel, Akademie, Bibliothek und Arcade frei. Der KI-Assistent und die übrigen Dienste erfordern einen kostenpflichtigen Tarif.",
    pt: "Cada conta nova tem um teste gratuito de 7 dias. Ele abre as notícias, a comunidade, os produtos assistivos, a Academia, a Biblioteca e o Arcade. O assistente de IA e os demais serviços exigem um plano pago.",
    zh: "每个新账户都有7天免费试用。试用期内可使用新闻、社区、辅助产品、学院、图书馆和街机。AI助手及其他服务需要付费套餐。",
    tr: "Her yeni hesap 7 günlük ücretsiz deneme alır. Deneme haberleri, topluluğu, yardımcı ürünleri, Akademi'yi, Kütüphane'yi ve Arcade'i açar. Yapay zekâ asistanı ve diğer hizmetler ücretli plan gerektirir.",
    fr: "Chaque nouveau compte bénéficie d'un essai gratuit de 7 jours. Il ouvre les actualités, la communauté, les produits d'assistance, l'Académie, la Bibliothèque et l'Arcade. L'assistant IA et les autres services nécessitent un forfait payant.",
    ru: "Каждый новый аккаунт получает бесплатный пробный период на 7 дней. Он открывает новости, сообщество, вспомогательные продукты, Академию, Библиотеку и Аркаду. Для ИИ-ассистента и остальных сервисов нужен платный тариф.",
  },
  language: {
    en: "Use the language menu in the top navigation bar to change the language. Visionex is available in 20 languages.",
    ar: "استخدم قائمة اللغة في شريط التنقل العلوي لتغيير اللغة. تتوفر Visionex بـ 20 لغة.",
    ur: "زبان بدلنے کے لیے اوپر نیویگیشن بار میں زبان کا مینو استعمال کریں۔ Visionex 20 زبانوں میں دستیاب ہے۔",
    hi: "भाषा बदलने के लिए ऊपर नेविगेशन बार में भाषा मेनू का उपयोग करें। Visionex 20 भाषाओं में उपलब्ध है।",
    id: "Gunakan menu bahasa di bilah navigasi atas untuk mengganti bahasa. Visionex tersedia dalam 20 bahasa.",
    ja: "言語を変えるには、上部ナビゲーションバーの言語メニューを使ってください。Visionexは20言語に対応しています。",
    it: "Usa il menu della lingua nella barra di navigazione in alto per cambiare lingua. Visionex è disponibile in 20 lingue.",
    ko: "언어를 바꾸려면 상단 탐색 바의 언어 메뉴를 사용하세요. Visionex는 20개 언어를 지원합니다.",
    nl: "Gebruik het taalmenu in de navigatiebalk bovenaan om de taal te wijzigen. Visionex is beschikbaar in 20 talen.",
    pl: "Aby zmienić język, użyj menu języka na górnym pasku nawigacji. Visionex jest dostępny w 20 językach.",
    vi: "Dùng menu ngôn ngữ trên thanh điều hướng phía trên để đổi ngôn ngữ. Visionex có 20 ngôn ngữ.",
    bn: "ভাষা বদলাতে উপরের নেভিগেশন বারের ভাষা মেনু ব্যবহার করুন। Visionex 20টি ভাষায় পাওয়া যায়।",
    fa: "برای تغییر زبان از منوی زبان در نوار پیمایش بالا استفاده کنید. Visionex به 20 زبان در دسترس است.",
    es: "Usa el menú de idioma de la barra de navegación superior para cambiar el idioma. Visionex está disponible en 20 idiomas.",
    de: "Ändere die Sprache über das Sprachmenü in der oberen Navigationsleiste. Visionex ist in 20 Sprachen verfügbar.",
    pt: "Use o menu de idioma na barra de navegação superior para mudar o idioma. O Visionex está disponível em 20 idiomas.",
    zh: "请使用顶部导航栏中的语言菜单切换语言。Visionex 支持 20 种语言。",
    tr: "Dili değiştirmek için üstteki gezinme çubuğundaki dil menüsünü kullanın. Visionex 20 dilde kullanılabilir.",
    fr: "Utilisez le menu de langue de la barre de navigation en haut pour changer de langue. Visionex est disponible en 20 langues.",
    ru: "Чтобы сменить язык, используйте меню языка на верхней панели навигации. Visionex доступен на 20 языках.",
  },
  contact: {
    en: "You can reach the Visionex team through the contact page.",
    ar: "يمكنك التواصل مع فريق Visionex عبر صفحة التواصل.",
    ur: "آپ Visionex ٹیم سے رابطہ صفحے کے ذریعے رابطہ کر سکتے ہیں۔",
    hi: "आप संपर्क पृष्ठ के माध्यम से Visionex टीम से संपर्क कर सकते हैं।",
    id: "Anda dapat menghubungi tim Visionex melalui halaman kontak.",
    ja: "Visionexチームへのお問い合わせは、お問い合わせページからどうぞ。",
    it: "Puoi contattare il team Visionex tramite la pagina dei contatti.",
    ko: "문의 페이지에서 Visionex 팀에 연락할 수 있어요.",
    nl: "Je kunt het Visionex-team bereiken via de contactpagina.",
    pl: "Z zespołem Visionex skontaktujesz się przez stronę kontaktową.",
    vi: "Bạn có thể liên hệ đội ngũ Visionex qua trang liên hệ.",
    bn: "যোগাযোগ পৃষ্ঠার মাধ্যমে আপনি Visionex টিমের সঙ্গে যোগাযোগ করতে পারেন।",
    fa: "از طریق صفحه تماس می‌توانید با تیم Visionex در ارتباط باشید.",
    es: "Puedes contactar con el equipo de Visionex desde la página de contacto.",
    de: "Das Visionex-Team erreichst du über die Kontaktseite.",
    pt: "Você pode falar com a equipe do Visionex pela página de contato.",
    zh: "你可以通过联系页面联系 Visionex 团队。",
    tr: "Visionex ekibine iletişim sayfasından ulaşabilirsiniz.",
    fr: "Vous pouvez joindre l'équipe Visionex via la page de contact.",
    ru: "Связаться с командой Visionex можно на странице контактов.",
  },
};

/** The link text for the answers that point somewhere. `trial` reuses the Pricing label from the navigation catalogue. */
export const CONTACT_LABEL: Record<Locale, string> = {
  en: "Contact us", ar: "تواصل معنا", ur: "ہم سے رابطہ", hi: "संपर्क करें", id: "Hubungi kami",
  ja: "お問い合わせ", it: "Contattaci", ko: "문의하기", nl: "Contact", pl: "Kontakt",
  vi: "Liên hệ", bn: "যোগাযোগ", fa: "تماس با ما", es: "Contacto", de: "Kontakt",
  pt: "Contato", zh: "联系我们", tr: "İletişim", fr: "Nous contacter", ru: "Контакты",
};
