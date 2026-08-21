// "What's the weather?" — the decisions, with no network in sight.
//
// Pure and provider-free, for the same reason `whatsappVisionModes.ts` is: the
// Vitest suite runs under Node and imports this directly, which is what lets
// every phrase below be tested rather than eyeballed. The fetching lives in
// `whatsappGeo.ts`.
//
// Why weather belongs in an accessibility assistant at all: knowing whether to
// take a coat is a glance out of a window for most people, and a WhatsApp
// message for this audience. It is also the single most common thing a voice
// assistant is asked, and this one is reached by voice note.

/**
 * Longest a message can be and still be read as a weather question.
 *
 * Sixty, because a real one is short: "what is the weather going to be like
 * tomorrow" is forty-four characters and "الطقس في عمّان" is fourteen. The cap
 * is what separates a question from a sentence that merely contains the word —
 * "the weather has been awful ever since my order went missing" is a complaint
 * about support, and answering it with a forecast would be worse than useless.
 */
export const WEATHER_MAX_CHARS = 60;

export interface WeatherRequest {
  /** The place named in the message, or null to mean "where I am". */
  place: string | null;
  /** Whether the sender asked about the days ahead rather than right now. */
  forecast: boolean;
}

// Latin spellings get `\b`; Arabic never does — JavaScript word boundaries are
// defined against [A-Za-z0-9_], so `\bالطقس\b` matches nothing at all. The same
// trap `whatsappPreferences.ts` and `whatsappVisionModes.ts` both document.
const WEATHER_TERMS = [
  /\b(weather|forecast|temperature|humidity)\b/i,
  /\b(how (hot|cold|warm|windy)|is it (raining|snowing|hot|cold|windy))\b/i,
  /\b(will it rain|going to rain|rain today|rain tomorrow)\b/i,
  /(الطقس|الجو|طقس|حالة الجو|درجة الحرارة|درجه الحراره|الحرارة|الحراره)/,
  /(شو الجو|كيف الجو|وش الجو|ايش الجو|كم الحرارة|كم درجة)/,
  /(هل تمطر|راح تمطر|بتمطر|الأمطار|الامطار|الرطوبة|الرطوبه)/,
];

/** Asked about the days ahead, not this minute. */
const FORECAST_TERMS = [
  /\b(forecast|tomorrow|this week|next few days|coming days)\b/i,
  /(توقعات|بكرا|بكرة|غدا|غداً|الأيام القادمة|الايام القادمه|هذا الأسبوع|هالأسبوع)/,
];

/**
 * The place, when one is named.
 *
 * Nothing here guesses: an unmatched pattern yields null, which the caller
 * reads as "where I am" and answers from a shared location — or asks for one.
 * Inventing a city would produce a confident forecast for the wrong continent.
 */
function extractPlace(text: string): string | null {
  const patterns = [
    /\b(?:weather|forecast|temperature)\s+(?:in|at|for)\s+(.{2,40}?)\s*[?.!]?$/i,
    /\b(?:how(?:'s| is) the weather|what(?:'s| is) the weather)\s+(?:in|at)\s+(.{2,40}?)\s*[?.!]?$/i,
    /(?:الطقس|الجو|طقس|جو|درجة الحرارة|الحرارة)\s+(?:في|ب|فى)\s*(.{2,40}?)\s*[؟?.!]?$/,
    // "طقس دبي" — the place follows the noun with no preposition at all.
    /^(?:الطقس|طقس|الجو|جو)\s+(.{2,40}?)\s*[؟?.!]?$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const found = match?.[1]?.trim();
    if (found && found.length >= 2) {
      // "today"/"اليوم" is a time, not a place, and geocoding it returns a
      // village in Kansas rather than nothing — which is worse than nothing.
      const cleaned = found
        .replace(/\b(today|now|right now|tomorrow|please)\b/gi, "")
        .replace(/(اليوم|الآن|الان|هلق|بكرا|بكرة|لو سمحت|من فضلك)/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (cleaned.length >= 2) return cleaned;
    }
  }
  return null;
}

/**
 * Read a message as a weather question, or decide it is not one.
 *
 * The length guard matters: "the weather has been awful since my order went
 * missing" contains the word and is not a request for a forecast. A sentence
 * long enough to exceed the cap is someone talking, not asking.
 */
export function parseWeatherRequest(text: string): WeatherRequest | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > WEATHER_MAX_CHARS) return null;
  if (!WEATHER_TERMS.some((pattern) => pattern.test(trimmed))) return null;

  return {
    place: extractPlace(trimmed),
    forecast: FORECAST_TERMS.some((pattern) => pattern.test(trimmed)),
  };
}

// ── WMO weather codes ───────────────────────────────────────────────────
//
// Open-Meteo reports conditions as a WMO code, which is a number. Turning it
// into words here rather than asking a model to is deliberate: it costs
// nothing, it cannot hallucinate "light snow" in Riyadh, and it is the part a
// screen reader actually reads out.

const CONDITIONS: Record<number, { en: string; ar: string; icon: string }> = {
  0: { en: "clear sky", ar: "صحو", icon: "☀️" },
  1: { en: "mainly clear", ar: "صحو غالباً", icon: "🌤️" },
  2: { en: "partly cloudy", ar: "غائم جزئياً", icon: "⛅" },
  3: { en: "overcast", ar: "غائم", icon: "☁️" },
  45: { en: "fog", ar: "ضباب", icon: "🌫️" },
  48: { en: "freezing fog", ar: "ضباب متجمد", icon: "🌫️" },
  51: { en: "light drizzle", ar: "رذاذ خفيف", icon: "🌦️" },
  53: { en: "drizzle", ar: "رذاذ", icon: "🌦️" },
  55: { en: "heavy drizzle", ar: "رذاذ كثيف", icon: "🌧️" },
  56: { en: "freezing drizzle", ar: "رذاذ متجمد", icon: "🌧️" },
  57: { en: "heavy freezing drizzle", ar: "رذاذ متجمد كثيف", icon: "🌧️" },
  61: { en: "light rain", ar: "مطر خفيف", icon: "🌦️" },
  63: { en: "rain", ar: "مطر", icon: "🌧️" },
  65: { en: "heavy rain", ar: "مطر غزير", icon: "🌧️" },
  66: { en: "freezing rain", ar: "مطر متجمد", icon: "🌧️" },
  67: { en: "heavy freezing rain", ar: "مطر متجمد غزير", icon: "🌧️" },
  71: { en: "light snow", ar: "ثلج خفيف", icon: "🌨️" },
  73: { en: "snow", ar: "ثلج", icon: "❄️" },
  75: { en: "heavy snow", ar: "ثلج كثيف", icon: "❄️" },
  77: { en: "snow grains", ar: "حبيبات ثلجية", icon: "🌨️" },
  80: { en: "light showers", ar: "زخات خفيفة", icon: "🌦️" },
  81: { en: "showers", ar: "زخات مطر", icon: "🌧️" },
  82: { en: "violent showers", ar: "زخات مطر عنيفة", icon: "⛈️" },
  85: { en: "light snow showers", ar: "زخات ثلج خفيفة", icon: "🌨️" },
  86: { en: "heavy snow showers", ar: "زخات ثلج كثيفة", icon: "❄️" },
  95: { en: "thunderstorm", ar: "عاصفة رعدية", icon: "⛈️" },
  96: { en: "thunderstorm with hail", ar: "عاصفة رعدية مع برد", icon: "⛈️" },
  99: { en: "thunderstorm with heavy hail", ar: "عاصفة رعدية مع برد شديد", icon: "⛈️" },
};

/** Words for a WMO code. An unknown code is described as unknown, not guessed. */
export function describeCode(code: number, language: "ar" | "en"): { text: string; icon: string } {
  const entry = CONDITIONS[code];
  if (!entry) {
    return { text: language === "ar" ? "حالة غير معروفة" : "conditions unavailable", icon: "🌡️" };
  }
  return { text: language === "ar" ? entry.ar : entry.en, icon: entry.icon };
}

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  code: number;
}

export interface DailyWeather {
  date: string;
  code: number;
  max: number;
  min: number;
  rainChance: number;
}

/** Day names, so a forecast reads as "Saturday" and not as "2026-08-22". */
const DAY_NAMES: Record<"ar" | "en", string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
};

/**
 * A calendar day's name from an ISO date.
 *
 * Parsed as UTC noon rather than midnight: `new Date("2026-08-22")` is midnight
 * UTC, and in any negative offset that is still the 21st, which shifts every
 * day name in the forecast by one. Noon is far enough from either boundary that
 * no real timezone crosses it.
 */
export function dayName(isoDate: string, language: "ar" | "en"): string {
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return DAY_NAMES[language][parsed.getUTCDay()];
}

/** Whole degrees. Nobody needs a tenth of a degree read aloud to them. */
function deg(value: number): string {
  return `${Math.round(value)}°`;
}

/**
 * The weather, as a message.
 *
 * Written to be *heard*, not scanned: the headline sentence carries the answer
 * on its own, so a screen-reader user who stops listening after one line still
 * has what they asked for. The detail follows for anyone who wants it.
 */
export function formatWeather(params: {
  language: "ar" | "en";
  placeName: string;
  current: CurrentWeather;
  daily: DailyWeather[];
  includeForecast: boolean;
}): string {
  const { language, placeName, current, daily, includeForecast } = params;
  const condition = describeCode(current.code, language);
  const lines: string[] = [];

  if (language === "ar") {
    lines.push(`${condition.icon} *الطقس في ${placeName}*`);
    lines.push(`${condition.text}، ${deg(current.temperature)}`);
    lines.push(`الإحساس الفعلي ${deg(current.feelsLike)} · الرطوبة ${Math.round(current.humidity)}% · الرياح ${Math.round(current.windSpeed)} كم/س`);
  } else {
    lines.push(`${condition.icon} *Weather in ${placeName}*`);
    lines.push(`${condition.text}, ${deg(current.temperature)}`);
    lines.push(`Feels like ${deg(current.feelsLike)} · humidity ${Math.round(current.humidity)}% · wind ${Math.round(current.windSpeed)} km/h`);
  }

  const upcoming = includeForecast ? daily.slice(0, 3) : daily.slice(0, 1);
  if (upcoming.length > 0) {
    lines.push("");
    lines.push(language === "ar" ? "*الأيام القادمة*" : "*The days ahead*");
    for (const day of upcoming) {
      const shape = describeCode(day.code, language);
      const name = dayName(day.date, language);
      const rain = day.rainChance >= 20
        ? language === "ar"
          ? ` · احتمال مطر ${Math.round(day.rainChance)}%`
          : ` · ${Math.round(day.rainChance)}% chance of rain`
        : "";
      lines.push(
        language === "ar"
          ? `${name}: ${shape.text}، من ${deg(day.min)} إلى ${deg(day.max)}${rain}`
          : `${name}: ${shape.text}, ${deg(day.min)} to ${deg(day.max)}${rain}`,
      );
    }
  }

  return lines.join("\n");
}

/** Asked about the weather with no place named and no location on file. */
export function weatherNeedsPlaceNotice(language: "ar" | "en"): string {
  return language === "ar"
    ? "أخبرني عن أي مدينة تسأل — مثلاً «الطقس في عمّان» — أو شارك موقعك من زر 📎 ← الموقع وسأخبرك بطقس مكانك."
    : "Tell me which city you mean — for example \"weather in Amman\" — or share your location from 📎 → Location and I'll use where you are.";
}

/** The place was named but no map service recognised it. Never a guess. */
export function placeNotFoundNotice(language: "ar" | "en", place: string): string {
  return language === "ar"
    ? `لم أجد مكاناً باسم «${place}». جرّب اسم المدينة الأكبر القريبة، أو شارك موقعك من زر 📎 ← الموقع.`
    : `I couldn't find anywhere called "${place}". Try the nearest larger city, or share your location from 📎 → Location.`;
}

/** The weather service itself failed. Not the sender's fault, and said so. */
export function weatherUnavailableNotice(language: "ar" | "en"): string {
  return language === "ar"
    ? "خدمة الطقس لا تستجيب حالياً. جرّب بعد قليل وسأحضر لك التفاصيل."
    : "The weather service isn't responding right now. Try again shortly and I'll fetch it for you.";
}
