// The phrases and replies behind the local intent engine — data only.
//
// Everything here is public, non-personal wording: no secret, no price, no
// account state, nothing that differs between two senders. That is the rule for
// what may live in this file, because a reply built from it is the same reply
// for everybody and can therefore never leak one person's data to another.
//
// ── What is deliberately not here ───────────────────────────────────────────
//
// Plan status, VX balance, cancellation, anything that reads or changes an
// account. Those need the caller's identity and the caller's rows, so they stay
// with the code that already owns them (the WhatsApp plan notice, the website's
// own pages). A phrase list cannot answer "what is my balance"; it can only
// pretend to.
//
// Language switching is not here either: WhatsApp already has its own language
// menu and the website keeps the preference in its own context. A second copy of
// that decision is a second answer to "which language am I in".
//
// ── Adding a phrase ─────────────────────────────────────────────────────────
//
// Write it the way a native speaker types it, in the locale's own script. The
// matcher folds case, accents, Arabic diacritics and punctuation on both sides,
// so there is no need to list those variants. A phrase that means two things
// (the Spanish "buenas noches" is both a greeting and a goodbye) does not
// belong in either list — a test fails on a phrase that lands in two intents.
// Bump CATALOGUE_VERSION when anything below changes.

export const CATALOGUE_VERSION = "2026.10.1";

export const LOCALES = [
  "en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl",
  "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru",
] as const;
export type Locale = (typeof LOCALES)[number];

export type SocialIntent = "greeting" | "farewell" | "thanks" | "help";
export type NavTarget = "library" | "academy" | "games" | "bazaar" | "services" | "pricing" | "news";

export const SOCIAL_PHRASES: Record<SocialIntent, Record<Locale, string[]>> = {
  greeting: {
    en: ["hi", "hello", "hey", "hey there", "hi there", "hello there", "good morning", "good afternoon", "good evening", "greetings", "howdy"],
    ar: ["مرحبا", "أهلا", "اهلا وسهلا", "مرحبا بك", "السلام عليكم", "السلام عليكم ورحمة الله", "صباح الخير", "مساء الخير", "هلا", "هلا والله"],
    ur: ["السلام علیکم", "سلام", "ہیلو", "ہائے", "آداب", "صبح بخیر", "شام بخیر"],
    hi: ["नमस्ते", "नमस्कार", "हैलो", "हेलो", "हाय", "सुप्रभात", "शुभ संध्या"],
    id: ["halo", "hai", "hallo", "selamat pagi", "selamat siang", "selamat sore", "assalamualaikum"],
    ja: ["こんにちは", "こんにちわ", "おはよう", "おはようございます", "こんばんは", "やあ", "ハロー"],
    it: ["ciao", "salve", "buongiorno", "buonasera", "buon pomeriggio", "ehi"],
    ko: ["안녕", "안녕하세요", "안녕하십니까", "하이", "헬로"],
    nl: ["hallo", "hoi", "hey", "goedemorgen", "goedemiddag", "goedenavond", "dag"],
    pl: ["cześć", "witaj", "dzień dobry", "dobry wieczór", "hej", "siema"],
    vi: ["xin chào", "chào", "chào bạn", "alo", "chào buổi sáng"],
    bn: ["হ্যালো", "হাই", "নমস্কার", "আসসালামু আলাইকুম", "সালাম", "শুভ সকাল"],
    fa: ["سلام", "درود", "سلام علیکم", "صبح بخیر", "عصر بخیر", "وقت بخیر"],
    es: ["hola", "buenos dias", "buenas tardes", "buenas", "saludos", "que tal"],
    de: ["hallo", "hi", "hey", "guten morgen", "guten tag", "guten abend", "moin", "servus", "grüß gott"],
    pt: ["olá", "oi", "bom dia", "boa tarde", "e ai"],
    zh: ["你好", "您好", "嗨", "哈喽", "早上好", "下午好", "晚上好", "早安"],
    tr: ["merhaba", "selam", "selamlar", "günaydın", "iyi günler", "iyi akşamlar"],
    fr: ["bonjour", "salut", "bonsoir", "coucou", "allô", "hello"],
    ru: ["привет", "здравствуйте", "здравствуй", "добрый день", "доброе утро", "добрый вечер", "приветствую"],
  },
  farewell: {
    en: ["bye", "bye bye", "goodbye", "see you", "see you later", "good night", "take care", "cya"],
    ar: ["مع السلامة", "الى اللقاء", "وداعا", "تصبح على خير", "في أمان الله", "باي"],
    ur: ["خدا حافظ", "الوداع", "اللہ حافظ", "شب بخیر", "پھر ملیں گے"],
    hi: ["अलविदा", "बाय", "फिर मिलेंगे", "शुभ रात्रि", "टाटा"],
    id: ["dadah", "sampai jumpa", "selamat tinggal", "sampai ketemu", "bye"],
    ja: ["さようなら", "さよなら", "じゃあね", "またね", "おやすみ", "おやすみなさい", "バイバイ"],
    it: ["arrivederci", "addio", "a presto", "ci vediamo", "buonanotte", "ciao ciao"],
    ko: ["안녕히 가세요", "안녕히 계세요", "잘 가", "잘가요", "잘 자요", "바이"],
    nl: ["doei", "tot ziens", "dag dag", "tot later", "welterusten", "vaarwel"],
    pl: ["do widzenia", "pa", "na razie", "dobranoc", "żegnaj"],
    vi: ["tạm biệt", "chào tạm biệt", "hẹn gặp lại", "ngủ ngon"],
    bn: ["বিদায়", "আবার দেখা হবে", "শুভ রাত্রি", "বাই"],
    fa: ["خداحافظ", "خدانگهدار", "شب بخیر", "بدرود", "فعلا"],
    es: ["adiós", "hasta luego", "hasta pronto", "nos vemos", "hasta mañana"],
    de: ["tschüss", "tschuess", "auf wiedersehen", "bis später", "bis bald", "gute nacht"],
    pt: ["tchau", "adeus", "até logo", "até mais", "até amanhã"],
    zh: ["再见", "拜拜", "晚安", "回头见", "下次见"],
    tr: ["hoşça kal", "hoşçakal", "güle güle", "görüşürüz", "iyi geceler", "bay bay"],
    fr: ["au revoir", "adieu", "à bientôt", "à plus", "bonne nuit"],
    ru: ["пока", "до свидания", "до встречи", "спокойной ночи", "прощай"],
  },
  thanks: {
    en: ["thanks", "thank you", "thx", "thank you so much", "many thanks", "thanks a lot", "ty"],
    ar: ["شكرا", "شكرا لك", "شكرا جزيلا", "مشكور", "يعطيك العافية", "تسلم", "جزاك الله خيرا", "شكرا كثير", "ألف شكر"],
    ur: ["شکریہ", "بہت شکریہ", "مہربانی"],
    hi: ["धन्यवाद", "शुक्रिया", "थैंक्स", "थैंक यू", "बहुत धन्यवाद"],
    id: ["terima kasih", "makasih", "thanks", "trims", "terima kasih banyak"],
    ja: ["ありがとう", "ありがとうございます", "どうも", "ありがとうございました", "サンキュー"],
    it: ["grazie", "grazie mille", "ti ringrazio"],
    ko: ["감사합니다", "고마워", "고마워요", "감사해요", "땡큐"],
    nl: ["bedankt", "dank je", "dank u", "dankjewel", "dankuwel", "hartelijk dank"],
    pl: ["dziękuję", "dzięki", "bardzo dziękuję"],
    vi: ["cảm ơn", "cám ơn", "cảm ơn bạn", "cảm ơn nhiều"],
    bn: ["ধন্যবাদ", "থ্যাংক ইউ", "অনেক ধন্যবাদ"],
    fa: ["ممنون", "متشکرم", "مرسی", "ممنونم", "سپاس", "خیلی ممنون"],
    es: ["gracias", "muchas gracias", "mil gracias"],
    de: ["danke", "vielen dank", "danke schön", "dankeschön"],
    pt: ["obrigado", "obrigada", "muito obrigado", "muito obrigada", "valeu"],
    zh: ["谢谢", "谢谢你", "多谢", "感谢", "谢谢您"],
    tr: ["teşekkürler", "teşekkür ederim", "sağ ol", "eyvallah", "çok teşekkürler"],
    fr: ["merci", "merci beaucoup", "merci bien"],
    ru: ["спасибо", "благодарю", "большое спасибо", "спс"],
  },
  help: {
    en: ["help", "what can you do", "what can you do for me", "how can you help", "how does this work"],
    ar: ["مساعدة", "ساعدني", "ماذا تستطيع أن تفعل", "ماذا يمكنك أن تفعل", "كيف تساعدني", "شو بتقدر تعمل", "ايش تقدر تسوي"],
    ur: ["مدد", "آپ کیا کر سکتے ہیں"],
    hi: ["मदद", "सहायता", "आप क्या कर सकते हैं"],
    id: ["bantuan", "tolong", "apa yang bisa kamu lakukan"],
    ja: ["ヘルプ", "助けて", "何ができますか"],
    it: ["aiuto", "cosa puoi fare"],
    ko: ["도움말", "도와줘", "뭘 할 수 있어"],
    nl: ["hulp", "help", "wat kun je doen"],
    pl: ["pomoc", "co potrafisz", "co możesz zrobić"],
    vi: ["giúp", "trợ giúp", "bạn làm được gì"],
    bn: ["সাহায্য", "আপনি কী করতে পারেন"],
    fa: ["کمک", "راهنما", "چه کاری می‌توانی بکنی"],
    es: ["ayuda", "que puedes hacer"],
    de: ["hilfe", "was kannst du"],
    pt: ["ajuda", "o que você pode fazer"],
    zh: ["帮助", "你能做什么", "你可以做什么"],
    tr: ["yardım", "neler yapabilirsin"],
    fr: ["aide", "que peux-tu faire"],
    ru: ["помощь", "что ты умеешь", "что ты можешь"],
  },
};

export const SOCIAL_REPLIES: Record<"greeting" | "farewell" | "thanks", Record<Locale, string>> = {
  greeting: {
    en: "Hello! How can I help you today?",
    ar: "أهلاً بك! كيف يمكنني مساعدتك اليوم؟",
    ur: "ہیلو! آج میں آپ کی کیسے مدد کر سکتا ہوں؟",
    hi: "नमस्ते! आज मैं आपकी कैसे मदद कर सकता हूँ?",
    id: "Halo! Ada yang bisa saya bantu hari ini?",
    ja: "こんにちは！今日はどのようなご用件でしょうか？",
    it: "Ciao! Come posso aiutarti oggi?",
    ko: "안녕하세요! 오늘 무엇을 도와드릴까요?",
    nl: "Hallo! Waarmee kan ik je vandaag helpen?",
    pl: "Cześć! W czym mogę dziś pomóc?",
    vi: "Xin chào! Hôm nay tôi có thể giúp gì cho bạn?",
    bn: "হ্যালো! আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
    fa: "سلام! امروز چطور می‌توانم کمکتان کنم؟",
    es: "¡Hola! ¿En qué puedo ayudarte hoy?",
    de: "Hallo! Wie kann ich dir heute helfen?",
    pt: "Olá! Como posso ajudar você hoje?",
    zh: "你好！今天我能帮你什么？",
    tr: "Merhaba! Bugün size nasıl yardımcı olabilirim?",
    fr: "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
    ru: "Здравствуйте! Чем могу помочь сегодня?",
  },
  farewell: {
    en: "Goodbye! I'm here whenever you need me.",
    ar: "إلى اللقاء! أنا هنا متى احتجت إليّ.",
    ur: "خدا حافظ! جب بھی ضرورت ہو میں حاضر ہوں۔",
    hi: "अलविदा! जब भी ज़रूरत हो, मैं यहाँ हूँ।",
    id: "Sampai jumpa! Saya di sini kapan pun Anda butuh.",
    ja: "さようなら！必要なときはいつでもどうぞ。",
    it: "Arrivederci! Sono qui ogni volta che ti serve.",
    ko: "안녕히 가세요! 필요하실 때 언제든 불러 주세요.",
    nl: "Tot ziens! Ik ben er als je me nodig hebt.",
    pl: "Do widzenia! Jestem tu, gdy tylko mnie potrzebujesz.",
    vi: "Tạm biệt! Tôi luôn ở đây khi bạn cần.",
    bn: "বিদায়! যখনই দরকার, আমি এখানে আছি।",
    fa: "خداحافظ! هر وقت لازم داشتید من اینجا هستم.",
    es: "¡Hasta luego! Aquí estaré cuando me necesites.",
    de: "Auf Wiedersehen! Ich bin da, wenn du mich brauchst.",
    pt: "Até logo! Estou aqui sempre que precisar.",
    zh: "再见！需要时我随时在这里。",
    tr: "Hoşça kalın! İhtiyacınız olduğunda buradayım.",
    fr: "Au revoir ! Je suis là quand vous avez besoin de moi.",
    ru: "До свидания! Я здесь, когда понадоблюсь.",
  },
  thanks: {
    en: "You're welcome!",
    ar: "عفواً! يسعدني مساعدتك.",
    ur: "خوش آمدید! آپ کی مدد کر کے خوشی ہوئی۔",
    hi: "आपका स्वागत है!",
    id: "Sama-sama!",
    ja: "どういたしまして！",
    it: "Prego!",
    ko: "천만에요!",
    nl: "Graag gedaan!",
    pl: "Nie ma za co!",
    vi: "Không có gì!",
    bn: "আপনাকে স্বাগতম!",
    fa: "خواهش می‌کنم!",
    es: "¡De nada!",
    de: "Gern geschehen!",
    pt: "De nada!",
    zh: "不客气！",
    tr: "Rica ederim!",
    fr: "De rien !",
    ru: "Пожалуйста!",
  },
};

/** The sentence that introduces the list of places the assistant can take someone. */
export const HELP_LEAD: Record<Locale, string> = {
  en: "I can answer your questions and take you to",
  ar: "يمكنني الإجابة عن أسئلتك وأخذك إلى",
  ur: "میں آپ کے سوالوں کے جواب دے سکتا ہوں اور آپ کو یہاں لے جا سکتا ہوں",
  hi: "मैं आपके सवालों के जवाब दे सकता हूँ और आपको यहाँ ले जा सकता हूँ",
  id: "Saya bisa menjawab pertanyaan Anda dan mengantar Anda ke",
  ja: "ご質問にお答えし、次のページへご案内できます",
  it: "Posso rispondere alle tue domande e portarti a",
  ko: "질문에 답하고 다음 메뉴로 안내해 드릴 수 있어요",
  nl: "Ik kan je vragen beantwoorden en je brengen naar",
  pl: "Mogę odpowiadać na pytania i przenieść Cię do",
  vi: "Tôi có thể trả lời câu hỏi và đưa bạn đến",
  bn: "আমি আপনার প্রশ্নের উত্তর দিতে এবং আপনাকে এখানে নিয়ে যেতে পারি",
  fa: "می‌توانم به پرسش‌هایتان پاسخ دهم و شما را به این بخش‌ها ببرم",
  es: "Puedo responder tus preguntas y llevarte a",
  de: "Ich kann deine Fragen beantworten und dich zu folgenden Bereichen bringen",
  pt: "Posso responder às suas perguntas e levar você a",
  zh: "我可以回答你的问题，并带你前往",
  tr: "Sorularınızı yanıtlayabilir ve sizi şuralara götürebilirim",
  fr: "Je peux répondre à vos questions et vous emmener vers",
  ru: "Я могу ответить на ваши вопросы и перенаправить вас в раздел",
};

/** The pages a one-word request can open. Every path is a public route. */
export const NAV_PATHS: Record<NavTarget, string> = {
  library: "/library",
  academy: "/academy",
  games: "/games",
  bazaar: "/bazaar",
  services: "/services",
  pricing: "/pricing",
  news: "/news",
};

// Order matches NAV_PATHS: library, academy, games, bazaar, services, pricing, news.
export const NAV_TARGETS: readonly NavTarget[] = ["library", "academy", "games", "bazaar", "services", "pricing", "news"];

export const NAV_LABELS: Record<Locale, [string, string, string, string, string, string, string]> = {
  en: ["Library", "Academy", "Games", "Bazaar", "Services", "Pricing", "News"],
  ar: ["المكتبة", "الأكاديمية", "الألعاب", "البازار", "الخدمات", "الأسعار", "الأخبار"],
  ur: ["لائبریری", "اکیڈمی", "گیمز", "بازار", "خدمات", "قیمتیں", "خبریں"],
  hi: ["पुस्तकालय", "अकादमी", "गेम्स", "बाज़ार", "सेवाएँ", "कीमतें", "समाचार"],
  id: ["Perpustakaan", "Akademi", "Permainan", "Bazar", "Layanan", "Harga", "Berita"],
  ja: ["ライブラリ", "アカデミー", "ゲーム", "バザー", "サービス", "料金", "ニュース"],
  it: ["Biblioteca", "Accademia", "Giochi", "Bazar", "Servizi", "Prezzi", "Notizie"],
  ko: ["도서관", "아카데미", "게임", "바자르", "서비스", "요금", "뉴스"],
  nl: ["Bibliotheek", "Academie", "Spellen", "Bazaar", "Diensten", "Prijzen", "Nieuws"],
  pl: ["Biblioteka", "Akademia", "Gry", "Bazar", "Usługi", "Cennik", "Wiadomości"],
  vi: ["Thư viện", "Học viện", "Trò chơi", "Chợ", "Dịch vụ", "Bảng giá", "Tin tức"],
  bn: ["গ্রন্থাগার", "একাডেমি", "গেমস", "বাজার", "সেবা", "মূল্য", "সংবাদ"],
  fa: ["کتابخانه", "آکادمی", "بازی‌ها", "بازار", "خدمات", "قیمت‌ها", "اخبار"],
  es: ["Biblioteca", "Academia", "Juegos", "Bazar", "Servicios", "Precios", "Noticias"],
  de: ["Bibliothek", "Akademie", "Spiele", "Basar", "Dienste", "Preise", "Nachrichten"],
  pt: ["Biblioteca", "Academia", "Jogos", "Bazar", "Serviços", "Preços", "Notícias"],
  zh: ["图书馆", "学院", "游戏", "集市", "服务", "价格", "新闻"],
  tr: ["Kütüphane", "Akademi", "Oyunlar", "Çarşı", "Hizmetler", "Fiyatlar", "Haberler"],
  fr: ["Bibliothèque", "Académie", "Jeux", "Bazar", "Services", "Tarifs", "Actualités"],
  ru: ["Библиотека", "Академия", "Игры", "Базар", "Услуги", "Цены", "Новости"],
};

/**
 * Words that may precede a page name ("open the library"). A leading article
 * is not listed: it is removed by the matcher in the locales that have one.
 */
export const OPEN_VERBS: Record<Locale, string[]> = {
  en: ["open", "go to", "take me to", "show me", "show"],
  ar: ["افتح", "اذهب الى", "خذني الى", "اعرض", "ورجيني"],
  ur: ["کھولو", "کھولیں", "مجھے لے چلو"],
  hi: ["खोलो", "खोलें", "ले चलो"],
  id: ["buka", "pergi ke", "tampilkan"],
  ja: ["開いて", "開く", "表示して"],
  it: ["apri", "vai a", "portami a", "mostrami"],
  ko: ["열어줘", "열어", "보여줘"],
  nl: ["open", "ga naar", "toon", "laat zien"],
  pl: ["otwórz", "idź do", "pokaż"],
  vi: ["mở", "đi đến", "cho tôi xem"],
  bn: ["খোলো", "খুলুন", "দেখাও"],
  fa: ["باز کن", "برو به", "نشان بده"],
  es: ["abre", "abrir", "ve a", "llévame a", "muéstrame"],
  de: ["öffne", "gehe zu", "zeige", "zeig mir"],
  pt: ["abra", "abrir", "vá para", "leve-me para", "mostre"],
  zh: ["打开", "去", "带我去", "显示"],
  tr: ["aç", "git", "göster", "beni götür"],
  fr: ["ouvre", "ouvrir", "va à", "emmène-moi à", "montre"],
  ru: ["открой", "открыть", "перейди в", "покажи"],
};

/**
 * Other names for the same page. Kept short on purpose: each one is a word
 * that now opens a page instead of reaching the assistant.
 */
export const NAV_EXTRA: Partial<Record<NavTarget, Partial<Record<Locale, string[]>>>> = {
  library: { en: ["books", "the library"], ar: ["الكتب", "مكتبة"] },
  academy: { en: ["courses", "lessons", "learning"], ar: ["الدورات", "الدروس"] },
  games: { en: ["game", "arcade"], ar: ["العاب", "لعبة"] },
  bazaar: { en: ["shop", "store", "stores", "marketplace", "market"], ar: ["المتجر", "المتاجر", "السوق", "التسوق"] },
  services: { en: ["service"], ar: ["خدمة"] },
  pricing: { en: ["plans", "prices", "price", "subscription plans"], ar: ["الباقات", "الاشتراكات", "الخطط", "السعر"] },
  news: { en: ["headlines"], ar: ["اخبار"] },
};
