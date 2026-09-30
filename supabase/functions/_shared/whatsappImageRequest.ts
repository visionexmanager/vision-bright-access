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
  "أرسل", "ارسل", "أرسلي", "ارسلي", "ابعت", "ابعتلي", "ابعث", "ابعثلي", "دور", "دوّر", "دورلي", "ابحث", "ابحثلي", "جيب", "جيبلي", "أعطني", "اعطيني", "هات", "وريني", "أرني", "ارني",
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
  "أنشئ", "انشئ", "ولّد", "ولد", "اصنع", "اعمل", "ارسم", "صمم", "صمّم", "عدل", "حوّل", "حول",
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
