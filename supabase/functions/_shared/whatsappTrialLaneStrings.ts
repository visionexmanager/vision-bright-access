// The words of the free-week local features, in all twenty languages.
//
// Placeholders: {left} units remaining, {limit} the allowance, {what} the
// feature's plural name (featRead / featBarcode / featOffice), {url} pricing,
// {value} a scanned code. Pure data.

import { type SupportedLanguage } from "./whatsappLanguages.ts";

export type TrialLaneKey =
  | "note"
  | "featRead"
  | "featBarcode"
  | "featOffice"
  | "exhausted"
  | "nothing"
  | "unavailable"
  | "ocrLanguage"
  | "code";

type Pack = Record<TrialLaneKey, string>;

export const TRIAL_LANE_STRINGS: Record<SupportedLanguage, Pack> = {
  en: {
    note: "Free week: {left} of {limit} {what} left.",
    featRead: "photo text readings", featBarcode: "code scans", featOffice: "document readings",
    exhausted: "You've used all {limit} free {what} in your free week. To keep going without a limit, subscribe: {url}",
    nothing: "I found nothing readable in that, and it wasn't counted. Try a clearer, closer picture.",
    unavailable: "Reading isn't available right now, and it wasn't counted. Please try again later.",
    ocrLanguage: "In the free week, reading text in photos works in Arabic and English only. Other languages need a plan: {url}",
    code: "Code: {value}",
  },
  ar: {
    note: "الأسبوع المجاني: بقي لك {left} من {limit} من {what}.",
    featRead: "قراءات نص الصور", featBarcode: "مسح الرموز", featOffice: "قراءات المستندات",
    exhausted: "استخدمت كل {limit} من {what} المجانية في أسبوعك المجاني. للاستمرار دون حد اشترك: {url}",
    nothing: "لم أجد في هذا ما يمكن قراءته، ولم يُحتسب من حدك. جرّب صورة أوضح وأقرب.",
    unavailable: "القراءة غير متاحة الآن، ولم تُحتسب من حدك. حاول لاحقًا.",
    ocrLanguage: "في الأسبوع المجاني تعمل قراءة نص الصور بالعربية والإنجليزية فقط. اللغات الأخرى تحتاج باقة: {url}",
    code: "الرمز: {value}",
  },
  ur: {
    note: "مفت ہفتہ: {limit} میں سے {left} {what} باقی ہیں۔",
    featRead: "تصویری متن پڑھنے", featBarcode: "کوڈ اسکین", featOffice: "دستاویز پڑھنے",
    exhausted: "آپ نے مفت ہفتے کی تمام {limit} مفت {what} استعمال کر لی ہیں۔ بلا حد جاری رکھنے کے لیے سبسکرائب کریں: {url}",
    nothing: "اس میں پڑھنے کے قابل کچھ نہیں ملا، اور یہ شمار نہیں ہوا۔ زیادہ صاف اور قریب سے تصویر لیں۔",
    unavailable: "پڑھنا ابھی دستیاب نہیں، اور یہ شمار نہیں ہوا۔ بعد میں کوشش کریں۔",
    ocrLanguage: "مفت ہفتے میں تصویر کا متن صرف عربی اور انگریزی میں پڑھا جاتا ہے۔ دوسری زبانوں کے لیے پلان چاہیے: {url}",
    code: "کوڈ: {value}",
  },
  hi: {
    note: "मुफ़्त सप्ताह: {limit} में से {left} {what} बचे हैं।",
    featRead: "फ़ोटो के टेक्स्ट पढ़ना", featBarcode: "कोड स्कैन", featOffice: "दस्तावेज़ पढ़ना",
    exhausted: "आपने मुफ़्त सप्ताह की सभी {limit} मुफ़्त {what} इस्तेमाल कर ली हैं। बिना सीमा जारी रखने के लिए सब्सक्राइब करें: {url}",
    nothing: "इसमें पढ़ने लायक कुछ नहीं मिला, और यह गिना नहीं गया। साफ़ और पास से फ़ोटो लें।",
    unavailable: "पढ़ना अभी उपलब्ध नहीं है, और यह गिना नहीं गया। बाद में कोशिश करें।",
    ocrLanguage: "मुफ़्त सप्ताह में फ़ोटो का टेक्स्ट केवल अरबी और अंग्रेज़ी में पढ़ा जाता है। अन्य भाषाओं के लिए प्लान चाहिए: {url}",
    code: "कोड: {value}",
  },
  id: {
    note: "Pekan gratis: sisa {left} dari {limit} {what}.",
    featRead: "pembacaan teks foto", featBarcode: "pemindaian kode", featOffice: "pembacaan dokumen",
    exhausted: "Anda sudah memakai semua {limit} {what} gratis di pekan gratis. Untuk lanjut tanpa batas, berlangganan: {url}",
    nothing: "Tidak ada yang bisa dibaca di sini, dan tidak dihitung. Coba foto yang lebih jelas dan dekat.",
    unavailable: "Pembacaan belum tersedia saat ini, dan tidak dihitung. Coba lagi nanti.",
    ocrLanguage: "Di pekan gratis, membaca teks foto hanya untuk bahasa Arab dan Inggris. Bahasa lain butuh paket: {url}",
    code: "Kode: {value}",
  },
  ja: {
    note: "無料期間：{what}の残りは{limit}回中{left}回です。",
    featRead: "写真の文字読み取り", featBarcode: "コード読み取り", featOffice: "文書読み取り",
    exhausted: "無料期間の{what}{limit}回をすべて使い切りました。制限なしで続けるには登録してください：{url}",
    nothing: "読み取れるものが見つからず、回数には数えていません。より鮮明に近づけて撮ってください。",
    unavailable: "現在読み取りを利用できません。回数には数えていません。後でお試しください。",
    ocrLanguage: "無料期間の写真の文字読み取りはアラビア語と英語のみです。他の言語はプランが必要です：{url}",
    code: "コード：{value}",
  },
  it: {
    note: "Settimana gratuita: restano {left} di {limit} {what}.",
    featRead: "letture di testo da foto", featBarcode: "scansioni di codici", featOffice: "letture di documenti",
    exhausted: "Hai usato tutte le {limit} {what} gratuite della settimana gratuita. Per continuare senza limiti abbonati: {url}",
    nothing: "Non ho trovato nulla di leggibile e non è stato conteggiato. Prova una foto più nitida e vicina.",
    unavailable: "La lettura non è disponibile ora e non è stata conteggiata. Riprova più tardi.",
    ocrLanguage: "Nella settimana gratuita la lettura del testo nelle foto funziona solo in arabo e inglese. Le altre lingue richiedono un piano: {url}",
    code: "Codice: {value}",
  },
  ko: {
    note: "무료 주간: {what} {limit}회 중 {left}회 남았습니다.",
    featRead: "사진 글자 읽기", featBarcode: "코드 스캔", featOffice: "문서 읽기",
    exhausted: "무료 주간의 {what} {limit}회를 모두 사용했습니다. 제한 없이 계속하려면 구독하세요: {url}",
    nothing: "읽을 수 있는 내용을 찾지 못했고 횟수에 포함하지 않았습니다. 더 선명하고 가까이서 찍어 보세요.",
    unavailable: "지금은 읽기를 사용할 수 없으며 횟수에 포함하지 않았습니다. 나중에 다시 시도하세요.",
    ocrLanguage: "무료 주간에는 사진 글자 읽기가 아랍어와 영어만 가능합니다. 다른 언어는 요금제가 필요합니다: {url}",
    code: "코드: {value}",
  },
  nl: {
    note: "Gratis week: nog {left} van {limit} {what} over.",
    featRead: "tekstlezingen uit foto's", featBarcode: "codescans", featOffice: "documentlezingen",
    exhausted: "Je hebt alle {limit} gratis {what} van je gratis week gebruikt. Neem een abonnement om onbeperkt door te gaan: {url}",
    nothing: "Ik vond niets leesbaars en het is niet meegeteld. Probeer een scherpere, dichtere foto.",
    unavailable: "Lezen is nu niet beschikbaar en is niet meegeteld. Probeer het later opnieuw.",
    ocrLanguage: "In de gratis week werkt tekst lezen in foto's alleen in het Arabisch en Engels. Andere talen vragen een abonnement: {url}",
    code: "Code: {value}",
  },
  pl: {
    note: "Darmowy tydzień: zostało {left} z {limit} {what}.",
    featRead: "odczytów tekstu ze zdjęć", featBarcode: "skanów kodów", featOffice: "odczytów dokumentów",
    exhausted: "Wykorzystano wszystkie {limit} darmowe {what} z darmowego tygodnia. Aby korzystać bez limitu, wykup abonament: {url}",
    nothing: "Nie znalazłem nic do odczytania i nie zostało to policzone. Spróbuj wyraźniejszego, bliższego zdjęcia.",
    unavailable: "Odczyt jest teraz niedostępny i nie został policzony. Spróbuj później.",
    ocrLanguage: "W darmowym tygodniu odczyt tekstu ze zdjęć działa tylko po arabsku i angielsku. Inne języki wymagają planu: {url}",
    code: "Kod: {value}",
  },
  vi: {
    note: "Tuần miễn phí: còn {left} trên {limit} {what}.",
    featRead: "lần đọc chữ trong ảnh", featBarcode: "lần quét mã", featOffice: "lần đọc tài liệu",
    exhausted: "Bạn đã dùng hết {limit} {what} miễn phí của tuần miễn phí. Muốn dùng không giới hạn, hãy đăng ký gói: {url}",
    nothing: "Tôi không tìm thấy gì đọc được và lượt này không bị tính. Hãy thử ảnh rõ và gần hơn.",
    unavailable: "Hiện chưa đọc được và lượt này không bị tính. Vui lòng thử lại sau.",
    ocrLanguage: "Trong tuần miễn phí, đọc chữ trong ảnh chỉ hỗ trợ tiếng Ả Rập và tiếng Anh. Ngôn ngữ khác cần gói: {url}",
    code: "Mã: {value}",
  },
  bn: {
    note: "বিনামূল্যের সপ্তাহ: {limit}টির মধ্যে {left}টি {what} বাকি।",
    featRead: "ছবির লেখা পড়া", featBarcode: "কোড স্ক্যান", featOffice: "নথি পড়া",
    exhausted: "আপনি বিনামূল্যের সপ্তাহের সব {limit}টি {what} ব্যবহার করেছেন। সীমা ছাড়া চালাতে সাবস্ক্রাইব করুন: {url}",
    nothing: "পড়ার মতো কিছু পাইনি, আর এটি গণনায় ধরা হয়নি। আরও স্পষ্ট ও কাছ থেকে ছবি তুলুন।",
    unavailable: "এখন পড়া সম্ভব নয়, আর এটি গণনায় ধরা হয়নি। পরে চেষ্টা করুন।",
    ocrLanguage: "বিনামূল্যের সপ্তাহে ছবির লেখা শুধু আরবি ও ইংরেজিতে পড়া যায়। অন্য ভাষার জন্য প্ল্যান লাগবে: {url}",
    code: "কোড: {value}",
  },
  fa: {
    note: "هفته رایگان: {left} از {limit} {what} باقی مانده است.",
    featRead: "خواندن متن عکس", featBarcode: "اسکن کد", featOffice: "خواندن سند",
    exhausted: "همه {limit} {what} رایگان هفته رایگان را مصرف کرده‌اید. برای ادامه بدون محدودیت اشتراک بگیرید: {url}",
    nothing: "چیز قابل خواندنی پیدا نکردم و حساب نشد. عکس واضح‌تر و نزدیک‌تر بگیرید.",
    unavailable: "خواندن اکنون در دسترس نیست و حساب نشد. بعداً دوباره امتحان کنید.",
    ocrLanguage: "در هفته رایگان خواندن متن عکس فقط برای عربی و انگلیسی کار می‌کند. زبان‌های دیگر طرح می‌خواهند: {url}",
    code: "کد: {value}",
  },
  es: {
    note: "Semana gratis: quedan {left} de {limit} {what}.",
    featRead: "lecturas de texto en fotos", featBarcode: "escaneos de códigos", featOffice: "lecturas de documentos",
    exhausted: "Has usado las {limit} {what} gratuitas de tu semana gratis. Para seguir sin límite, suscríbete: {url}",
    nothing: "No encontré nada legible y no se contó. Prueba una foto más nítida y cercana.",
    unavailable: "La lectura no está disponible ahora y no se contó. Inténtalo más tarde.",
    ocrLanguage: "En la semana gratis, leer texto en fotos solo funciona en árabe e inglés. Otros idiomas requieren un plan: {url}",
    code: "Código: {value}",
  },
  de: {
    note: "Gratiswoche: noch {left} von {limit} {what} übrig.",
    featRead: "Foto-Textlesungen", featBarcode: "Code-Scans", featOffice: "Dokumentlesungen",
    exhausted: "Du hast alle {limit} kostenlosen {what} deiner Gratiswoche verbraucht. Für unbegrenzte Nutzung abonniere: {url}",
    nothing: "Ich habe nichts Lesbares gefunden, und es wurde nicht gezählt. Versuche ein schärferes, näheres Foto.",
    unavailable: "Das Lesen ist gerade nicht verfügbar und wurde nicht gezählt. Versuche es später erneut.",
    ocrLanguage: "In der Gratiswoche funktioniert Textlesen in Fotos nur auf Arabisch und Englisch. Andere Sprachen brauchen einen Tarif: {url}",
    code: "Code: {value}",
  },
  pt: {
    note: "Semana grátis: restam {left} de {limit} {what}.",
    featRead: "leituras de texto em fotos", featBarcode: "leituras de códigos", featOffice: "leituras de documentos",
    exhausted: "Usaste as {limit} {what} grátis da tua semana grátis. Para continuares sem limite, subscreve: {url}",
    nothing: "Não encontrei nada legível e não foi contado. Tenta uma foto mais nítida e próxima.",
    unavailable: "A leitura não está disponível agora e não foi contada. Tenta mais tarde.",
    ocrLanguage: "Na semana grátis, ler texto em fotos só funciona em árabe e inglês. Outras línguas precisam de um plano: {url}",
    code: "Código: {value}",
  },
  zh: {
    note: "免费周：{what}还剩 {left}/{limit} 次。",
    featRead: "照片文字识别", featBarcode: "扫码", featOffice: "文档阅读",
    exhausted: "你已用完免费周的全部 {limit} 次{what}。如需不限次数，请订阅：{url}",
    nothing: "没有读到可识别的内容，此次不计数。请拍得更清晰、更近一些。",
    unavailable: "暂时无法读取，此次不计数。请稍后再试。",
    ocrLanguage: "免费周内，照片文字识别仅支持阿拉伯语和英语。其他语言需要套餐：{url}",
    code: "码：{value}",
  },
  tr: {
    note: "Ücretsiz hafta: {limit} {what} hakkından {left} kaldı.",
    featRead: "fotoğraf metni okuma", featBarcode: "kod tarama", featOffice: "belge okuma",
    exhausted: "Ücretsiz haftanın {limit} {what} hakkının hepsini kullandın. Sınırsız devam için abone ol: {url}",
    nothing: "Okunabilir bir şey bulamadım ve sayılmadı. Daha net ve yakın bir fotoğraf dene.",
    unavailable: "Okuma şu anda kullanılamıyor ve sayılmadı. Lütfen sonra tekrar dene.",
    ocrLanguage: "Ücretsiz haftada fotoğraftan metin okuma yalnızca Arapça ve İngilizce çalışır. Diğer diller için paket gerekir: {url}",
    code: "Kod: {value}",
  },
  fr: {
    note: "Semaine gratuite : il vous reste {left} sur {limit} {what}.",
    featRead: "lectures de texte sur photo", featBarcode: "scans de codes", featOffice: "lectures de documents",
    exhausted: "Vous avez utilisé les {limit} {what} gratuites de votre semaine gratuite. Pour continuer sans limite, abonnez-vous : {url}",
    nothing: "Je n'ai rien trouvé de lisible et cela n'a pas été compté. Essayez une photo plus nette et plus proche.",
    unavailable: "La lecture n'est pas disponible pour l'instant et n'a pas été comptée. Réessayez plus tard.",
    ocrLanguage: "Pendant la semaine gratuite, la lecture de texte sur photo ne fonctionne qu'en arabe et en anglais. Les autres langues nécessitent un forfait : {url}",
    code: "Code : {value}",
  },
  ru: {
    note: "Бесплатная неделя: осталось {left} из {limit} ({what}).",
    featRead: "чтений текста с фото", featBarcode: "сканирований кодов", featOffice: "чтений документов",
    exhausted: "Вы израсходовали все {limit} бесплатных ({what}) за бесплатную неделю. Чтобы продолжить без ограничений, оформите подписку: {url}",
    nothing: "Ничего читаемого не нашёл, попытка не засчитана. Попробуйте более чёткое фото поближе.",
    unavailable: "Чтение сейчас недоступно, попытка не засчитана. Попробуйте позже.",
    ocrLanguage: "В бесплатную неделю текст на фото читается только на арабском и английском. Для других языков нужен тариф: {url}",
    code: "Код: {value}",
  },
};

export function trialLaneSay(key: TrialLaneKey, language: string): string {
  const pack = (TRIAL_LANE_STRINGS as Record<string, Pack>)[language] ?? TRIAL_LANE_STRINGS.en;
  return pack[key];
}
