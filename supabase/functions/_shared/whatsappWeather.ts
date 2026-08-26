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
//
// The words live in `whatsappStrings.ts` with the rest of the interface's
// vocabulary, in all twenty languages. What stays here is everything that is
// not words: which code means which condition, which icon goes with it, when a
// chance of rain is worth mentioning, and the sixty-character rule below.

import type { Language } from "./whatsappCatalog.ts";
import { say, type UiKey } from "./whatsappStrings.ts";

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

const CONDITIONS: Record<number, { key: UiKey; icon: string }> = {
  0: { key: "wxClear", icon: "☀️" },
  1: { key: "wxMainlyClear", icon: "🌤️" },
  2: { key: "wxPartlyCloudy", icon: "⛅" },
  3: { key: "wxOvercast", icon: "☁️" },
  45: { key: "wxFog", icon: "🌫️" },
  48: { key: "wxFreezingFog", icon: "🌫️" },
  51: { key: "wxLightDrizzle", icon: "🌦️" },
  53: { key: "wxDrizzle", icon: "🌦️" },
  55: { key: "wxHeavyDrizzle", icon: "🌧️" },
  56: { key: "wxFreezingDrizzle", icon: "🌧️" },
  57: { key: "wxHeavyFreezingDrizzle", icon: "🌧️" },
  61: { key: "wxLightRain", icon: "🌦️" },
  63: { key: "wxRain", icon: "🌧️" },
  65: { key: "wxHeavyRain", icon: "🌧️" },
  66: { key: "wxFreezingRain", icon: "🌧️" },
  67: { key: "wxHeavyFreezingRain", icon: "🌧️" },
  71: { key: "wxLightSnow", icon: "🌨️" },
  73: { key: "wxSnow", icon: "❄️" },
  75: { key: "wxHeavySnow", icon: "❄️" },
  77: { key: "wxSnowGrains", icon: "🌨️" },
  80: { key: "wxLightShowers", icon: "🌦️" },
  81: { key: "wxShowers", icon: "🌧️" },
  82: { key: "wxViolentShowers", icon: "⛈️" },
  85: { key: "wxLightSnowShowers", icon: "🌨️" },
  86: { key: "wxHeavySnowShowers", icon: "❄️" },
  95: { key: "wxThunderstorm", icon: "⛈️" },
  96: { key: "wxThunderstormHail", icon: "⛈️" },
  99: { key: "wxThunderstormHeavyHail", icon: "⛈️" },
};

/**
 * Words for a WMO code. An unknown code is described as unknown, not guessed.
 *
 * The words moved to `whatsappStrings.ts` and the icons stayed here, because an
 * icon is not a translation: ☀️ means the same thing in Urdu, and a table that
 * repeated it twenty times would be twenty chances to disagree about which
 * picture goes with which code.
 */
export function describeCode(code: number, language: Language): { text: string; icon: string } {
  const entry = CONDITIONS[code];
  if (!entry) return { text: say("wxUnknown", language), icon: "🌡️" };
  return { text: say(entry.key, language), icon: entry.icon };
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

/**
 * A calendar day's name from an ISO date.
 *
 * Parsed as UTC noon rather than midnight: `new Date("2026-08-22")` is midnight
 * UTC, and in any negative offset that is still the 21st, which shifts every
 * day name in the forecast by one. Noon is far enough from either boundary that
 * no real timezone crosses it.
 *
 * `Intl` rather than a table. Twenty languages of weekday names is twenty
 * chances to be wrong about somebody's calendar, and the runtime already ships
 * the right answer for all of them — including which day the week starts on,
 * which a hand-written array indexed by `getUTCDay()` quietly assumes.
 */
export function dayName(isoDate: string, language: Language): string {
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  try {
    return new Intl.DateTimeFormat(language, { weekday: "long", timeZone: "UTC" }).format(parsed);
  } catch {
    return isoDate;
  }
}

/** Whole degrees. Nobody needs a tenth of a degree read aloud to them. */
function deg(value: number): string {
  return `${Math.round(value)}°`;
}

/**
 * Wind speed with its unit, in the sender's language.
 *
 * `-u-nu-latn` on purpose: `Intl` would otherwise write Arabic-Indic digits for
 * `ar` and `fa`, and the temperatures beside it are plain `${Math.round}`
 * output. One message with two numbering systems in it is worse than either.
 */
function windSpeed(value: number, language: Language): string {
  const rounded = Math.round(value);
  try {
    return new Intl.NumberFormat(`${language}-u-nu-latn`, {
      style: "unit",
      unit: "kilometer-per-hour",
      unitDisplay: "short",
    }).format(rounded);
  } catch {
    return `${rounded} km/h`;
  }
}

/**
 * The weather, as a message.
 *
 * Written to be *heard*, not scanned: the headline sentence carries the answer
 * on its own, so a screen-reader user who stops listening after one line still
 * has what they asked for. The detail follows for anyone who wants it.
 */
export function formatWeather(params: {
  language: Language;
  placeName: string;
  current: CurrentWeather;
  daily: DailyWeather[];
  includeForecast: boolean;
}): string {
  const { language, placeName, current, daily, includeForecast } = params;
  const condition = describeCode(current.code, language);
  const lines: string[] = [];

  lines.push(`${condition.icon} ${say("weatherHeading", language).replace("{place}", placeName)}`);
  lines.push(
    say("weatherNow", language)
      .replace("{condition}", condition.text)
      .replace("{temp}", deg(current.temperature)),
  );
  lines.push(
    say("weatherDetail", language)
      .replace("{feels}", deg(current.feelsLike))
      .replace("{humidity}", String(Math.round(current.humidity)))
      .replace("{wind}", windSpeed(current.windSpeed, language)),
  );

  const upcoming = includeForecast ? daily.slice(0, 3) : daily.slice(0, 1);
  if (upcoming.length > 0) {
    lines.push("");
    lines.push(say("weatherDaysAhead", language));
    for (const day of upcoming) {
      const shape = describeCode(day.code, language);
      // Below one chance in five, the forecast says nothing about rain rather
      // than reading out a number that means "probably not".
      const rain = day.rainChance >= 20
        ? say("weatherRain", language).replace("{chance}", String(Math.round(day.rainChance)))
        : "";
      lines.push(
        say("weatherDayLine", language)
          .replace("{day}", dayName(day.date, language))
          .replace("{condition}", shape.text)
          .replace("{min}", deg(day.min))
          .replace("{max}", deg(day.max))
          .replace("{rain}", rain),
      );
    }
  }

  return lines.join("\n");
}

/** Asked about the weather with no place named and no location on file. */
export function weatherNeedsPlaceNotice(language: Language): string {
  return say("weatherNeedsPlace", language);
}

/** The place was named but no map service recognised it. Never a guess. */
export function placeNotFoundNotice(language: Language, place: string): string {
  return say("weatherPlaceNotFound", language).replace("{place}", place);
}

/** The weather service itself failed. Not the sender's fault, and said so. */
export function weatherUnavailableNotice(language: Language): string {
  return say("weatherUnavailable", language);
}
