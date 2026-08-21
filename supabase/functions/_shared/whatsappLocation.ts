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
 * The best single name for a place.
 *
 * A pin in the middle of a city gives locality and city as the same word, and
 * repeating it — "الرياض، الرياض، منطقة الرياض" — is noise when it is read
 * aloud. Deduplicated in order, most specific first.
 */
export function placeLabel(place: PlaceDescription, fallback?: string | null): string {
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
  return unique.slice(0, 3).join("، ");
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

const COMPASS: Record<"ar" | "en", string[]> = {
  en: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"],
  ar: ["شمالاً", "شمال شرق", "شرقاً", "جنوب شرق", "جنوباً", "جنوب غرب", "غرباً", "شمال غرب"],
};

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
  language: "ar" | "en",
): string {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(toRad(to.latitude));
  const x =
    Math.cos(toRad(from.latitude)) * Math.sin(toRad(to.latitude)) -
    Math.sin(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.cos(dLon);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  const index = Math.round(((degrees + 360) % 360) / 45) % 8;
  return COMPASS[language][index];
}

export function formatDistance(metres: number, language: "ar" | "en"): string {
  if (metres < 1000) {
    return language === "ar" ? `${metres} متر` : `${metres} m`;
  }
  const km = (metres / 1000).toFixed(1);
  return language === "ar" ? `${km} كم` : `${km} km`;
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
export const NEARBY_CATEGORIES: Record<string, { en: string; ar: string }> = {
  pharmacy: { en: "pharmacy", ar: "صيدلية" },
  hospital: { en: "hospital", ar: "مستشفى" },
  clinic: { en: "clinic", ar: "عيادة" },
  supermarket: { en: "supermarket", ar: "سوبرماركت" },
  bakery: { en: "bakery", ar: "مخبز" },
  restaurant: { en: "restaurant", ar: "مطعم" },
  cafe: { en: "café", ar: "مقهى" },
  bank: { en: "bank", ar: "بنك" },
  atm: { en: "ATM", ar: "صراف آلي" },
  bus_stop: { en: "bus stop", ar: "موقف حافلات" },
  station: { en: "station", ar: "محطة" },
  place_of_worship: { en: "place of worship", ar: "مسجد أو دار عبادة" },
  fuel: { en: "petrol station", ar: "محطة وقود" },
  police: { en: "police station", ar: "مركز شرطة" },
  post_office: { en: "post office", ar: "مكتب بريد" },
  school: { en: "school", ar: "مدرسة" },
  convenience: { en: "corner shop", ar: "بقالة" },
};

export function categoryLabel(category: string, language: "ar" | "en"): string {
  const entry = NEARBY_CATEGORIES[category];
  if (entry) return language === "ar" ? entry.ar : entry.en;
  return category.replace(/_/g, " ");
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
  language: "ar" | "en";
  place: PlaceDescription;
  pinName?: string | null;
  pinAddress?: string | null;
  latitude: number;
  longitude: number;
}): string {
  const { language, place, pinName, pinAddress, latitude, longitude } = params;
  const label = placeLabel(place, pinName ?? pinAddress);
  const lines: string[] = [];

  if (language === "ar") {
    lines.push(`📍 *أنت هنا*`);
    if (label) lines.push(label);
    if (pinName && pinName.trim() && !label.includes(pinName.trim())) lines.push(pinName.trim());
    if (pinAddress && pinAddress.trim() && pinAddress.trim() !== pinName?.trim()) {
      lines.push(pinAddress.trim());
    }
    if (!label && !pinName && !pinAddress) {
      lines.push("لم أتعرّف على اسم المكان، لكن الإحداثيات وصلت.");
    }
  } else {
    lines.push(`📍 *You are here*`);
    if (label) lines.push(label);
    if (pinName && pinName.trim() && !label.includes(pinName.trim())) lines.push(pinName.trim());
    if (pinAddress && pinAddress.trim() && pinAddress.trim() !== pinName?.trim()) {
      lines.push(pinAddress.trim());
    }
    if (!label && !pinName && !pinAddress) {
      lines.push("I couldn't name the place, but the coordinates came through.");
    }
  }

  lines.push("");
  lines.push(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
  return lines.join("\n");
}

/** Nearby places, nearest first, as a message. */
export function formatNearby(params: {
  language: "ar" | "en";
  origin: { latitude: number; longitude: number };
  places: NearbyPlace[];
}): string {
  const { language, origin, places } = params;
  if (places.length === 0) {
    return language === "ar"
      ? "لم أجد أماكن معروفة على الخريطة قريبة منك. الخرائط المفتوحة أحياناً ناقصة في بعض المناطق."
      : "I couldn't find anything mapped near you. Open map data is patchy in some areas.";
  }

  const lines = [language === "ar" ? "🧭 *حولك*" : "🧭 *Around you*"];
  for (const place of places) {
    const metres = distanceMetres(origin, place);
    const direction = bearingLabel(origin, place, language);
    lines.push(
      language === "ar"
        ? `• ${place.name} (${categoryLabel(place.category, language)}) — ${formatDistance(metres, language)} ${direction}`
        : `• ${place.name} (${categoryLabel(place.category, language)}) — ${formatDistance(metres, language)} ${direction}`,
    );
  }
  lines.push("");
  lines.push(
    language === "ar"
      ? "المسافات بالخط المستقيم، وليست مسار مشي."
      : "Distances are straight-line, not walking routes.",
  );
  return lines.join("\n");
}

/** Asked about here, with no pin on file and none in the message. */
export function locationNeededNotice(language: "ar" | "en"): string {
  return language === "ar"
    ? "شارك موقعك أولاً: اضغط 📎 ثم «الموقع» ثم «إرسال موقعي الحالي». سأخبرك بمكانك وما حولك وطقس المنطقة."
    : "Share your location first: tap 📎 → Location → Send your current location. I'll tell you where you are, what's around you, and the weather there.";
}

/** The map service failed. Coordinates still arrived, and that is said plainly. */
export function geocodeUnavailableNotice(language: "ar" | "en"): string {
  return language === "ar"
    ? "وصلني موقعك لكن خدمة الخرائط لا تستجيب الآن. جرّب بعد قليل."
    : "Your location arrived, but the map service isn't responding right now. Try again shortly.";
}

/**
 * The line that turns a pin into a conversation.
 *
 * Appended to "you are here" rather than acting on its own, because the
 * expensive lookup — what is mapped nearby — should be a choice and not a tax
 * on every pin. It is also how the capability gets discovered at the exact
 * moment it is useful, which is worth more than a line in a menu read weeks ago.
 */
export function nearbyHint(language: "ar" | "en"): string {
  return language === "ar"
    ? "قل «حولي» لأخبرك بأقرب الأماكن، أو «الطقس» لطقس هذا المكان."
    : "Say \"near me\" for what's around you, or \"weather\" for the forecast here.";
}
