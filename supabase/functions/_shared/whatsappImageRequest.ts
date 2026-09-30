// "Send me a photo of ..." — a request for a picture that already exists.
//
// This is the one place that decides whether a message asks Visionex to FIND and
// SEND an existing image. It is deliberately narrow, because the cost of a wrong
// match is a search nobody asked for:
//
//   • an image word AND a retrieval verb (send / find / show / search) are both
//     required — "a photo of a cat" alone is a conversation, not a request;
//   • any verb that means MAKE (generate, create, draw, design ...) rules the
//     message out, so a request to create a picture never reaches this flow and
//     goes on to whatever handled it before;
//   • a slash command is never a request here.
//
// Pure: a string in, a search phrase or null out. Twenty languages, matched on
// words (letters, digits and nothing else count as part of a word), with the
// unspaced scripts matched as substrings because they have no word boundary.

export interface ImageRequest {
  /** What the picture should show: no verbs, no image word, no "please". */
  query: string;
}

export const IMAGE_QUERY_MAX_CHARS = 80;
const MESSAGE_MAX_CHARS = 140;

/** Words for "picture", in the supported languages. */
const IMAGE_WORDS = [
  "image", "images", "photo", "photos", "picture", "pictures", "pic", "pics", "photograph",
  "صورة", "صوره", "صور",
  "ছবি", "ছবিটি", "ফটো",
  "bild", "bilder", "foto", "fotos",
  "imagen", "imágenes", "imagenes", "fotografía", "fotografia",
  "عکس", "تصویر", "تصاویر",
  "immagine", "immagini",
  "तस्वीर", "फोटो", "चित्र", "इमेज",
  "gambar",
  "画像", "写真",
  "이미지", "사진",
  "afbeelding", "afbeeldingen", "plaatje",
  "obraz", "obrazek", "zdjęcie", "zdjecie", "zdjęcia", "zdjecia",
  "imagem", "imagens",
  "изображение", "изображения", "картинку", "картинка", "картинки", "фото", "фотографию", "фотография", "фотографии",
  "resim", "görsel", "gorsel", "fotoğraf", "fotograf",
  "فوٹو",
  "hình ảnh", "hình", "ảnh", "bức ảnh",
  "图片", "图像", "照片", "相片",
];

/** Words for "send", "find", "show", "search" (an explicit request to retrieve something that exists). */
const RETRIEVE_VERBS = [
  "send", "find", "search", "show", "get", "give", "fetch", "look up",
  "أرسل", "ارسل", "أرسلي", "ارسلي", "ابعت", "ابعتلي", "ابعث", "ابعثلي", "وأرسلها", "وارسلها", "وأرسلهم", "وابعتها", "وأرسلهما", "دور", "دوّر", "دورلي", "ابحث", "ابحثلي", "جيب", "جيبلي", "أعطني", "اعطيني", "هات", "وريني", "أرني", "ارني",
  "পাঠাও", "পাঠান", "খুঁজে", "খুঁজুন", "দেখাও", "দেখান", "দাও",
  "schick", "schicke", "schick mir", "sende", "finde", "suche", "zeig", "zeige", "gib",
  "envía", "envia", "envíame", "enviame", "manda", "mándame", "mandame", "busca", "encuentra", "muestra", "dame", "enséñame",
  "بفرست", "بفرستید", "بده", "پیدا", "جستجو", "نشان بده", "بفرستین",
  "envoie", "envoyez", "envoie-moi", "trouve", "trouvez", "cherche", "montre", "montrez", "donne",
  "भेजो", "भेजें", "भेज", "ढूंढो", "ढूंढ", "खोजो", "दिखाओ", "दिखाइए", "दो",
  "kirim", "kirimkan", "cari", "carikan", "tunjukkan", "berikan",
  "invia", "inviami", "mandami", "manda", "trova", "cerca", "mostra", "dammi",
  "送って", "送ってください", "送信して", "探して", "見せて", "ください",
  "보내", "보내줘", "보내주세요", "찾아", "찾아줘", "찾아주세요", "보여줘", "보여주세요",
  "stuur", "zoek", "vind", "toon", "geef", "stuur me",
  "wyślij", "wyslij", "znajdź", "znajdz", "szukaj", "pokaż", "pokaz", "daj",
  "envie", "mande", "procura", "procure", "encontre", "mostra", "me dá", "me de",
  "отправь", "пришли", "найди", "покажи", "дай", "скинь", "отправьте",
  "gönder", "gonder", "yolla", "bul", "ara", "göster", "goster", "ver",
  "بھیجو", "بھیجیں", "بھیج", "تلاش", "دکھاؤ", "دکھائیں", "ڈھونڈو",
  "gửi", "tìm", "cho xem", "cho tôi",
  "发给我", "发送", "发", "找", "搜索", "给我", "找一张", "搜一张",
];

/** Verbs that mean MAKE. One of these anywhere and the message is not a request to find a picture. */
const CREATE_VERBS = [
  "generate", "generated", "create", "make", "draw", "design", "paint", "render", "imagine", "illustrate", "produce", "edit", "convert",
  "أنشئ", "انشئ", "ولّد", "ولد", "اصنع", "اعمل", "ارسم", "صمم", "صمّم", "عدل", "حوّل",
  "তৈরি", "বানাও", "আঁকো", "আঁক",
  "generiere", "erstelle", "erzeuge", "zeichne", "gestalte",
  "genera", "crea", "dibuja", "diseña", "haz", "pinta",
  "بساز", "ایجاد", "بکش", "طراحی", "تولید",
  "génère", "genere", "crée", "cree", "dessine", "fais", "conçois",
  "बनाओ", "बनाइए", "बनाएं", "बना", "बनाकर", "चित्रित",
  "buat", "buatkan", "bikin", "gambarkan", "lukis",
  "disegna", "realizza", "crea",
  "生成", "作成", "描いて", "作って", "描く",
  "생성", "만들어", "그려",
  "genereer", "maak", "teken", "ontwerp",
  "wygeneruj", "stwórz", "stworz", "narysuj", "zaprojektuj",
  "gera", "cria", "desenha", "desenhe", "crie", "faça", "faca",
  "сгенерируй", "создай", "нарисуй", "сделай", "придумай",
  "oluştur", "olustur", "çiz", "ciz", "yap", "üret",
  "بنائیں", "بناؤ", "تخلیق", "بنا",
  
  "tạo", "vẽ", "thiết kế",
  "创建", "画一", "画个", "画张", "绘制", "制作", "设计", "生成",
];

/** Words that carry no part of the subject, stripped from either end of what is left. */
const EDGE_FILLERS = [
  "them", "these", "those", "on", "حول", "بخصوص", "sobre", "acerca", "sur", "propos", "zum", "su", "sul", "sulla", "sull", "over", "na", "temat", "об", "پر", "بارے", "درباره", "সম্পর্কে", "về",
  "a", "an", "the", "of", "me", "to", "it", "for", "some", "about", "please", "and", "my", "us",
  "لي", "لى", "من", "عن", "على", "إلى", "الى", "و", "ل", "رجاء", "لو", "سمحت", "فضلك", "ال",
  "আমাকে", "একটি", "এর", "এবং", "দয়া", "করে", "একটা",
  "von", "vom", "eines", "ein", "eine", "mir", "bitte", "und", "über", "ueber", "den", "die", "das", "zu", "einem", "einer", "mal", "doch",
  "de", "del", "un", "una", "unas", "unos", "por", "favor", "y", "la", "el", "lo", "las", "los", "al", "que",
  "برای", "من", "از", "یک", "لطفا", "لطفاً", "را", "به", "و",
  "du", "des", "le", "les", "une", "moi", "s'il", "te", "plaît", "plait", "vous", "et", "à", "a", "l", "d",
  "मुझे", "का", "की", "के", "एक", "और", "कृपया", "को", "की", "मेरे", "लिए", "का",
  "tolong", "saya", "aku", "ke", "dari", "tentang", "sebuah", "dan", "yang", "dong", "ya", "untuk", "sebuah", "aja",
  "di", "mi", "per", "e", "il", "gli", "ti", "favore",
  "van", "een", "het", "mij", "alsjeblieft", "en", "even",
  "z", "o", "mi", "proszę", "prosze", "i", "ze", "do", "mnie", "na",
  "do", "uma", "um", "me", "por", "favor", "e", "o", "a", "os", "as", "da", "do", "dos", "das", "um", "uns", "pra", "para",
  "мне", "пожалуйста", "и", "о", "про", "с", "на", "мою", "мой", "ну", "плиз",
  "bana", "lütfen", "lutfen", "ve", "bir", "hakkında", "hakkinda", "için", "icin", "bir", "ki", "benim",
  "مجھے", "کی", "کا", "کے", "ایک", "اور", "براہ", "کرم", "کو", "میرے", "لیے",
  "cho", "tôi", "toi", "mình", "minh", "của", "về", "ve", "một", "và", "giúp", "nhé", "nha", "với", "voi", "xem",
  "我", "请", "帮", "一张", "一个", "张", "个", "的", "吧", "下", "一下", "给",
  "の", "を", "は", "が", "に", "で", "て", "も", "と", "お願い", "下さい", "くれ",
  "의", "을", "를", "좀", "줘", "주세요", "은", "는", "이", "가", "도", "한", "장",
];

const SPACED_SCRIPT = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Bengali}\d]/u;
const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Words in a spaced script need a boundary; CJK and Hangul have none, so they match anywhere. */
function wordPattern(words: readonly string[]): RegExp {
  const parts = [...new Set(words)]
    .sort((a, b) => b.length - a.length)
    .map((w) => (SPACED_SCRIPT.test(w) ? `(?<![\\p{L}\\p{N}])${escape(w)}(?![\\p{L}\\p{N}])` : escape(w)));
  return new RegExp(parts.join("|"), "iu");
}

const IMAGE = wordPattern(IMAGE_WORDS);
const RETRIEVE = wordPattern(RETRIEVE_VERBS);
const CREATE = wordPattern(CREATE_VERBS);
const REMOVABLE = new RegExp(`${IMAGE.source}|${RETRIEVE.source}`, "giu");
const FILLER_SET = new Set(EDGE_FILLERS.map((w) => w.toLowerCase()));
/** A sentence about a picture someone already has ("the picture you sent was nice"), not a request. */
const ABOUT_A_PICTURE = /^(?:you|i|we|he|she|they|it|was|is|that|this|which|who|أرسلته|بعتلي|اللي|الذي|الي)(?:\s|$)/iu;
const EDGE_PUNCT = /^[\s:：,.!?؟،。！？…"'«»“”-]+|[\s:：,.!?؟،。！？…"'«»“”-]+$/gu;

/** The request to find and send an existing picture, or null (which means: not this flow's business). */
export function parseImageRequest(text: string | null | undefined): ImageRequest | null {
  const message = (text ?? "").normalize("NFC").trim();
  if (!message || message.length > MESSAGE_MAX_CHARS || message.startsWith("/")) return null;
  if (CREATE.test(message)) return null;
  if (!IMAGE.test(message) || !RETRIEVE.test(message)) return null;

  const stripped = message.replace(REMOVABLE, " ").replace(/\s+/g, " ").replace(EDGE_PUNCT, "").trim();
  const tokens = stripped.split(" ").filter(Boolean);
  const isFiller = (t: string) => FILLER_SET.has(t.toLowerCase().replace(EDGE_PUNCT, ""));
  while (tokens.length && isFiller(tokens[0])) tokens.shift();
  while (tokens.length && isFiller(tokens[tokens.length - 1])) tokens.pop();
  let query = tokens.join(" ");

  // Unspaced scripts leave their particles attached to the subject: 「エッフェル塔の」「埃菲尔铁塔的」.
  query = query.replace(/(?:[のをはがにでてもと的吧下给我请帮]|一下|을|를|은|는|의|좀|줘)+$/u, "").replace(/^(?:[のをはがにでてもと的吧下给我请帮]|一张|一个)+/u, "").trim();
  if (query.length < 2 || query.length > IMAGE_QUERY_MAX_CHARS) return null;
  if (ABOUT_A_PICTURE.test(query)) return null;
  return { query };
}

// ─── Audio recordings, papers and documents ───────────────────────────────
//
// The same rule as for a picture — an explicit find/send verb and a noun for the
// thing — with two more ways out: a verb that means MAKE rules the message out,
// and so does one that means SUMMARISE, EXPLAIN, TRANSLATE or ANALYSE, because
// "summarise this paper" is a question about a document, not a request for one.

export type AssetKind = "audio" | "document";

export interface AssetRequest {
  kind: AssetKind;
  query: string;
}

const AUDIO_WORDS = [
  "audio recording", "audio recordings", "audio clip", "audio", "recording", "recordings", "sound", "sounds",
  "تسجيل صوتي", "تسجيلات صوتية", "مقطع صوتي", "تسجيل", "صوتية", "صوت",
  "অডিও", "রেকর্ডিং", "শব্দ",
  "aufnahme", "tonaufnahme", "geräusch", "klang",
  "grabación", "grabacion", "sonido",
  "ضبط صوتی", "صدا", "صوتی",
  "enregistrement audio", "enregistrement", "son",
  "ऑडियो", "रिकॉर्डिंग", "आवाज़",
  "rekaman", "suara",
  "registrazione", "suono",
  "音声", "録音", "音",
  "오디오", "녹음", "소리",
  "opname", "geluid",
  "nagranie", "dźwięk", "dzwiek",
  "áudio", "gravação", "gravacao", "som",
  "аудио", "аудиозапись", "запись", "звук",
  "ses kaydı", "ses kaydi", "ses",
  "آڈیو", "ریکارڈنگ", "آواز",
  "âm thanh", "ghi âm",
  "音频", "录音", "声音",
];

const DOCUMENT_WORDS = [
  "open-access", "open access", "artículos", "articulos", "artigos", "articoli", "études", "etudes", "estudios", "estudos", "studi", "artikelen", "artykuły", "makaleler", "dokumenty", "dokumenten",
  "research papers", "research paper", "papers", "paper", "pdf", "pdfs", "document", "documents", "article", "articles", "study", "studies", "research", "thesis", "journal article",
  "ملف", "مستند", "وثيقة", "ورقة بحثية", "أوراق بحثية", "أبحاث", "بحث", "دراسة", "دراسات", "مقال", "مقالة",
  "নথি", "গবেষণা", "প্রবন্ধ", "পেপার", "ডকুমেন্ট",
  "dokument", "dokumente", "artikel", "studie", "forschung", "aufsatz", "abschlussarbeit",
  "documento", "documentos", "artículo", "articulo", "estudio", "investigación", "investigacion", "artigo", "estudo", "pesquisa", "articolo", "ricerca",
  "مقاله", "پژوهش", "سند", "مطالعه", "تحقیق",
  "étude", "etude", "recherche", "publication",
  "दस्तावेज़", "दस्तावेज", "शोध", "लेख", "अध्ययन", "पेपर",
  "dokumen", "penelitian", "studi", "makalah", "jurnal",
  "論文", "文書", "資料", "研究",
  "논문", "문서", "연구",
  "onderzoek", "studie",
  "artykuł", "artykul", "badanie", "badania", "praca naukowa",
  "документ", "статья", "статью", "исследование", "исследования", "научную работу",
  "belge", "makale", "araştırma", "arastirma", "çalışma",
  "دستاویز", "مقالہ",
  "tài liệu", "bài báo", "nghiên cứu",
  "文档", "论文", "文件", "研究",
];

/** Verbs that ask about a document or a recording rather than for it. */
const ANALYSE_VERBS = [
  "summarize", "summarise", "summary", "explain", "translate", "analyze", "analyse", "read", "transcribe", "critique", "review",
  "لخص", "لخّص", "اشرح", "ترجم", "حلل", "حلّل", "اقرأ", "ملخص", "فرّغ",
  "resume", "resumen", "explica", "traduce", "analiza", "lee", "transcribe",
  "résume", "resume", "explique", "traduis", "analyse", "lis",
  "fasse", "erkläre", "übersetze", "analysiere", "lies",
  "резюмируй", "кратко", "объясни", "переведи", "проанализируй", "прочитай",
  "özetle", "açıkla", "acikla", "çevir", "cevir", "analiz",
  "总结", "解释", "翻译", "分析", "阅读",
  "要約", "説明", "翻訳", "分析",
  "요약", "설명", "번역", "분석",
  "resuma", "explique", "traduza", "analise",
  "riassumi", "spiega", "traduci", "analizza",
  "vat samen", "leg uit", "vertaal",
  "streść", "streszcz", "wyjaśnij", "przetłumacz",
  "ringkas", "jelaskan", "terjemahkan",
  "tóm tắt", "giải thích", "dịch",
  "सारांश", "समझाओ", "अनुवाद",
  "সারসংক্ষেপ", "ব্যাখ্যা", "অনুবাদ",
  "خلاصه", "توضیح", "ترجمه",
  "خلاصہ", "وضاحت", "ترجمہ",
];

/** The verbs that mean SEND, a subset of the retrieval verbs: "send me the video" is a request for the file itself. */
const SEND_VERBS = [
  "send", "أرسل", "ارسل", "أرسلي", "ارسلي", "ابعت", "ابعتلي", "ابعث", "ابعثلي", "وأرسلها", "وارسلها", "وأرسلهم", "وابعتها",
  "পাঠাও", "পাঠান", "schick", "schicke", "schick mir", "sende", "envía", "envia", "envíame", "enviame", "manda", "mándame", "mandame",
  "بفرست", "بفرستید", "بفرستین", "envoie", "envoyez", "envoie-moi", "भेजो", "भेजें", "भेज", "kirim", "kirimkan",
  "invia", "inviami", "mandami", "送って", "送ってください", "送信して", "보내", "보내줘", "보내주세요", "stuur", "wyślij", "wyslij",
  "envie", "mande", "отправь", "пришли", "отправьте", "скинь", "gönder", "gonder", "yolla", "بھیجو", "بھیجیں", "بھیج", "gửi",
  "发给我", "发送", "发",
];

const AUDIO = wordPattern(AUDIO_WORDS);
const DOCUMENT = wordPattern(DOCUMENT_WORDS);
const ANALYSE = wordPattern(ANALYSE_VERBS);
const SEND = wordPattern(SEND_VERBS);
const ASSET_REMOVABLE = new RegExp(`${AUDIO.source}|${DOCUMENT.source}|${RETRIEVE.source}`, "giu");
/** An audiobook or a podcast has its own flow; "audio" inside those words must not start this one. */
const OTHER_MEDIA = wordPattern([
  "audiobook", "audiobooks", "audio book", "podcast", "podcasts", "كتاب صوتي", "بودكاست", "hörbuch", "livre audio", "audiolibro", "audiolivro", "аудиокнига", "подкаст",
  "有声书", "播客", "オーディオブック", "ポッドキャスト", "오디오북", "팟캐스트", "sesli kitap", "buku audio", "luisterboek", "sách nói", "کتاب صوتی", "پادکست",
]);

/** True when the message says SEND (so a request for a video or a book means the file, not a list of links). */
export function wantsSend(text: string | null | undefined): boolean {
  const message = (text ?? "").normalize("NFC").trim();
  return !!message && message.length <= MESSAGE_MAX_CHARS && !message.startsWith("/") && !CREATE.test(message) && SEND.test(message);
}

function strip(message: string, removable: RegExp): string | null {
  const stripped = message.replace(removable, " ").replace(/\s+/g, " ").replace(EDGE_PUNCT, "").trim();
  const tokens = stripped.split(" ").filter(Boolean);
  const isFiller = (t: string) => FILLER_SET.has(t.toLowerCase().replace(EDGE_PUNCT, ""));
  while (tokens.length && isFiller(tokens[0])) tokens.shift();
  while (tokens.length && isFiller(tokens[tokens.length - 1])) tokens.pop();
  const query = tokens.join(" ").replace(/(?:[のをはがにでてもと的吧下给我请帮]|一下|을|를|은|는|의|좀|줘)+$/u, "").replace(/^(?:[のをはがにでてもと的吧下给我请帮]|一张|一个)+/u, "").trim();
  if (query.length < 2 || query.length > IMAGE_QUERY_MAX_CHARS || ABOUT_A_PICTURE.test(query)) return null;
  return query;
}

/** A request to find and send an existing recording, paper or document, or null. */
export function parseAssetRequest(text: string | null | undefined): AssetRequest | null {
  const message = (text ?? "").normalize("NFC").trim();
  if (!message || message.length > MESSAGE_MAX_CHARS || message.startsWith("/")) return null;
  if (CREATE.test(message) || ANALYSE.test(message) || OTHER_MEDIA.test(message) || IMAGE.test(message)) return null;
  if (!RETRIEVE.test(message)) return null;
  const kind: AssetKind | null = DOCUMENT.test(message) ? "document" : AUDIO.test(message) ? "audio" : null;
  if (!kind) return null;
  const query = strip(message, ASSET_REMOVABLE);
  return query ? { kind, query } : null;
}
