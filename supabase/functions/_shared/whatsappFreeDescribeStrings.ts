// The words of the free photo description on WhatsApp, in all twenty languages.
//
// Placeholders: {left} descriptions remaining today, {limit} the daily
// allowance, {url} the plans page. Pure data.
//
//   wait       sent first: this is the free, slower service, and a plan is faster
//   note       appended to the description: what is left today
//   exhausted  the allowance for today is used up

import { type SupportedLanguage } from "./whatsappLanguages.ts";

export type FreeDescribeKey = "wait" | "note" | "exhausted";

type Pack = Record<FreeDescribeKey, string>;

export const FREE_DESCRIBE_STRINGS: Record<SupportedLanguage, Pack> = {
  en: {
    wait: "Free photo descriptions are prepared on our own server, so this takes a minute or so. With a subscription it is much faster: {url}",
    note: "Free today: {left} of {limit} descriptions left.",
    exhausted: "You've used all {limit} free photo descriptions for today. Come back tomorrow, or subscribe for unlimited and much faster descriptions: {url}",
  },
  ar: {
    wait: "الوصف المجاني يُجهَّز على خادمنا الخاص، لذلك سيستغرق نحو دقيقة. مع الاشتراك يكون أسرع بكثير: {url}",
    note: "المجاني اليوم: بقي {left} من {limit} أوصاف.",
    exhausted: "استخدمت كل {limit} من أوصاف الصور المجانية لهذا اليوم. عد غدًا، أو اشترك لأوصاف بلا حد وأسرع بكثير: {url}",
  },
  ur: {
    wait: "مفت تصویری وضاحت ہمارے اپنے سرور پر تیار ہوتی ہے، اس لیے ایک منٹ کے قریب لگے گا۔ سبسکرپشن کے ساتھ یہ بہت تیز ہے: {url}",
    note: "آج مفت: {limit} میں سے {left} وضاحتیں باقی ہیں۔",
    exhausted: "آپ آج کی تمام {limit} مفت تصویری وضاحتیں استعمال کر چکے ہیں۔ کل دوبارہ آئیں، یا بلا حد اور بہت تیز وضاحتوں کے لیے سبسکرائب کریں: {url}",
  },
  hi: {
    wait: "मुफ़्त फ़ोटो विवरण हमारे अपने सर्वर पर तैयार होता है, इसलिए लगभग एक मिनट लगेगा। सब्सक्रिप्शन के साथ यह बहुत तेज़ है: {url}",
    note: "आज मुफ़्त: {limit} में से {left} विवरण बचे हैं।",
    exhausted: "आपने आज के सभी {limit} मुफ़्त फ़ोटो विवरण इस्तेमाल कर लिए हैं। कल फिर आएँ, या बिना सीमा और बहुत तेज़ विवरण के लिए सब्सक्राइब करें: {url}",
  },
  id: {
    wait: "Deskripsi foto gratis disiapkan di server kami sendiri, jadi butuh sekitar satu menit. Dengan langganan jauh lebih cepat: {url}",
    note: "Gratis hari ini: sisa {left} dari {limit} deskripsi.",
    exhausted: "Anda sudah memakai semua {limit} deskripsi foto gratis hari ini. Kembali besok, atau berlangganan untuk deskripsi tanpa batas dan jauh lebih cepat: {url}",
  },
  ja: {
    wait: "無料の写真説明は当社のサーバーで作成するため、1分ほどかかります。購読すると大幅に速くなります: {url}",
    note: "本日の無料分: {limit}件中、残り{left}件。",
    exhausted: "本日の無料の写真説明{limit}件をすべて使い切りました。明日またお試しいただくか、購読すると無制限でずっと速くなります: {url}",
  },
  it: {
    wait: "Le descrizioni gratuite delle foto sono preparate sul nostro server, quindi servirà circa un minuto. Con un abbonamento è molto più veloce: {url}",
    note: "Gratis oggi: {left} descrizioni su {limit} rimaste.",
    exhausted: "Hai usato tutte le {limit} descrizioni gratuite di oggi. Torna domani, oppure abbonati per descrizioni illimitate e molto più veloci: {url}",
  },
  ko: {
    wait: "무료 사진 설명은 자체 서버에서 만들어지므로 1분 정도 걸립니다. 구독하면 훨씬 빠릅니다: {url}",
    note: "오늘 무료: {limit}개 중 {left}개 남았습니다.",
    exhausted: "오늘의 무료 사진 설명 {limit}개를 모두 사용했습니다. 내일 다시 오시거나, 구독하면 무제한으로 훨씬 빠르게 받을 수 있습니다: {url}",
  },
  nl: {
    wait: "Gratis fotobeschrijvingen worden op onze eigen server gemaakt, dus dit duurt ongeveer een minuut. Met een abonnement gaat het veel sneller: {url}",
    note: "Gratis vandaag: nog {left} van {limit} beschrijvingen.",
    exhausted: "Je hebt alle {limit} gratis fotobeschrijvingen van vandaag gebruikt. Kom morgen terug, of neem een abonnement voor onbeperkte en veel snellere beschrijvingen: {url}",
  },
  pl: {
    wait: "Bezpłatne opisy zdjęć powstają na naszym własnym serwerze, więc zajmie to około minuty. Z subskrypcją jest to dużo szybsze: {url}",
    note: "Bezpłatnie dziś: zostało {left} z {limit} opisów.",
    exhausted: "Wykorzystano wszystkie {limit} bezpłatne opisy zdjęć na dziś. Wróć jutro albo wykup subskrypcję, by mieć nieograniczone i znacznie szybsze opisy: {url}",
  },
  vi: {
    wait: "Mô tả ảnh miễn phí được tạo trên máy chủ riêng của chúng tôi nên mất khoảng một phút. Khi đăng ký sẽ nhanh hơn nhiều: {url}",
    note: "Miễn phí hôm nay: còn {left} trên {limit} lượt mô tả.",
    exhausted: "Bạn đã dùng hết {limit} lượt mô tả ảnh miễn phí hôm nay. Hãy quay lại vào ngày mai, hoặc đăng ký để mô tả không giới hạn và nhanh hơn nhiều: {url}",
  },
  bn: {
    wait: "বিনামূল্যের ছবির বর্ণনা আমাদের নিজস্ব সার্ভারে তৈরি হয়, তাই প্রায় এক মিনিট লাগবে। সাবস্ক্রিপশন নিলে অনেক দ্রুত হয়: {url}",
    note: "আজ বিনামূল্যে: {limit}টির মধ্যে {left}টি বর্ণনা বাকি।",
    exhausted: "আপনি আজকের সব {limit}টি বিনামূল্যের ছবির বর্ণনা ব্যবহার করেছেন। কাল আবার আসুন, অথবা সীমাহীন ও অনেক দ্রুত বর্ণনার জন্য সাবস্ক্রাইব করুন: {url}",
  },
  fa: {
    wait: "توضیح رایگان تصویر روی سرور خودمان آماده می‌شود، بنابراین حدود یک دقیقه طول می‌کشد. با اشتراک خیلی سریع‌تر است: {url}",
    note: "رایگان امروز: {left} از {limit} توضیح باقی مانده است.",
    exhausted: "هر {limit} توضیح رایگان تصویر امروز را استفاده کرده‌اید. فردا برگردید، یا برای توضیح‌های نامحدود و بسیار سریع‌تر اشتراک بگیرید: {url}",
  },
  es: {
    wait: "Las descripciones gratuitas de fotos se preparan en nuestro propio servidor, así que tardará aproximadamente un minuto. Con una suscripción es mucho más rápido: {url}",
    note: "Gratis hoy: quedan {left} de {limit} descripciones.",
    exhausted: "Has usado las {limit} descripciones gratuitas de hoy. Vuelve mañana, o suscríbete para descripciones ilimitadas y mucho más rápidas: {url}",
  },
  de: {
    wait: "Kostenlose Fotobeschreibungen entstehen auf unserem eigenen Server, das dauert etwa eine Minute. Mit einem Abo geht es viel schneller: {url}",
    note: "Heute kostenlos: noch {left} von {limit} Beschreibungen.",
    exhausted: "Du hast alle {limit} kostenlosen Fotobeschreibungen für heute verbraucht. Komm morgen wieder, oder abonniere für unbegrenzte und viel schnellere Beschreibungen: {url}",
  },
  pt: {
    wait: "As descrições gratuitas de fotos são preparadas no nosso próprio servidor, por isso levam cerca de um minuto. Com uma assinatura é muito mais rápido: {url}",
    note: "Grátis hoje: restam {left} de {limit} descrições.",
    exhausted: "Você usou todas as {limit} descrições gratuitas de hoje. Volte amanhã, ou assine para descrições ilimitadas e muito mais rápidas: {url}",
  },
  zh: {
    wait: "免费的图片描述在我们自己的服务器上生成，大约需要一分钟。订阅后会快得多：{url}",
    note: "今日免费：{limit} 次中还剩 {left} 次。",
    exhausted: "你今天的 {limit} 次免费图片描述已用完。明天再来，或订阅以获得无限且快得多的描述：{url}",
  },
  tr: {
    wait: "Ücretsiz fotoğraf açıklamaları kendi sunucumuzda hazırlanır, bu yüzden yaklaşık bir dakika sürer. Abonelikle çok daha hızlıdır: {url}",
    note: "Bugün ücretsiz: {limit} açıklamadan {left} tanesi kaldı.",
    exhausted: "Bugünkü {limit} ücretsiz fotoğraf açıklamasının hepsini kullandınız. Yarın tekrar gelin veya sınırsız ve çok daha hızlı açıklamalar için abone olun: {url}",
  },
  fr: {
    wait: "Les descriptions gratuites de photos sont préparées sur notre propre serveur, cela prend donc environ une minute. Avec un abonnement, c'est beaucoup plus rapide : {url}",
    note: "Gratuit aujourd'hui : il reste {left} descriptions sur {limit}.",
    exhausted: "Vous avez utilisé les {limit} descriptions gratuites d'aujourd'hui. Revenez demain, ou abonnez-vous pour des descriptions illimitées et bien plus rapides : {url}",
  },
  ru: {
    wait: "Бесплатные описания фото готовятся на нашем собственном сервере, поэтому это займёт около минуты. С подпиской гораздо быстрее: {url}",
    note: "Бесплатно сегодня: осталось {left} из {limit} описаний.",
    exhausted: "Вы использовали все {limit} бесплатных описаний фото на сегодня. Приходите завтра или оформите подписку для безлимитных и намного более быстрых описаний: {url}",
  },
};

export function freeDescribeSay(
  key: FreeDescribeKey,
  language: string,
  vars: Record<string, string | number> = {},
): string {
  const pack = (FREE_DESCRIBE_STRINGS as Record<string, Pack>)[language] ?? FREE_DESCRIBE_STRINGS.en;
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), pack[key]);
}
