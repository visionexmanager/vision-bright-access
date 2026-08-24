// The countries a WhatsApp sender can say they live in.
//
// ── Why a table and not a list of names ─────────────────────────────────────
//
// A country has a different name in each of the twenty languages Visionex
// speaks, and writing all twenty by hand would be four thousand strings nobody
// could check. The runtime already knows them: `Intl.DisplayNames` ships with
// the ICU data in both Deno and Node, so this file carries only what ICU does
// not — the ISO code, which is what gets stored, and the international dialling
// prefix, which is what lets the question be answered with one tap instead of
// with typing.
//
// The English name is written out anyway. It is the fallback for a runtime
// built without full ICU, and it is matched against directly, so somebody who
// types "Jordan" is understood whatever language they picked.
//
// ── What is stored ──────────────────────────────────────────────────────────
//
// The ISO 3166-1 alpha-2 code, always. Never the display name: a name is a
// translation and translations change, and a profile row reading "Türkiye" that
// no longer matches anything is a profile row that has quietly lost its country.
//
// Pure: no `Deno`, no fetch, no database.

import type { SupportedLanguage } from "./whatsappLanguages.ts";

/** `[ISO 3166-1 alpha-2, international dialling prefix, English name]`. */
type CountryRow = readonly [code: string, dial: string, english: string];

const COUNTRY_ROWS: readonly CountryRow[] = [
  ["AF", "93", "Afghanistan"],
  ["AL", "355", "Albania"],
  ["DZ", "213", "Algeria"],
  ["AD", "376", "Andorra"],
  ["AO", "244", "Angola"],
  ["AG", "1268", "Antigua & Barbuda"],
  ["AR", "54", "Argentina"],
  ["AM", "374", "Armenia"],
  ["AU", "61", "Australia"],
  ["AT", "43", "Austria"],
  ["AZ", "994", "Azerbaijan"],
  ["BS", "1242", "Bahamas"],
  ["BH", "973", "Bahrain"],
  ["BD", "880", "Bangladesh"],
  ["BB", "1246", "Barbados"],
  ["BY", "375", "Belarus"],
  ["BE", "32", "Belgium"],
  ["BZ", "501", "Belize"],
  ["BJ", "229", "Benin"],
  ["BT", "975", "Bhutan"],
  ["BO", "591", "Bolivia"],
  ["BA", "387", "Bosnia & Herzegovina"],
  ["BW", "267", "Botswana"],
  ["BR", "55", "Brazil"],
  ["BN", "673", "Brunei"],
  ["BG", "359", "Bulgaria"],
  ["BF", "226", "Burkina Faso"],
  ["BI", "257", "Burundi"],
  ["KH", "855", "Cambodia"],
  ["CM", "237", "Cameroon"],
  ["CA", "1", "Canada"],
  ["CV", "238", "Cape Verde"],
  ["CF", "236", "Central African Republic"],
  ["TD", "235", "Chad"],
  ["CL", "56", "Chile"],
  ["CN", "86", "China"],
  ["CO", "57", "Colombia"],
  ["KM", "269", "Comoros"],
  ["CG", "242", "Congo - Brazzaville"],
  ["CD", "243", "Congo - Kinshasa"],
  ["CR", "506", "Costa Rica"],
  ["CI", "225", "Côte d’Ivoire"],
  ["HR", "385", "Croatia"],
  ["CU", "53", "Cuba"],
  ["CY", "357", "Cyprus"],
  ["CZ", "420", "Czechia"],
  ["DK", "45", "Denmark"],
  ["DJ", "253", "Djibouti"],
  ["DM", "1767", "Dominica"],
  ["DO", "1809", "Dominican Republic"],
  ["EC", "593", "Ecuador"],
  ["EG", "20", "Egypt"],
  ["SV", "503", "El Salvador"],
  ["GQ", "240", "Equatorial Guinea"],
  ["ER", "291", "Eritrea"],
  ["EE", "372", "Estonia"],
  ["SZ", "268", "Eswatini"],
  ["ET", "251", "Ethiopia"],
  ["FJ", "679", "Fiji"],
  ["FI", "358", "Finland"],
  ["FR", "33", "France"],
  ["GA", "241", "Gabon"],
  ["GM", "220", "Gambia"],
  ["GE", "995", "Georgia"],
  ["DE", "49", "Germany"],
  ["GH", "233", "Ghana"],
  ["GR", "30", "Greece"],
  ["GD", "1473", "Grenada"],
  ["GT", "502", "Guatemala"],
  ["GN", "224", "Guinea"],
  ["GW", "245", "Guinea-Bissau"],
  ["GY", "592", "Guyana"],
  ["HT", "509", "Haiti"],
  ["HN", "504", "Honduras"],
  ["HK", "852", "Hong Kong SAR China"],
  ["HU", "36", "Hungary"],
  ["IS", "354", "Iceland"],
  ["IN", "91", "India"],
  ["ID", "62", "Indonesia"],
  ["IR", "98", "Iran"],
  ["IQ", "964", "Iraq"],
  ["IE", "353", "Ireland"],
  ["IL", "972", "Israel"],
  ["IT", "39", "Italy"],
  ["JM", "1876", "Jamaica"],
  ["JP", "81", "Japan"],
  ["JO", "962", "Jordan"],
  ["KZ", "7", "Kazakhstan"],
  ["KE", "254", "Kenya"],
  ["KI", "686", "Kiribati"],
  ["KW", "965", "Kuwait"],
  ["KG", "996", "Kyrgyzstan"],
  ["LA", "856", "Laos"],
  ["LV", "371", "Latvia"],
  ["LB", "961", "Lebanon"],
  ["LS", "266", "Lesotho"],
  ["LR", "231", "Liberia"],
  ["LY", "218", "Libya"],
  ["LI", "423", "Liechtenstein"],
  ["LT", "370", "Lithuania"],
  ["LU", "352", "Luxembourg"],
  ["MO", "853", "Macao SAR China"],
  ["MG", "261", "Madagascar"],
  ["MW", "265", "Malawi"],
  ["MY", "60", "Malaysia"],
  ["MV", "960", "Maldives"],
  ["ML", "223", "Mali"],
  ["MT", "356", "Malta"],
  ["MH", "692", "Marshall Islands"],
  ["MR", "222", "Mauritania"],
  ["MU", "230", "Mauritius"],
  ["MX", "52", "Mexico"],
  ["FM", "691", "Micronesia"],
  ["MD", "373", "Moldova"],
  ["MC", "377", "Monaco"],
  ["MN", "976", "Mongolia"],
  ["ME", "382", "Montenegro"],
  ["MA", "212", "Morocco"],
  ["MZ", "258", "Mozambique"],
  ["MM", "95", "Myanmar (Burma)"],
  ["NA", "264", "Namibia"],
  ["NR", "674", "Nauru"],
  ["NP", "977", "Nepal"],
  ["NL", "31", "Netherlands"],
  ["NZ", "64", "New Zealand"],
  ["NI", "505", "Nicaragua"],
  ["NE", "227", "Niger"],
  ["NG", "234", "Nigeria"],
  ["KP", "850", "North Korea"],
  ["MK", "389", "North Macedonia"],
  ["NO", "47", "Norway"],
  ["OM", "968", "Oman"],
  ["PK", "92", "Pakistan"],
  ["PW", "680", "Palau"],
  ["PS", "970", "Palestinian Territories"],
  ["PA", "507", "Panama"],
  ["PG", "675", "Papua New Guinea"],
  ["PY", "595", "Paraguay"],
  ["PE", "51", "Peru"],
  ["PH", "63", "Philippines"],
  ["PL", "48", "Poland"],
  ["PT", "351", "Portugal"],
  ["PR", "1787", "Puerto Rico"],
  ["QA", "974", "Qatar"],
  ["RO", "40", "Romania"],
  ["RU", "7", "Russia"],
  ["RW", "250", "Rwanda"],
  ["WS", "685", "Samoa"],
  ["SM", "378", "San Marino"],
  ["ST", "239", "São Tomé & Príncipe"],
  ["SA", "966", "Saudi Arabia"],
  ["SN", "221", "Senegal"],
  ["RS", "381", "Serbia"],
  ["SC", "248", "Seychelles"],
  ["SL", "232", "Sierra Leone"],
  ["SG", "65", "Singapore"],
  ["SK", "421", "Slovakia"],
  ["SI", "386", "Slovenia"],
  ["SB", "677", "Solomon Islands"],
  ["SO", "252", "Somalia"],
  ["ZA", "27", "South Africa"],
  ["KR", "82", "South Korea"],
  ["SS", "211", "South Sudan"],
  ["ES", "34", "Spain"],
  ["LK", "94", "Sri Lanka"],
  ["KN", "1869", "St. Kitts & Nevis"],
  ["LC", "1758", "St. Lucia"],
  ["VC", "1784", "St. Vincent & Grenadines"],
  ["SD", "249", "Sudan"],
  ["SR", "597", "Suriname"],
  ["SE", "46", "Sweden"],
  ["CH", "41", "Switzerland"],
  ["SY", "963", "Syria"],
  ["TW", "886", "Taiwan"],
  ["TJ", "992", "Tajikistan"],
  ["TZ", "255", "Tanzania"],
  ["TH", "66", "Thailand"],
  ["TL", "670", "Timor-Leste"],
  ["TG", "228", "Togo"],
  ["TO", "676", "Tonga"],
  ["TT", "1868", "Trinidad & Tobago"],
  ["TN", "216", "Tunisia"],
  ["TR", "90", "Türkiye"],
  ["TM", "993", "Turkmenistan"],
  ["TV", "688", "Tuvalu"],
  ["UG", "256", "Uganda"],
  ["UA", "380", "Ukraine"],
  ["AE", "971", "United Arab Emirates"],
  ["GB", "44", "United Kingdom"],
  ["US", "1", "United States"],
  ["UY", "598", "Uruguay"],
  ["UZ", "998", "Uzbekistan"],
  ["VU", "678", "Vanuatu"],
  ["VA", "379", "Vatican City"],
  ["VE", "58", "Venezuela"],
  ["VN", "84", "Vietnam"],
  ["YE", "967", "Yemen"],
  ["ZM", "260", "Zambia"],
  ["ZW", "263", "Zimbabwe"],
];

export interface Country {
  /** ISO 3166-1 alpha-2. The only form that is ever persisted. */
  code: string;
  /** International dialling prefix, digits only, no plus. */
  dial: string;
  english: string;
}

export const COUNTRIES: readonly Country[] = COUNTRY_ROWS.map(([code, dial, english]) => ({
  code,
  dial,
  english,
}));

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export const countryByCode = (code: string | null | undefined): Country | null =>
  (code ? BY_CODE.get(code.toUpperCase()) ?? null : null);

/**
 * Codes that own a dialling prefix they share.
 *
 * +1 is the whole North American plan, +7 is Russia and Kazakhstan, and a
 * number that carries no more specific area prefix has to resolve to one of
 * them. It resolves to the larger, which is a guess — and it is offered as the
 * first row of a list rather than written to the profile, so a Kazakh sender
 * taps their own country instead of being told what it is.
 */
const PRIMARY_FOR_DIAL: Readonly<Record<string, string>> = { "1": "US", "7": "RU" };

/**
 * The country a WhatsApp number most likely belongs to.
 *
 * Longest prefix wins, so +1268 is Antigua rather than the United States. Null
 * when nothing matches, which is not an error: the sender is asked, and asking
 * is the fallback the whole flow is built around.
 *
 * Never authoritative. This picks which row to put at the top of a list; the
 * sender picks the country.
 */
export function countryFromPhone(phone: string | null | undefined): Country | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;

  for (let length = 4; length >= 1; length--) {
    const prefix = digits.slice(0, length);
    const owner = PRIMARY_FOR_DIAL[prefix];
    if (owner && BY_CODE.has(owner)) {
      // Only when nothing longer matched, which the loop order guarantees.
      const longer = COUNTRIES.find((c) => c.dial.length > length && digits.startsWith(c.dial));
      if (!longer) return BY_CODE.get(owner)!;
    }
    const match = COUNTRIES.find((country) => country.dial === prefix);
    if (match) return match;
  }
  return null;
}

/**
 * A country's name in one language, from the runtime's own data.
 *
 * Falls back to English if the runtime has no display names — a build without
 * full ICU would otherwise return the bare code, and "JO" read aloud is two
 * letters rather than a country.
 */
export function countryName(country: Country, language: SupportedLanguage): string {
  try {
    const names = new Intl.DisplayNames([language], { type: "region", fallback: "none" });
    return names.of(country.code) ?? country.english;
  } catch {
    return country.english;
  }
}

/**
 * A country's name, short enough to be a row title.
 *
 * Meta allows 24 characters and rejects the message at 25 — and clipping is the
 * wrong answer here, because a clipped country is a country somebody hears cut
 * off and cannot identify. "Verenigde Arabische Emira…" is not a choice anybody
 * can make.
 *
 * So three attempts, longest first, and every one of them a real name: the full
 * localized name; the runtime's own short form, which is where German gets
 * "Palästina" instead of "Palästinensische Autonomiegebiete"; and finally the
 * English name, which fits every country there is. Only a runtime with no
 * display data at all reaches the clip.
 */
export function countryRowTitle(country: Country, language: SupportedLanguage, limit = 24): string {
  const candidates = [
    countryName(country, language),
    shortCountryName(country, language),
    country.english,
  ];
  for (const candidate of candidates) {
    if (candidate && [...candidate].length <= limit) return candidate;
  }
  return [...country.english].slice(0, limit).join("");
}

function shortCountryName(country: Country, language: SupportedLanguage): string | null {
  try {
    const names = new Intl.DisplayNames([language], {
      type: "region",
      style: "short",
      fallback: "none",
    });
    return names.of(country.code) ?? null;
  } catch {
    return null;
  }
}

/** Fold what does not change which country was named: case, accents, spacing. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The country a typed answer names, or null.
 *
 * Matched against the name in the sender's own language first, then English,
 * then the bare ISO code — so "Deutschland", "Germany" and "DE" all arrive at
 * the same row. A whole-answer match only: "I live in Germany with my sister"
 * is a sentence, and guessing a country out of a sentence is how somebody ends
 * up with the wrong one saved and no idea where it came from.
 */
export function parseCountry(text: string | null | undefined, language: SupportedLanguage): Country | null {
  const needle = fold(text ?? "");
  if (!needle || needle.length > 60) return null;

  if (needle.length === 2) {
    const byCode = BY_CODE.get(needle.toUpperCase());
    if (byCode) return byCode;
  }
  for (const country of COUNTRIES) {
    if (fold(countryName(country, language)) === needle) return country;
    if (fold(country.english) === needle) return country;
  }
  return null;
}

// ── The ids the interactive rows carry ───────────────────────────────────────

export const COUNTRY_ID_PREFIX = "country.";
/** The row that leaves the shortlist and asks the sender to type instead. */
export const COUNTRY_OTHER_ID = "country.other";

export const countryRowId = (code: string): string => `${COUNTRY_ID_PREFIX}${code.toLowerCase()}`;

/** The country a tapped row selected, or null for "another country" and for junk. */
export function parseCountrySelection(id: string | null | undefined): Country | null {
  if (!id || !id.startsWith(COUNTRY_ID_PREFIX) || id === COUNTRY_OTHER_ID) return null;
  return countryByCode(id.slice(COUNTRY_ID_PREFIX.length));
}

/**
 * The countries offered as rows, most likely first.
 *
 * The sender's own dialling prefix leads, because it is right far more often
 * than not and puts their answer one tap away. The rest of the shortlist is the
 * places Visionex actually serves, so the list is short enough to hear read out
 * — and the last row is always a way off the list entirely.
 */
export const SHORTLIST = ["JO", "PS", "SA", "AE", "EG", "TR", "US", "GB"] as const;

export function countryChoices(phone: string | null | undefined): Country[] {
  const chosen: Country[] = [];
  const add = (country: Country | null) => {
    if (country && !chosen.some((c) => c.code === country.code)) chosen.push(country);
  };
  add(countryFromPhone(phone));
  for (const code of SHORTLIST) add(countryByCode(code));
  // Nine, so the tenth row can be the way out of the list. Meta allows ten.
  return chosen.slice(0, 9);
}
