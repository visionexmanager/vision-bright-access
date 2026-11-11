// Live answers for the site sections that used to be a sentence and a link.
//
// Four rows made it into the menu in #619 as `info` rows: finance, simulators,
// community and the account. A sentence and an address is a door, not a feature.
// This module is what stands behind them now:
//
//   finance      exchange rates, and "100 USD to EUR" typed anywhere
//   simulators   the simulations that are published right now
//   community    the voice rooms that are open right now
//   account      the top of the leaderboard
//
// All of it is data the website already shows to anyone, with no sign-in:
// published simulations and active voice rooms are readable by the public by
// policy, the leaderboard page is not behind a login, and the rates come from the
// same keyless service the Currencies page calls. Nothing here is per-person, so
// nothing here needs the identity link and nothing can leak a stranger's data.
//
// Every failure means "no live part": the row's own sentence and address still
// go out, so a database or a rate service having a bad minute degrades the answer
// to what it was yesterday rather than to silence.
//
// The fetchers are passed in, so this file imports nothing from Deno or Supabase
// and the whole of it runs under Vitest.

import type { SupportedLanguage } from "./whatsappLanguages.ts";

type L = SupportedLanguage;

// ── Wording ────────────────────────────────────────────────────────────────

const KEYS = [
  "lbTitle", "pts", "simsTitle", "roomsTitle", "roomsNone",
  "fxBoard", "fxHint", "fxUpdated", "fxUnavailable", "fxOfficial",
] as const;
type Key = (typeof KEYS)[number];

const TEXT: Record<L, readonly string[]> = {
  en: ["Top players on Visionex", "pts", "Simulations you can try now", "Voice rooms open now", "No voice room is open right now.", "1 US dollar is worth", "Send an amount and two currencies, for example: 100 USD to EUR", "Updated", "Exchange rates are unavailable right now. Please try again in a few minutes.", "Note: this is the official rate; the street rate can differ."],
  ar: ["أفضل اللاعبين في Visionex", "نقطة", "المحاكيات المتاحة للتجربة الآن", "الغرف الصوتية المفتوحة الآن", "لا توجد غرفة صوتية مفتوحة الآن.", "قيمة 1 دولار أمريكي", "أرسل مبلغاً وعملتين، مثال: 100 USD إلى EUR", "آخر تحديث", "أسعار الصرف غير متاحة الآن. جرّب بعد دقائق.", "ملاحظة: هذا هو السعر الرسمي، وقد يختلف سعر السوق."],
  ur: ["Visionex کے ٹاپ کھلاڑی", "پوائنٹس", "ابھی آزمانے کے لیے سیمولیشنز", "اس وقت کھلے وائس رومز", "اس وقت کوئی وائس روم کھلا نہیں ہے۔", "1 امریکی ڈالر کی قیمت", "رقم اور دو کرنسیاں بھیجیں، مثلاً: 100 USD to EUR", "تازہ ترین", "ایکسچینج ریٹ ابھی دستیاب نہیں۔ چند منٹ بعد کوشش کریں۔", "نوٹ: یہ سرکاری ریٹ ہے؛ مارکیٹ ریٹ مختلف ہو سکتا ہے۔"],
  hi: ["Visionex के टॉप खिलाड़ी", "अंक", "अभी आज़माने लायक सिमुलेशन", "अभी खुले वॉइस रूम", "अभी कोई वॉइस रूम खुला नहीं है।", "1 अमेरिकी डॉलर की कीमत", "राशि और दो मुद्राएँ भेजें, जैसे: 100 USD to EUR", "अपडेट", "विनिमय दरें अभी उपलब्ध नहीं हैं। कुछ मिनट बाद फिर कोशिश करें।", "नोट: यह आधिकारिक दर है; बाज़ार दर अलग हो सकती है।"],
  id: ["Pemain teratas Visionex", "poin", "Simulasi yang bisa dicoba sekarang", "Ruang suara yang terbuka sekarang", "Tidak ada ruang suara yang terbuka saat ini.", "1 dolar AS bernilai", "Kirim jumlah dan dua mata uang, misalnya: 100 USD to EUR", "Diperbarui", "Kurs belum tersedia saat ini. Coba lagi beberapa menit lagi.", "Catatan: ini kurs resmi; kurs pasar bisa berbeda."],
  ja: ["Visionexのトッププレイヤー", "pt", "今すぐ試せるシミュレーション", "現在開いているボイスルーム", "現在開いているボイスルームはありません。", "1米ドルは", "金額と2つの通貨を送ってください。例：100 USD to EUR", "更新", "為替レートは現在利用できません。数分後にお試しください。", "注：公式レートです。実勢レートとは異なる場合があります。"],
  it: ["I migliori giocatori di Visionex", "pt", "Simulazioni da provare ora", "Stanze vocali aperte ora", "Nessuna stanza vocale è aperta al momento.", "1 dollaro USA vale", "Invia un importo e due valute, ad esempio: 100 USD to EUR", "Aggiornato", "I tassi di cambio non sono disponibili ora. Riprova tra qualche minuto.", "Nota: è il tasso ufficiale; quello di mercato può differire."],
  ko: ["Visionex 상위 플레이어", "점", "지금 체험할 수 있는 시뮬레이션", "지금 열려 있는 음성 룸", "지금 열려 있는 음성 룸이 없습니다.", "1 미국 달러의 가치", "금액과 통화 두 개를 보내 주세요. 예: 100 USD to EUR", "업데이트", "지금은 환율을 사용할 수 없습니다. 몇 분 후 다시 시도해 주세요.", "참고: 공식 환율이며 시장 환율과 다를 수 있습니다."],
  nl: ["Topspelers op Visionex", "pnt", "Simulaties om nu te proberen", "Nu geopende spraakkamers", "Er is nu geen spraakkamer open.", "1 Amerikaanse dollar is", "Stuur een bedrag en twee valuta, bijvoorbeeld: 100 USD to EUR", "Bijgewerkt", "Wisselkoersen zijn nu niet beschikbaar. Probeer het over enkele minuten opnieuw.", "Let op: dit is de officiële koers; de marktkoers kan afwijken."],
  pl: ["Najlepsi gracze Visionex", "pkt", "Symulacje do wypróbowania teraz", "Teraz otwarte pokoje głosowe", "Żaden pokój głosowy nie jest teraz otwarty.", "1 dolar amerykański to", "Wyślij kwotę i dwie waluty, np.: 100 USD to EUR", "Zaktualizowano", "Kursy walut są teraz niedostępne. Spróbuj za kilka minut.", "Uwaga: to kurs oficjalny; kurs rynkowy może się różnić."],
  vi: ["Người chơi hàng đầu Visionex", "điểm", "Mô phỏng có thể thử ngay", "Phòng thoại đang mở", "Hiện không có phòng thoại nào đang mở.", "1 đô la Mỹ có giá", "Gửi số tiền và hai loại tiền, ví dụ: 100 USD to EUR", "Cập nhật", "Tỷ giá hiện không khả dụng. Vui lòng thử lại sau vài phút.", "Lưu ý: đây là tỷ giá chính thức; tỷ giá thị trường có thể khác."],
  bn: ["Visionex-এর সেরা খেলোয়াড়", "পয়েন্ট", "এখনই চেষ্টা করার সিমুলেশন", "এখন খোলা ভয়েস রুম", "এখন কোনো ভয়েস রুম খোলা নেই।", "১ মার্কিন ডলারের মূল্য", "পরিমাণ ও দুটি মুদ্রা পাঠান, যেমন: 100 USD to EUR", "আপডেট", "বিনিময় হার এখন পাওয়া যাচ্ছে না। কয়েক মিনিট পর আবার চেষ্টা করুন।", "দ্রষ্টব্য: এটি সরকারি হার; বাজারদর ভিন্ন হতে পারে।"],
  fa: ["برترین بازیکنان Visionex", "امتیاز", "شبیه‌سازهایی که اکنون می‌توانید امتحان کنید", "اتاق‌های صوتی باز در حال حاضر", "اکنون هیچ اتاق صوتی باز نیست.", "ارزش ۱ دلار آمریکا", "مبلغ و دو ارز بفرستید، مثلاً: 100 USD to EUR", "به‌روزرسانی", "نرخ ارز اکنون در دسترس نیست. چند دقیقه بعد دوباره امتحان کنید.", "توجه: این نرخ رسمی است؛ نرخ بازار ممکن است متفاوت باشد."],
  es: ["Mejores jugadores de Visionex", "pts", "Simulaciones para probar ahora", "Salas de voz abiertas ahora", "No hay ninguna sala de voz abierta ahora.", "1 dólar estadounidense equivale a", "Envía un importe y dos monedas, por ejemplo: 100 USD to EUR", "Actualizado", "Los tipos de cambio no están disponibles ahora. Inténtalo en unos minutos.", "Nota: es el tipo oficial; el de mercado puede diferir."],
  de: ["Top-Spieler auf Visionex", "Pkt.", "Simulationen zum Ausprobieren", "Jetzt geöffnete Sprachräume", "Gerade ist kein Sprachraum geöffnet.", "1 US-Dollar entspricht", "Sende einen Betrag und zwei Währungen, z. B.: 100 USD to EUR", "Aktualisiert", "Wechselkurse sind gerade nicht verfügbar. Bitte in ein paar Minuten erneut versuchen.", "Hinweis: Das ist der offizielle Kurs; der Marktkurs kann abweichen."],
  pt: ["Melhores jogadores da Visionex", "pts", "Simulações para experimentar agora", "Salas de voz abertas agora", "Nenhuma sala de voz está aberta agora.", "1 dólar americano vale", "Envie um valor e duas moedas, por exemplo: 100 USD to EUR", "Atualizado", "As taxas de câmbio não estão disponíveis agora. Tente novamente em alguns minutos.", "Nota: esta é a taxa oficial; a de mercado pode ser diferente."],
  zh: ["Visionex 排行榜前列", "分", "现在可以试玩的模拟", "当前开放的语音房间", "目前没有开放的语音房间。", "1 美元等于", "发送金额和两种货币，例如：100 USD to EUR", "更新于", "汇率暂时不可用，请几分钟后再试。", "注：这是官方汇率，市场汇率可能不同。"],
  tr: ["Visionex'in en iyi oyuncuları", "puan", "Şimdi deneyebileceğin simülasyonlar", "Şu an açık sesli odalar", "Şu an açık sesli oda yok.", "1 ABD doları şu kadar eder", "Bir tutar ve iki para birimi gönder, örneğin: 100 USD to EUR", "Güncellendi", "Döviz kurları şu an kullanılamıyor. Birkaç dakika sonra tekrar dene.", "Not: bu resmî kurdur; piyasa kuru farklı olabilir."],
  fr: ["Meilleurs joueurs de Visionex", "pts", "Simulations à essayer maintenant", "Salons vocaux ouverts en ce moment", "Aucun salon vocal n'est ouvert pour l'instant.", "1 dollar américain vaut", "Envoyez un montant et deux devises, par exemple : 100 USD to EUR", "Mis à jour", "Les taux de change ne sont pas disponibles pour l'instant. Réessayez dans quelques minutes.", "Remarque : il s'agit du taux officiel ; le taux du marché peut différer."],
  ru: ["Лучшие игроки Visionex", "очк.", "Симуляции, которые можно попробовать", "Открытые сейчас голосовые комнаты", "Сейчас нет открытых голосовых комнат.", "1 доллар США стоит", "Отправьте сумму и две валюты, например: 100 USD to EUR", "Обновлено", "Курсы валют сейчас недоступны. Попробуйте через несколько минут.", "Примечание: это официальный курс; рыночный может отличаться."],
};

/** One sentence in the sender's language; English when the language is unknown. */
export function liveSay(key: Key, language: string): string {
  const row = TEXT[language as L] ?? TEXT.en;
  return row[KEYS.indexOf(key)] ?? TEXT.en[KEYS.indexOf(key)];
}

export const LIVE_LANGUAGES = Object.keys(TEXT) as L[];
export const LIVE_KEYS = KEYS;

// ── Cleaning what other people typed ───────────────────────────────────────

/**
 * A display name or a room title is somebody else's text, sent to a third
 * person's phone. Control characters and the bidi overrides go (an override can
 * reorder the whole message around it), whitespace collapses, length is bounded.
 */
export function cleanLabel(value: unknown, max = 40): string {
  if (typeof value !== "string") return "";
  const text = value
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const rowsOf = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object") : [];

const wholeNumber = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
};

const number = (language: string, value: number, digits = 2): string => {
  try {
    // `-u-nu-latn`: digits a phone screen reader reads the same in every language.
    return new Intl.NumberFormat(`${language}-u-nu-latn`, { maximumFractionDigits: digits }).format(value);
  } catch {
    return String(Math.round(value * 10 ** digits) / 10 ** digits);
  }
};

// ── Leaderboard, simulations, rooms ────────────────────────────────────────

export function formatLeaderboard(rows: unknown, language: string): string | null {
  const lines = rowsOf(rows).slice(0, 10).flatMap((row, i) => {
    const points = wholeNumber(row.total_points);
    if (points === null) return [];
    const name = cleanLabel(row.display_name, 30) || "—";
    return [`${wholeNumber(row.rank) ?? i + 1}. ${name} — ${number(language, points, 0)} ${liveSay("pts", language)}`];
  });
  return lines.length ? `🏆 ${liveSay("lbTitle", language)}\n${lines.join("\n")}` : null;
}

export function formatSimulations(rows: unknown, language: string): string | null {
  const lines = rowsOf(rows).slice(0, 10).flatMap((row) => {
    const title = cleanLabel(row.title, 50);
    if (!title) return [];
    const points = wholeNumber(row.points);
    return [points === null ? `• ${title}` : `• ${title} — ${number(language, points, 0)} ${liveSay("pts", language)}`];
  });
  return lines.length ? `🏭 ${liveSay("simsTitle", language)}\n${lines.join("\n")}` : null;
}

export function formatRooms(rows: unknown, language: string): string {
  const lines = rowsOf(rows).slice(0, 10).flatMap((row) => {
    const name = cleanLabel(row.room_name, 40);
    return name ? [`• ${name}`] : [];
  });
  return lines.length
    ? `🎙️ ${liveSay("roomsTitle", language)}\n${lines.join("\n")}`
    : `🎙️ ${liveSay("roomsNone", language)}`;
}

// ── Exchange rates ─────────────────────────────────────────────────────────

export interface Rates {
  /** Units of each currency per one US dollar. */
  rates: Record<string, number>;
  /** `YYYY-MM-DD`, from the service's own timestamp. */
  updated: string;
}

const RATES_URL = "https://open.er-api.com/v6/latest/USD";
const RATES_TTL_MS = 10 * 60 * 1000;
let cachedRates: { at: number; value: Rates } | null = null;

/** Test hook: forget the in-memory copy. */
export function resetRatesCache(): void {
  cachedRates = null;
}

export async function fetchRates(
  fetchFn: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<Rates | null> {
  if (cachedRates && now - cachedRates.at < RATES_TTL_MS) return cachedRates.value;
  try {
    // A rate service that hangs must not hold the webhook: six seconds, or give up.
    const signal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6000) : undefined;
    const res = await fetchFn(RATES_URL, { signal });
    if (!res.ok) return null;
    const body = await res.json() as { result?: unknown; rates?: unknown; time_last_update_unix?: unknown };
    if (body.result !== "success" || !body.rates || typeof body.rates !== "object") return null;
    const rates: Record<string, number> = {};
    for (const [code, value] of Object.entries(body.rates as Record<string, unknown>)) {
      if (/^[A-Z]{3}$/.test(code) && typeof value === "number" && Number.isFinite(value) && value > 0) {
        rates[code] = value;
      }
    }
    if (!rates.USD) return null;
    const unix = typeof body.time_last_update_unix === "number" ? body.time_last_update_unix * 1000 : now;
    const value: Rates = { rates, updated: new Date(unix).toISOString().slice(0, 10) };
    cachedRates = { at: now, value };
    return value;
  } catch {
    return null;
  }
}

const currencyName = (code: string, language: string): string => {
  try {
    return new Intl.DisplayNames([language], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/** Official-only rates: the street price of these differs from the published one. */
const OFFICIAL_ONLY = new Set(["LBP", "SYP"]);

export function formatConversion(
  params: { amount: number; from: string; to: string; language: string },
  data: Rates,
): string | null {
  const { amount, from, to, language } = params;
  const rateFrom = data.rates[from];
  const rateTo = data.rates[to];
  if (!rateFrom || !rateTo) return null;
  const unit = rateTo / rateFrom;
  const result = amount * unit;
  const digits = (n: number) => (Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 3 : 5);
  const lines = [
    `💱 ${number(language, amount, 2)} ${from} = ${number(language, result, digits(result))} ${to}`,
    `1 ${from} = ${number(language, unit, digits(unit))} ${to} · ${liveSay("fxUpdated", language)} ${data.updated}`,
  ];
  if (OFFICIAL_ONLY.has(from) || OFFICIAL_ONLY.has(to)) lines.push(liveSay("fxOfficial", language));
  return lines.join("\n");
}

const BOARD = ["EUR", "GBP", "SAR", "AED", "JOD", "KWD", "TRY", "EGP"] as const;

export function formatBoard(language: string, data: Rates): string | null {
  const lines = BOARD.flatMap((code) => {
    const rate = data.rates[code];
    return rate ? [`${currencyName(code, language)} (${code}): ${number(language, rate, rate >= 100 ? 2 : 4)}`] : [];
  });
  if (!lines.length) return null;
  return [
    `💱 ${liveSay("fxBoard", language)}`,
    ...lines,
    `${liveSay("fxUpdated", language)} ${data.updated}`,
    liveSay("fxHint", language),
  ].join("\n");
}

export function ratesUnavailable(language: string): string {
  return liveSay("fxUnavailable", language);
}

// ── Reading "100 USD to EUR" ───────────────────────────────────────────────

export type LiveRequest =
  | { kind: "convert"; amount: number; from: string; to: string }
  | { kind: "board" };

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Names people actually type, longest first so «ليرة لبنانية» wins over «ليرة». */
const NAMES: readonly (readonly [string, string])[] = [
  ["ليرة لبنانية", "LBP"], ["ليرة اللبنانية", "LBP"], ["lebanese pound", "LBP"], ["livre libanaise", "LBP"],
  ["ليرة سورية", "SYP"], ["ليرة السورية", "SYP"], ["syrian pound", "SYP"],
  ["ليرة تركية", "TRY"], ["ليرة التركية", "TRY"], ["turkish lira", "TRY"],
  ["جنيه مصري", "EGP"], ["الجنيه المصري", "EGP"], ["egyptian pound", "EGP"],
  ["جنيه استرليني", "GBP"], ["جنيه إسترليني", "GBP"], ["pound sterling", "GBP"], ["british pound", "GBP"],
  ["دينار اردني", "JOD"], ["دينار أردني", "JOD"], ["jordanian dinar", "JOD"],
  ["دينار كويتي", "KWD"], ["kuwaiti dinar", "KWD"],
  ["ريال سعودي", "SAR"], ["ريال السعودي", "SAR"], ["saudi riyal", "SAR"],
  ["ريال قطري", "QAR"], ["qatari riyal", "QAR"],
  ["درهم اماراتي", "AED"], ["درهم إماراتي", "AED"], ["uae dirham", "AED"],
  ["دولار", "USD"], ["dollars", "USD"], ["dollar", "USD"], ["usd", "USD"],
  ["يورو", "EUR"], ["euros", "EUR"], ["euro", "EUR"],
  ["شيكل", "ILS"], ["shekel", "ILS"],
];

let validCodes: Set<string> | null = null;
const isCurrencyCode = (code: string): boolean => {
  if (!validCodes) {
    try {
      validCodes = new Set((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("currency"));
    } catch {
      validCodes = new Set(["USD", "EUR", "GBP", "LBP", "SAR", "AED", "JOD", "KWD", "QAR", "TRY", "EGP", "SYP", "ILS", "JPY", "CNY", "INR"]);
    }
  }
  return validCodes.has(code);
};

const BOARD_WORDS =
  /(?:^|\s)(?:سعر|اسعار|أسعار|كم سعر)\s*(?:ال)?(?:دولار|يورو|عملات|صرف)|exchange rates?|currency rates?|dollar rate|usd rate|rates? today/;

/**
 * A quote request, or null. Deliberately narrow: an amount **and** two currencies
 * that are real ones, in a message short enough to be a question about money. A
 * sentence that merely contains "100" and the word "dollar" is somebody talking,
 * and the weather and the assistant get it as before.
 */
export function parseLiveRequest(text: string | null | undefined): LiveRequest | null {
  if (!text) return null;
  let t = text.trim().toLowerCase();
  if (!t || t.length > 90) return null;

  t = t.replace(/[٠-٩]/g, (c) => String(ARABIC_INDIC.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String(EXTENDED_INDIC.indexOf(c)))
    .replace(/٫/g, ".")
    .replace(/[٬,]/g, "");

  if (BOARD_WORDS.test(t) && !/\d/.test(t)) return { kind: "board" };

  const amountMatch = /\d+(?:\.\d+)?/.exec(t);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[0]);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) return null;

  // Names and symbols become an uppercase code in braces, so the scan below
  // meets one kind of token. Doing the names first keeps «دولار» from being read
  // as part of a longer phrase, because the longer phrases are listed earlier.
  let work = t.replace(/us\$/g, " {USD} ").replace(/\$/g, " {USD} ").replace(/€/g, " {EUR} ").replace(/£/g, " {GBP} ");
  for (const [name, code] of NAMES) work = work.split(name).join(` {${code}} `);

  const found: string[] = [];
  const token = /\{([A-Z]{3})\}|(?<![a-z])([a-z]{3})(?![a-z])/g;
  for (const m of work.matchAll(token)) {
    const code = (m[1] ?? m[2]).toUpperCase();
    if (isCurrencyCode(code)) found.push(code);
  }
  if (found.length !== 2 || found[0] === found[1]) return null;
  return { kind: "convert", amount, from: found[0], to: found[1] };
}

// ── The four rows ──────────────────────────────────────────────────────────

export interface LiveSources {
  leaderboard(): PromiseLike<unknown>;
  simulations(): PromiseLike<unknown>;
  rooms(): PromiseLike<unknown>;
  rates(): Promise<Rates | null>;
}

/**
 * The live part that follows a row's own sentence, or "" when there is none —
 * either the row has no live part or its source failed. Never throws.
 */
export async function liveAppendix(nodeId: string, language: string, src: LiveSources): Promise<string> {
  try {
    switch (nodeId) {
      case "more.account":
        return formatLeaderboard(await src.leaderboard(), language) ?? "";
      case "explore.simulations":
        return formatSimulations(await src.simulations(), language) ?? "";
      case "headlines.community":
        return formatRooms(await src.rooms(), language);
      case "explore.finance": {
        const data = await src.rates();
        return data ? (formatBoard(language, data) ?? "") : "";
      }
      default:
        return "";
    }
  } catch {
    return "";
  }
}
