// What somebody meant by "book me a taxi".
//
// One parser, used by the web form, by WhatsApp and by a voice turn, because a
// sentence means the same thing whichever surface it arrives on. Pure: it turns
// text into a partial `MobilityIntent` and says what is still missing. It never
// resolves a place name — that is `whatsappGeo.geocodePlace`, which already
// exists and already has a cache, and a second geocoder would be a second set
// of coordinates for the same word.
//
// ── Why regexes and not a model ─────────────────────────────────────────────
//
// This runs on every message that might be about a ride, and the parts it
// extracts — a provider name, "cheapest", "tomorrow at 7", a passenger count —
// are the parts a regex settles. What a model is for is the residue: which span
// of a sentence is the pickup and which is the destination, in twenty
// languages. That call belongs upstream, and this is what shapes its output
// into something the booking path can check.
//
// ── The rule that outranks accuracy here ────────────────────────────────────
//
// A miss costs one clarifying question. A false positive costs a car. So every
// extractor below prefers null to a guess, and `missingFromIntent` is what the
// assistant asks from — never an assumption filled in silently.

import { EMPTY_INTENT, type MobilityIntent, type QuoteRanking } from "./mobility.ts";

// ── Is this about a ride at all ─────────────────────────────────────────────

/**
 * The words that mean "a car, for me, now or later".
 *
 * Stems, across the scripts this channel speaks, because every one of these
 * languages inflects. This is a gate rather than a parser: what follows it asks
 * questions, and asking "where from?" about a message that was not about a ride
 * is recoverable — booking one is not.
 */
const RIDE_INTENT = [
  /\b(taxi|cab|ride|rideshare|uber|lyft|bolt|careem|didi|grab|cabify|yango|gett)\b/i,
  /\b(pick me up|drop me|book me a car|get me a car|need a car|order a car)\b/i,
  /(تاكسي|تكسي|سيارة|سياره|مشوار|توصيلة|توصيله|أوبر|اوبر|كريم|أقلني|اقلني|وصلني)/,
  /(такси|такси́|поездк)/i,
  /(taksi|táxi|taxista|corrida|carrera|fahrt|rit|przejazd|chuyến xe|택시|タクシー|出租车|计程车|ٹیکسی|ट्रैक्सी|टैक्सी|ট্যাক্সি|تاکسی)/i,
];

/** Longest a message can be and still be read as a ride request rather than prose. */
const MAX_REQUEST_CHARS = 200;

/** Whether this message is asking for a ride. Whole message, bounded length. */
export function looksLikeRideRequest(text: string | null | undefined): boolean {
  const raw = (text ?? "").trim();
  if (!raw || [...raw].length > MAX_REQUEST_CHARS) return false;
  return RIDE_INTENT.some((pattern) => pattern.test(raw));
}

// ── Which provider, if they named one ───────────────────────────────────────
//
// Naming a provider is a preference, never a promise: `rankQuotes` floats it to
// the top and shows the rest underneath, and if it cannot be booked the rider
// is told so rather than quietly given somebody else.

const PROVIDER_WORDS: ReadonlyArray<readonly [string, RegExp]> = [
  ["uber", /\b(uber)\b|(أوبر|اوبر)/i],
  ["lyft", /\b(lyft)\b/i],
  ["bolt", /\b(bolt)\b/i],
  ["careem", /\b(careem)\b|(كريم)/i],
  ["didi", /\b(didi)\b|(滴滴)/i],
  ["grab", /\b(grab)\b/i],
  ["cabify", /\b(cabify)\b/i],
  ["freenow", /\b(free ?now)\b/i],
  ["gett", /\b(gett)\b/i],
  ["yango", /\b(yango)\b|(يانجو)/i],
  ["indrive", /\b(in ?drive)\b/i],
];

export function parseProviderPreference(text: string): string | null {
  for (const [slug, pattern] of PROVIDER_WORDS) {
    if (pattern.test(text)) return slug;
  }
  return null;
}

// ── What they want optimised ────────────────────────────────────────────────

const CHEAPEST = /\b(cheap(est)?|lowest|least expensive|budget)\b|(أرخص|ارخص|أرخص سعر|الأرخص)/i;
const FASTEST = /\b(fast(est)?|quick(est)?|soonest|asap|right now)\b|(أسرع|اسرع|بسرعة|حالا|حالاً)/i;
const ACCESSIBLE = /\b(wheelchair|accessible|wav|step ?free)\b|(كرسي متحرك|كرسي مدولب|لذوي|إعاقة|اعاقة)/i;

export function parseOptimization(text: string): QuoteRanking {
  // Accessibility first: somebody who needs a wheelchair vehicle and says
  // "cheapest wheelchair taxi" needs the vehicle before they need the price.
  if (ACCESSIBLE.test(text)) return "most_accessible";
  if (CHEAPEST.test(text)) return "cheapest";
  if (FASTEST.test(text)) return "fastest";
  return "best_value";
}

// ── How many people ─────────────────────────────────────────────────────────

const PASSENGERS = /\b(\d{1,2})\s*(passengers?|people|persons?|of us|riders?)\b/i;
const PASSENGERS_AR = /(\d{1,2})\s*(أشخاص|اشخاص|شخص|ركاب|راكب|نفر)/;

const WORD_COUNTS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  واحد: 1, اثنين: 2, ثلاثة: 3, أربعة: 4, اربعة: 5, خمسة: 5, ستة: 6,
};

/**
 * A passenger count, or null.
 *
 * Bounded at sixteen because that is the largest vehicle any of these providers
 * offers, and an unbounded number here becomes a request no provider can fill
 * and an error the rider cannot act on.
 */
export function parsePassengerCount(text: string): number | null {
  const digits = PASSENGERS.exec(text) ?? PASSENGERS_AR.exec(text);
  if (digits) {
    const count = Number.parseInt(digits[1], 10);
    return count >= 1 && count <= 16 ? count : null;
  }
  const words = /\b(one|two|three|four|five|six|seven|eight)\s+(?:passengers?|people|of us)\b/i.exec(text);
  if (words) return WORD_COUNTS[words[1].toLowerCase()] ?? null;
  return null;
}

// ── What they need in the car ───────────────────────────────────────────────

const ACCESSIBILITY_WORDS: ReadonlyArray<readonly [string, RegExp]> = [
  ["wheelchair", /\b(wheelchair|wav|step ?free)\b|(كرسي متحرك|كرسي مدولب)/i],
  ["assistance", /\b(assistance|help getting in|extra help)\b|(مساعدة|مساعده)/i],
  ["visually_impaired", /\b(blind|visually impaired|guide dog)\b|(كفيف|مكفوف|ضرير)/i],
  ["hearing_impaired", /\b(deaf|hard of hearing|hearing impaired)\b|(أصم|اصم|ضعف سمع)/i],
  ["child_seat", /\b(child seat|baby seat|car seat|infant)\b|(كرسي أطفال|مقعد طفل|طفل رضيع)/i],
  ["luggage", /\b(luggage|suitcases?|bags?|baggage)\b|(حقائب|شنط|أمتعة|امتعة)/i],
  ["pet", /\b(pet|dog|cat)\b|(حيوان أليف|كلب|قطة)/i],
];

export function parseAccessibility(text: string): string[] {
  return ACCESSIBILITY_WORDS
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

// ── When ────────────────────────────────────────────────────────────────────

const NOW_WORDS = /\b(now|right now|asap|immediately)\b|(الآن|الان|حالا|حالاً|فورا|فوراً)/i;
const TOMORROW = /\b(tomorrow)\b|(غدا|غداً|بكرا|بكرة|الغد)/i;
const TODAY = /\b(today|tonight|this evening)\b|(اليوم|الليلة|المساء)/i;
const AT_TIME = /\b(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
const AT_TIME_AR = /(?:الساعة|على الساعة|ع الساعة)\s*(\d{1,2})(?::(\d{2}))?/;

export interface ParsedWhen {
  /** True when they said "now", or said nothing about time at all. */
  immediate: boolean;
  /** Wall-clock hour and minute in the pickup's own zone. Null when unsaid. */
  hour: number | null;
  minute: number;
  /** Days from today, in the pickup's own zone. */
  dayOffset: number;
}

/**
 * When they want it, as wall-clock parts rather than an instant.
 *
 * Deliberately not a `Date`. "Tomorrow at eight" is eight o'clock *where the
 * rider is standing*, and turning it into an instant needs the pickup's time
 * zone — which is not known until the pickup is resolved. Producing a UTC
 * instant here would bake this machine's zone into somebody else's morning.
 */
export function parseWhen(text: string): ParsedWhen {
  const dayOffset = TOMORROW.test(text) ? 1 : 0;
  const match = AT_TIME.exec(text) ?? AT_TIME_AR.exec(text);

  if (!match) {
    return { immediate: !TOMORROW.test(text) && !TODAY.test(text), hour: null, minute: 0, dayOffset };
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiem = (match[3] ?? "").toLowerCase();

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) {
    return { immediate: false, hour: null, minute: 0, dayOffset };
  }

  return { immediate: false, hour, minute, dayOffset };
}

/**
 * A wall-clock time in a zone, as the UTC instant to store.
 *
 * Built by asking what that zone's offset is at roughly that moment rather than
 * by arithmetic on a local `Date`, because the machine running this is in UTC
 * and the rider is not. A pickup that lands in the past — "at 7" said at nine
 * in the evening — rolls to the next day, which is what the rider meant.
 */
export function toUtcInstant(when: ParsedWhen, timezone: string, nowMs: number): string | null {
  if (when.hour === null) return null;

  // Validated once, up front. An unknown zone must not throw from inside a
  // booking path: `Intl` rejects it with a RangeError, and the honest fallback
  // is UTC with a wrong-looking time rather than a request that dies.
  let zone = timezone || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(new Date(nowMs));
  } catch {
    zone = "UTC";
  }

  const offsetMinutesAt = (instantMs: number): number => {
    try {
      // What the same instant reads as in the target zone, compared with UTC.
      const local = new Date(
        new Date(instantMs).toLocaleString("en-US", { timeZone: zone }),
      ).getTime();
      const utc = new Date(new Date(instantMs).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
      return Math.round((local - utc) / 60_000);
    } catch {
      return 0;
    }
  };

  const guess = new Date(nowMs + when.dayOffset * 86_400_000);
  const offset = offsetMinutesAt(guess.getTime());

  // The calendar day, as it reads in the pickup's zone rather than here.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(guess);
  const ymd = ["year", "month", "day"].map((k) => parts.find((p) => p.type === k)?.value ?? "");
  if (ymd.some((part) => !part)) return null;

  const asUtc = Date.parse(`${ymd[0]}-${ymd[1]}-${ymd[2]}T${String(when.hour).padStart(2, "0")}:${String(when.minute).padStart(2, "0")}:00Z`);
  if (!Number.isFinite(asUtc)) return null;

  let instant = asUtc - offset * 60_000;
  // Said "at 7" after seven has gone: they meant tomorrow's seven.
  if (instant <= nowMs && when.dayOffset === 0) instant += 86_400_000;
  return new Date(instant).toISOString();
}

// ── Everything a sentence says, in one pass ─────────────────────────────────

/**
 * The intent a message carries, with locations left for the geocoder.
 *
 * Returns a partial intent rather than a complete one on purpose: `pickup` and
 * `destination` are the two fields a regex has no business inventing, and
 * `missingFromIntent` is what turns their absence into the next question.
 */
export function parseMobilityIntent(text: string | null | undefined): MobilityIntent {
  const raw = (text ?? "").trim();
  if (!raw) return { ...EMPTY_INTENT };

  return {
    ...EMPTY_INTENT,
    passengerCount: parsePassengerCount(raw) ?? 1,
    providerPreference: parseProviderPreference(raw),
    optimization: parseOptimization(raw),
    accessibility: parseAccessibility(raw),
    flightNumber: parseFlightNumber(raw),
  };
}

/**
 * A flight number, for an airport pickup.
 *
 * Two or three letters and one to four digits, whole-word, uppercased. Kept
 * narrow because the shape collides with ordinary words — and a wrong flight
 * number attached to a scheduled pickup is worse than none, since it is the
 * field an airport transfer would be timed from.
 */
export function parseFlightNumber(text: string): string | null {
  const match = /\b([A-Z]{2,3})\s?(\d{1,4})\b/.exec(text.toUpperCase());
  if (!match) return null;
  // "AT 8" and "OK 1" are a time and an acknowledgement, not flights.
  if (/^(AT|ON|IN|BY|OK|NO|SO|TO|IS|IT)$/.test(match[1])) return null;
  return `${match[1]}${match[2]}`;
}
