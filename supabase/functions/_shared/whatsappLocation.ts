// Where the sender is, and what is around them.
//
// WhatsApp has a location attachment, and until now this assistant answered one
// with "I can't read that kind of message (location) yet" — which is a strange
// thing to say to a blind user who has just told you exactly where they are
// standing. A shared pin is the most precise input this channel has, and it is
// two taps: 📎 → Location. No typing, no camera, no aiming.
//
// So a pin is answered on its own terms — you are here, this is around you,
// this is the weather — and it is remembered briefly so "what's the weather"
// five minutes later needs no second pin.
//
// Pure and provider-free. The fetching lives in `whatsappGeo.ts`.

/**
 * How long a shared pin answers later questions.
 *
 * Six hours is a working day's errand: long enough that asking about the
 * weather after lunch still knows which city you are in, short enough that
 * yesterday's pin never answers today's question from another town. A stale
 * location is worse than none — it is confidently wrong about the one thing
 * the sender could not check for themselves.
 */
export const LOCATION_TTL_MS = 6 * 60 * 60 * 1000;

// The words — compass points, category names, the headings — are in
// `whatsappStrings.ts` with the rest of the interface's vocabulary, in all
// twenty languages. What stays here is the arithmetic: bearings, distances,
// which OSM tag counts as which category, and the six-hour clock above.
import type { Language } from "./whatsappCatalog.ts";
import { say, type UiKey } from "./whatsappStrings.ts";

/** A pin as WhatsApp delivers it. */
export interface SharedLocation {
  latitude: number;
  longitude: number;
  /** The name the sender's phone attached, when they picked a saved place. */
  name?: string;
  address?: string;
}

/** What a reverse-geocode lookup yields. Every field is optional in practice. */
export interface PlaceDescription {
  locality: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}

/**
 * Coordinates that could actually exist.
 *
 * A malformed payload — or a spoofed one — should not send a query for
 * latitude 900 to a public map service, and `0,0` is Null Island: the value a
 * broken GPS reports, never a place a person is standing.
 */
export function isUsableCoordinate(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return Math.abs(lat) > 0.0001 || Math.abs(lon) > 0.0001;
}

const WHERE_AM_I = [
  /\b(where am i|where i am|what'?s my location|my location|locate me)\b/i,
  /\b(what address|which (city|street|area)) am i\b/i,
  /(وين أنا|وين انا|أين أنا|اين انا|فين أنا|فين انا|موقعي|وين موقعي|أين موقعي)/,
  /(في أي مدينة أنا|في اي مدينه انا|وين صرت)/,
];

const WHATS_NEARBY = [
  /\b(what'?s (nearby|near me|around me|around here)|near me|nearby|around me)\b/i,
  /\b(closest|nearest)\s+(shop|store|pharmacy|restaurant|cafe|bank|atm|bus|hospital|supermarket|mosque)\b/i,
  /(شو حولي|ايش حولي|وش حولي|ما حولي|حواليي|شو في حولي|القريب مني|أقرب|اقرب)/,
  /(وين أقرب|وين اقرب|فين أقرب|أقرب صيدلية|اقرب صيدليه|أقرب محل|أقرب مطعم|أقرب مسجد)/,
];

/** Longest a message can be and still be read as a location command. */
export const LOCATION_MAX_CHARS = 80;

/**
 * "Send me the location of X" — the place, or null.
 *
 * Every pattern demands an explicit location word. A bare "وين X" is
 * deliberately not enough, and the reason is a collision that would break a
 * capability this audience relies on: "وين مفاتيحي" is somebody about to
 * photograph a room, and answering it with a map search would arm nothing,
 * find nothing, and waste the one question they asked. So the request has to
 * name a location — موقع, لوكيشن, عنوان, "location of", "address of" — before
 * anything is looked up.
 *
 * A possessive is the other exclusion. "موقعي" and "my location" are the
 * where-am-I question, which is answered from the pin on file and must not be
 * handed to a geocoder as the literal search term "my".
 */
const FIND_PLACE = [
  // ابعتلي / أرسل لي / بدي / وين / أعطني … موقع | لوكيشن | عنوان | إحداثيات …
  /(?:^|\s)(?:ابعت|ابعتلي|إبعتلي|ارسل|أرسل|ارسلي|أرسلي|بدي|بدّي|أريد|اريد|اعطني|أعطني|عطني|وين|أين|فين|ما)?\s*(?:لي\s+)?(?:موقع|لوكيشن|عنوان|إحداثيات|احداثيات)\s+(.{2,60})$/u,
  // وين يقع / وين يوجد / أين يقع …
  /(?:وين|أين|اين|فين)\s+(?:يقع|تقع|يوجد|توجد|بيقع)\s+(.{2,60})$/u,
  /\bsend\s+(?:me\s+)?(?:the\s+)?location\s+(?:of|for)\s+(.{2,60})$/i,
  /\b(?:the\s+)?(?:location|address|coordinates)\s+(?:of|for)\s+(.{2,60})$/i,
  /\bwhere\s+is\s+(.{2,60}?)\s+located\b/i,
  /\bfind\s+(?:me\s+)?(?:the\s+)?(.{2,60})\s+(?:location|branch)\b/i,
];

/** Words that mean the sender, not a place, and must never be searched for. */
const POSSESSIVE = /^(?:my|our|your|his|her|their|me|us|i)\b|^(?:ي|نا|ك|كم|هم)$|^(?:موقعي|موقعنا|موقعك)$/i;

/** A request may be longer than a command — a place name carries words. */
export const PLACE_QUERY_MAX_CHARS = 160;

export function parseFindPlaceRequest(text: string): string | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > PLACE_QUERY_MAX_CHARS) return null;

  // "موقعي" is one word: the pattern below would otherwise read "موقع" plus a
  // remainder of "ي" and search a map for a single letter.
  if (/^(?:موقعي|موقعنا|وين موقعي|أين موقعي|my location|our location)\b/i.test(trimmed)) return null;

  for (const pattern of FIND_PLACE) {
    const match = pattern.exec(trimmed);
    const captured = match?.[1]?.trim().replace(/[؟?.!,]+$/u, "").trim();
    if (!captured || captured.length < 2) continue;
    if (POSSESSIVE.test(captured)) continue;
    return captured.slice(0, 80);
  }
  return null;
}

export function asksWhereAmI(text: string): boolean {
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > LOCATION_MAX_CHARS) return false;
  return WHERE_AM_I.some((pattern) => pattern.test(trimmed));
}

export function asksWhatIsNearby(text: string): boolean {
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > LOCATION_MAX_CHARS) return false;
  return WHATS_NEARBY.some((pattern) => pattern.test(trimmed));
}

/**
 * The comma a language actually writes.
 *
 * Not decoration. The Arabic comma was hardcoded below, so an English sender's
 * own city came back as "Amman، Al Asimah، Jordan" — a character their screen
 * reader announces, in the middle of an English sentence, for no reason.
 */
function listSeparator(language: Language): string {
  if (language === "ar" || language === "fa" || language === "ur") return "، ";
  if (language === "zh" || language === "ja") return "、";
  return ", ";
}

/**
 * The best single name for a place.
 *
 * A pin in the middle of a city gives locality and city as the same word, and
 * repeating it — "الرياض، الرياض، منطقة الرياض" — is noise when it is read
 * aloud. Deduplicated in order, most specific first.
 */
export function placeLabel(
  place: PlaceDescription,
  fallback?: string | null,
  language: Language = "ar",
): string {
  const parts = [place.locality, place.city, place.region, place.country]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);

  const seen = new Set<string>();
  const unique = parts.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return (fallback ?? "").trim();
  return unique.slice(0, 3).join(listSeparator(language));
}

/** A short name for the same place — the city, for a weather headline. */
export function shortPlaceLabel(place: PlaceDescription, fallback?: string | null): string {
  return (place.city ?? place.locality ?? place.region ?? place.country ?? fallback ?? "").trim();
}

/**
 * Metres between two points, on a sphere.
 *
 * Haversine, because at the scale that matters here — a few hundred metres to a
 * pharmacy — the difference between a sphere and an ellipsoid is centimetres,
 * and nobody walks to centimetre precision.
 */
export function distanceMetres(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

// Clockwise from north, in 45° steps. The words are in `whatsappStrings.ts`;
// what is here is the order, which is geometry rather than language.
const COMPASS: readonly UiKey[] = [
  "compassNorth", "compassNorthEast", "compassEast", "compassSouthEast",
  "compassSouth", "compassSouthWest", "compassWest", "compassNorthWest",
];

/**
 * Which way to walk.
 *
 * A distance on its own is not directions — "80 metres" is true of every point
 * on a circle. A compass point is the least a person can act on, and it is what
 * a phone compass can be held against.
 */
export function bearingLabel(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  language: Language,
): string {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(toRad(to.latitude));
  const x =
    Math.cos(toRad(from.latitude)) * Math.sin(toRad(to.latitude)) -
    Math.sin(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.cos(dLon);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  const index = Math.round(((degrees + 360) % 360) / 45) % 8;
  return say(COMPASS[index], language);
}

/**
 * A distance with its unit, in the sender's language.
 *
 * `Intl` rather than two hand-written suffixes: it knows the abbreviation in
 * all twenty languages, including which ones put it before the number. The
 * `-u-nu-latn` is deliberate — Arabic and Persian would otherwise be written
 * in Arabic-Indic digits while the coordinates on the next line are not, and
 * one message with two numbering systems in it is worse than either.
 */
export function formatDistance(metres: number, language: Language): string {
  const below = metres < 1000;
  const value = below ? metres : Number((metres / 1000).toFixed(1));
  try {
    return new Intl.NumberFormat(`${language}-u-nu-latn`, {
      style: "unit",
      unit: below ? "meter" : "kilometer",
      unitDisplay: "short",
    }).format(value);
  } catch {
    return below ? `${value} m` : `${value} km`;
  }
}

/** A place worth mentioning near the sender. */
export interface NearbyPlace {
  name: string;
  category: string;
  latitude: number;
  longitude: number;
}

/**
 * Categories worth naming, in words rather than OSM tags.
 *
 * Chosen for what someone standing on a pavement actually needs: a way to get
 * somewhere, something to eat, medicine, money, and a landmark to orient by.
 */
export const NEARBY_CATEGORIES: Record<string, UiKey> = {
  pharmacy: "catPharmacy",
  hospital: "catHospital",
  clinic: "catClinic",
  supermarket: "catSupermarket",
  bakery: "catBakery",
  restaurant: "catRestaurant",
  cafe: "catCafe",
  bank: "catBank",
  atm: "catAtm",
  bus_stop: "catBusStop",
  station: "catStation",
  place_of_worship: "catWorship",
  fuel: "catFuel",
  police: "catPolice",
  post_office: "catPostOffice",
  school: "catSchool",
  convenience: "catConvenience",
};

export function categoryLabel(category: string, language: Language): string {
  const key = NEARBY_CATEGORIES[category];
  // An OSM tag this table has never seen is shown as the tag with its
  // underscores removed — visibly foreign, rather than silently missing.
  return key ? say(key, language) : category.replace(/_/g, " ");
}

/**
 * Where you are, as a message.
 *
 * The first line is the whole answer, because that is the line that gets heard.
 * The pin's own name — the label the sender's phone attached — leads when there
 * is one: it is often a saved place ("Home", "the office") and more meaningful
 * to them than any street the map knows about.
 */
export function formatWhereYouAre(params: {
  language: Language;
  place: PlaceDescription;
  pinName?: string | null;
  pinAddress?: string | null;
  latitude: number;
  longitude: number;
}): string {
  const { language, place, pinName, pinAddress, latitude, longitude } = params;
  const label = placeLabel(place, pinName ?? pinAddress, language);
  const lines: string[] = [`📍 ${say("whereHeading", language)}`];

  if (label) lines.push(label);
  if (pinName && pinName.trim() && !label.includes(pinName.trim())) lines.push(pinName.trim());
  if (pinAddress && pinAddress.trim() && pinAddress.trim() !== pinName?.trim()) {
    lines.push(pinAddress.trim());
  }
  if (!label && !pinName && !pinAddress) lines.push(say("whereUnknown", language));

  lines.push("");
  lines.push(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
  return lines.join("\n");
}

/** Nearby places, nearest first, as a message. */
export function formatNearby(params: {
  language: Language;
  origin: { latitude: number; longitude: number };
  places: NearbyPlace[];
}): string {
  const { language, origin, places } = params;
  if (places.length === 0) return say("nearbyNone", language);

  const lines = [`🧭 ${say("nearbyHeading", language)}`];
  for (const place of places) {
    lines.push(
      say("nearbyLine", language)
        .replace("{name}", place.name)
        .replace("{category}", categoryLabel(place.category, language))
        .replace("{distance}", formatDistance(distanceMetres(origin, place), language))
        .replace("{direction}", bearingLabel(origin, place, language)),
    );
  }
  lines.push("");
  lines.push(say("nearbyStraightLine", language));
  return lines.join("\n");
}

/**
 * The words that go with the pin.
 *
 * Sent as its own message, before the pin itself, because a location message
 * carries a name and an address and nothing else — there is no room in it for
 * "this is 400 m north of you", and that sentence is the one that tells
 * somebody whether to walk or to call a taxi.
 */
export function formatPlaceFound(params: {
  language: Language;
  name: string;
  country?: string | null;
  from?: { latitude: number; longitude: number } | null;
  to: { latitude: number; longitude: number };
}): string {
  const { language, name, country, from, to } = params;
  const lines = [say("placeFound", language).replace("{name}", name)];

  if (country && !name.includes(country)) lines.push(country);

  if (from) {
    lines.push(
      say("placeAway", language)
        .replace("{distance}", formatDistance(distanceMetres(from, to), language))
        .replace("{direction}", bearingLabel(from, to, language)),
    );
  }

  lines.push("");
  lines.push(`${to.latitude.toFixed(5)}, ${to.longitude.toFixed(5)}`);
  return lines.join("\n");
}

/**
 * Nothing by that name.
 *
 * Separate from the weather module's near-identical refusal, and deliberately
 * so: that one says "try the nearest larger city", which is right when you
 * want a forecast and useless when you want a bank branch. Map indexes are
 * patchy about branch names and generous about "name + city", so the advice
 * here is to add the city, which turns a dead end into a second attempt that
 * usually works.
 */
export function placeLookupFailedNotice(language: Language, query: string): string {
  return say("placeNotFound", language).replace("{query}", query);
}

/** Asked about here, with no pin on file and none in the message. */
export function locationNeededNotice(language: Language): string {
  return say("locationNeeded", language);
}

/** The map service failed. Coordinates still arrived, and that is said plainly. */
export function geocodeUnavailableNotice(language: Language): string {
  return say("geocodeUnavailable", language);
}

/**
 * The line that turns a pin into a conversation.
 *
 * Appended to "you are here" rather than acting on its own, because the
 * expensive lookup — what is mapped nearby — should be a choice and not a tax
 * on every pin. It is also how the capability gets discovered at the exact
 * moment it is useful, which is worth more than a line in a menu read weeks ago.
 */
export function nearbyHint(language: Language): string {
  return say("nearbyHint", language);
}
