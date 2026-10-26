// Add GeoNames' per-language names to the local place index.
//
//   unzip -p alternateNamesV2.zip alternateNamesV2.txt | \
//     node scripts/datahub/load-geonames-alternates.mjs cities15000.txt
//
// cities15000.txt names the places that are indexed; its own alternate-names
// column is thin (it omits Damascus in Arabic, Seoul in Korean, Beijing in
// Chinese), so this reads the complete table from stdin and keeps the names
// written in one of the site's twenty languages. Reads SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. Prints counts only; this repository is public.

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { placeKey } from "../../supabase/functions/_shared/placeKey.ts";

// The twenty locale files under src/i18n.
const LANGUAGES = new Set([
  "ar", "bn", "de", "en", "es", "fa", "fr", "hi", "id", "it",
  "ja", "ko", "nl", "pl", "pt", "ru", "tr", "ur", "vi", "zh",
]);
const MAX_NEW_KEYS_PER_PLACE = 150;

const cities = process.argv[2];
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!cities || !base || !key) {
  console.error("usage: <alternateNamesV2 on stdin> | load-geonames-alternates.mjs <cities15000.txt>");
  process.exit(1);
}

const indexed = new Set();
for (const line of readFileSync(cities, "utf8").split("\n")) {
  const id = Number(line.split("\t", 1)[0]);
  if (Number.isFinite(id) && line.trim()) indexed.add(id);
}

const perPlace = new Map();
const rows = [];
let considered = 0;

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const c = line.split("\t");
  // 0 id, 1 geonameid, 2 isolanguage, 3 name, 4 preferred, 5 short, 6 colloquial, 7 historic
  const placeId = Number(c[1]);
  if (!indexed.has(placeId)) continue;
  const language = (c[2] ?? "").split("-")[0].toLowerCase();
  if (!LANGUAGES.has(language) || c[7] === "1") continue;
  considered += 1;

  const k = placeKey(c[3] ?? "");
  if (!k) continue;
  const seen = perPlace.get(placeId) ?? new Set();
  if (seen.has(k) || seen.size >= MAX_NEW_KEYS_PER_PLACE) continue;
  seen.add(k);
  perPlace.set(placeId, seen);
  rows.push({ place_id: placeId, name_key: k });
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "resolution=ignore-duplicates,return=minimal",
};
const url = `${base}/rest/v1/geo_place_names?on_conflict=place_id,name_key`;
for (let i = 0; i < rows.length; i += 1000) {
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(rows.slice(i, i + 1000)) });
  if (!res.ok) {
    console.error(`batch at ${i} failed with HTTP ${res.status}`);
    process.exit(1);
  }
}
console.log(`read ${considered} names in the site's languages; sent ${rows.length} keys for ${perPlace.size} places`);
