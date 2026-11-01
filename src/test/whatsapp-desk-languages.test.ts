import { describe, expect, it } from "vitest";

import { parseDocConvertRequest } from "../../supabase/functions/_shared/whatsappDocConvert.ts";
import { parseDeskKind, parseShopIntent, parseTravelDomain } from "../../supabase/functions/_shared/whatsappTravel.ts";

// One natural sentence per language for each thing a sender may ask the desk for.
const FLIGHT: Record<string, string> = {
  es: "quiero reservar un vuelo a Madrid", fr: "je veux réserver un vol pour Paris", de: "ich möchte einen flug buchen",
  it: "vorrei prenotare un volo per Roma", pt: "quero reservar um voo para Lisboa", ru: "хочу забронировать авиабилет в Москву",
  tr: "uçak bileti almak istiyorum", zh: "我想订机票去北京", ja: "東京行きの航空券を予約したい", ko: "서울행 항공권 예약하고 싶어요",
  hi: "मुझे दिल्ली की फ्लाइट बुक करनी है", ur: "مجھے لاہور کی فلائٹ بک کرنی ہے", fa: "می‌خواهم بلیط هواپیما رزرو کنم",
  id: "saya mau pesan tiket pesawat ke Jakarta", vi: "tôi muốn đặt vé máy bay đi Hà Nội", nl: "ik wil een vlucht boeken naar Amsterdam",
  pl: "chcę zarezerwować lot do Warszawy", bn: "আমি ঢাকার ফ্লাইট বুক করতে চাই",
};
const HOTEL: Record<string, string> = {
  es: "necesito reservar un hotel en Sevilla", fr: "je voudrais réserver un hôtel à Lyon", de: "ich möchte ein hotel buchen",
  it: "devo prenotare un hotel a Milano", pt: "preciso reservar um hotel no Porto", ru: "нужно забронировать отель в Сочи",
  tr: "otel rezervasyonu yapmak istiyorum", zh: "我想预订酒店", ja: "京都のホテルを予約したい", ko: "부산 호텔 예약하고 싶어요",
  hi: "मुझे मुंबई में होटल बुक करना है", ur: "مجھے کراچی میں ہوٹل بک کرنا ہے", fa: "می‌خواهم هتل رزرو کنم",
  id: "saya mau pesan hotel di Bali", vi: "tôi muốn đặt phòng khách sạn ở Đà Nẵng", nl: "ik wil een hotel boeken in Brussel",
  pl: "chcę zarezerwować hotel w Krakowie", bn: "আমি হোটেল বুক করতে চাই",
};
const CAR: Record<string, string> = {
  es: "quiero alquilar un coche en Málaga", fr: "je veux louer une voiture à Nice", de: "ich brauche einen mietwagen in Berlin",
  it: "voglio noleggiare un'auto a Napoli", pt: "quero alugar um carro em Faro", ru: "хочу арендовать авто в Казани",
  tr: "araç kiralama yapmak istiyorum", zh: "我想租车", ja: "レンタカーを借りたい", ko: "렌터카 예약하고 싶어요",
  hi: "मुझे कार किराए पर चाहिए", ur: "مجھے کار کرائے پر چاہیے", fa: "می‌خواهم اجاره ماشین کنم",
  id: "saya mau sewa mobil di Surabaya", vi: "tôi muốn thuê xe ở Huế", nl: "ik wil een auto huren in Utrecht",
  pl: "chcę wynająć samochód we Wrocławiu", bn: "আমি গাড়ি ভাড়া নিতে চাই",
};
const SHOP: Record<string, string> = {
  es: "quiero pedir de amazon unos zapatos", fr: "je veux commander sur aliexpress un téléphone", de: "ich möchte bei amazon bestellen",
  it: "voglio ordinare da amazon una borsa", pt: "quero encomendar da shein uma blusa", ru: "хочу заказать с алиэкспресс телефон",
  tr: "temu'dan sipariş vermek istiyorum", zh: "帮我在亚马逊下单买一个包", ja: "アマゾンで注文したい", ko: "아마존에서 주문하고 싶어요",
  hi: "मुझे अमेज़न से ऑर्डर करना है", ur: "مجھے ایمیزون سے آرڈر کرنا ہے", fa: "می‌خواهم از آمازون سفارش بدهم",
  id: "saya mau pesan dari shein", vi: "tôi muốn đặt hàng từ amazon", nl: "ik wil bestellen bij amazon",
  pl: "chcę zamówić z aliexpress", bn: "আমি অ্যামাজন থেকে অর্ডার করতে চাই",
};

describe("the desk reads requests in every language of the site", () => {
  for (const locale of Object.keys(FLIGHT)) {
    it(`${locale}: a flight, a hotel, a car and a store order`, () => {
      expect(parseTravelDomain(FLIGHT[locale]), `flight ${locale}`).toBe("flights");
      expect(parseTravelDomain(HOTEL[locale]), `hotel ${locale}`).toBe("stays");
      expect(parseTravelDomain(CAR[locale]), `car ${locale}`).toBe("cars");
      expect(parseShopIntent(SHOP[locale]), `shop ${locale}`).toBe(true);
      expect(parseDeskKind(SHOP[locale]), `kind ${locale}`).toBe("shop");
    });
  }

  it("does not read ordinary talk as a request", () => {
    for (const text of [
      "my flight was late", "el hotel estaba lleno", "mon vol a eu du retard", "das hotel ist schön", "отель был хороший",
      "i saw it on amazon", "vi eso en aliexpress", "我在亚马逊看到的", "تصفحت أمازون", "bonjour", "hola", "你好",
    ]) {
      expect(parseDeskKind(text), text).toBeNull();
    }
  });
});

describe("a document sent with a few words in another language", () => {
  const cases: Array<[string, string, string, string]> = [
    // [language, text, source, expected target]
    ["ru", "в ворд", "pdf", "docx"],
    ["ru", "конвертируй в pdf", "docx", "pdf"],
    ["zh", "转成word", "pdf", "docx"],
    ["zh", "转为pdf", "docx", "pdf"],
    ["ja", "ワードに変換", "pdf", "docx"],
    ["ja", "PDFに変換", "docx", "pdf"],
    ["ko", "워드로 바꿔줘", "pdf", "docx"],
    ["ko", "엑셀", "pdf", "none"],
    ["hi", "वर्ड में बदलो", "pdf", "docx"],
    ["ur", "ورڈ" + " " + "ورد میں تبدیل", "pdf", "docx"],
    ["fa", "تبدیل به ورد", "pdf", "docx"],
    ["bn", "ওয়ার্ডে রূপান্তর", "pdf", "docx"],
    ["es", "convertir a word", "pdf", "docx"],
    ["fr", "convertir en pdf", "docx", "pdf"],
    ["de", "in word umwandeln", "pdf", "docx"],
    ["it", "converti in word", "pdf", "docx"],
    ["pt", "converter para word", "pdf", "docx"],
    ["tr", "word'e çevir", "pdf", "docx"],
    ["id", "ubah ke word", "pdf", "docx"],
    ["vi", "chuyển sang word", "pdf", "docx"],
    ["nl", "naar word", "pdf", "docx"],
    ["pl", "zamień na word", "pdf", "docx"],
    ["ru", "эксель", "docx", "none"],
    ["ja", "テキストに変換", "pdf", "txt"],
    ["es", "texto", "pdf", "txt"],
  ];
  for (const [language, text, source, target] of cases) {
    it(`${language}: “${text}” on a ${source}`, () => {
      const got = parseDocConvertRequest({ text, source: source as "pdf" | "docx" })?.target ?? "none";
      expect(got).toBe(target);
    });
  }

  it("never turns a translation request into a conversion", () => {
    expect(parseDocConvertRequest({ text: "traduci in word per favore", source: "pdf" })).toBeNull();
    expect(parseDocConvertRequest({ text: "übersetze das in word", source: "pdf" })).toBeNull();
  });
});
