// Fill the local place index from GeoNames cities15000.txt.
//
//   node scripts/datahub/load-geonames.mjs <path to cities15000.txt>
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment. It
// prints counts only: this repository is public and its CI logs are readable.
// It replaces the index in full, in batches, so a rerun is safe.

import { readFileSync } from "node:fs";
import { placeKey } from "../../supabase/functions/_shared/placeKey.ts";

const file = process.argv[2];
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!file || !base || !key) {
  console.error("usage: load-geonames.mjs <cities15000.txt>  (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set)");
  process.exit(1);
}

const MAX_NAMES_PER_PLACE = 60;
const places = [];
const names = [];

for (const line of readFileSync(file, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const c = line.split("\t");
  const id = Number(c[0]);
  const latitude = Number(c[4]);
  const longitude = Number(c[5]);
  if (!Number.isFinite(id) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

  places.push({
    id,
    name: c[1],
    country_code: c[8] || null,
    latitude,
    longitude,
    population: Number(c[14]) || null,
    timezone: c[17] || null,
  });

  const keys = new Set();
  for (const candidate of [c[1], c[2], ...(c[3] ?? "").split(",")]) {
    const k = placeKey(candidate ?? "");
    if (k) keys.add(k);
    if (keys.size >= MAX_NAMES_PER_PLACE) break;
  }
  for (const k of keys) names.push({ place_id: id, name_key: k });
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=minimal",
};

async function send(table, rows, onConflict) {
  const url = `${base}/rest/v1/${table}?on_conflict=${onConflict}`;
  for (let i = 0; i < rows.length; i += 1000) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(rows.slice(i, i + 1000)) });
    if (!res.ok) {
      console.error(`${table}: batch at ${i} failed with HTTP ${res.status}`);
      process.exit(1);
    }
  }
}

await send("geo_places", places, "id");
await send("geo_place_names", names, "place_id,name_key");
console.log(`loaded ${places.length} places and ${names.length} name keys`);
