#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const streamsFile = process.env.IPTV_STREAMS_FILE ?? "/tmp/iptv_streams.json";
const channelsFile = process.env.IPTV_CHANNELS_FILE ?? "/tmp/iptv_channels.json";
const logosFile = process.env.IPTV_LOGOS_FILE ?? "/tmp/iptv_logos.json";
const verifiedFile = process.env.VERIFIED_URLS_FILE;
const output = new URL("../supabase/migrations/20260812000000_world_tv_expansion.sql", import.meta.url);

const countryNames = new Intl.DisplayNames(["ar"], { type: "region" });
const countryCap = 2;
const validationConcurrency = 6;
const validationTimeoutMs = 8_000;

function sql(value) {
  return value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
}

function stableUuid(key) {
  const hex = createHash("sha256").update(`visiontv:world:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function categorySlug(categories) {
  const values = categories.map(value => value.toLowerCase());
  if (values.some(value => ["kids", "animation"].includes(value))) return "kids";
  if (values.includes("documentary")) return "documentary";
  if (values.some(value => ["education", "science"].includes(value))) return "education";
  if (values.some(value => ["culture", "art"].includes(value))) return "culture";
  if (values.includes("music")) return "music";
  if (values.includes("sports")) return "sports";
  if (values.includes("business")) return "business";
  if (values.some(value => ["movies", "series", "entertainment", "comedy"].includes(value))) return "entertainment";
  if (values.includes("news")) return "news";
  if (values.includes("religious")) return "religious";
  return "international";
}

function categoryPriority(channel) {
  const slug = categorySlug(channel.categories);
  const order = ["kids", "documentary", "education", "culture", "music", "sports", "business", "entertainment", "news", "international", "religious"];
  return order.indexOf(slug);
}

const [streams, channels, logos] = await Promise.all(
  [streamsFile, channelsFile, logosFile].map(async file => JSON.parse(await readFile(file, "utf8")))
);

const channelById = new Map(channels.map(channel => [channel.id, channel]));
const logoByChannel = new Map(
  logos.filter(logo => logo.in_use).map(logo => [logo.channel, logo.url])
);

const candidates = streams
  .filter(stream =>
    stream.channel &&
    stream.url.startsWith("https://") &&
    /\.m3u8(?:$|\?)/i.test(stream.url) &&
    !stream.user_agent &&
    !stream.referrer &&
    !stream.label
  )
  .map(stream => ({ ...stream, meta: channelById.get(stream.channel) }))
  .filter(item =>
    item.meta &&
    !item.meta.is_nsfw &&
    !item.meta.closed &&
    item.meta.country &&
    !item.meta.categories.includes("legislative")
  )
  .sort((a, b) =>
    a.meta.country.localeCompare(b.meta.country) ||
    categoryPriority(a.meta) - categoryPriority(b.meta) ||
    (Number.parseInt(b.quality) || 0) - (Number.parseInt(a.quality) || 0) ||
    a.meta.name.localeCompare(b.meta.name)
  );

const selected = [];
const countryCounts = new Map();
const seenChannels = new Set();
for (const item of candidates) {
  const country = item.meta.country;
  if ((countryCounts.get(country) ?? 0) >= countryCap || seenChannels.has(item.channel)) continue;
  selected.push(item);
  seenChannels.add(item.channel);
  countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
}

async function isValidManifest(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(validationTimeoutMs),
      headers: {
        Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
        "User-Agent": "VisionexStreamValidator/2.0",
      },
    });
    if (!response.ok || !response.body) return false;
    const reader = response.body.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    const prefix = new TextDecoder().decode(value ?? new Uint8Array()).trimStart();
    return prefix.startsWith("#EXTM3U");
  } catch {
    return false;
  }
}

async function validateCandidates(items) {
  const passed = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: validationConcurrency }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      if (await isValidManifest(item.url)) passed.push(item.url);
    }
  }));
  return passed;
}

if (!verifiedFile) {
  const candidateOutput = "/tmp/world_tv_candidates.tsv";
  await writeFile(
    candidateOutput,
    selected.map(item => [item.channel, item.meta.country, categorySlug(item.meta.categories), item.url].join("\t")).join("\n") + "\n",
    "utf8"
  );
  let verifiedOutput = null;
  let verifiedCount = null;
  if (process.env.VALIDATE_CANDIDATES === "1") {
    const offset = Number.parseInt(process.env.VALIDATION_OFFSET ?? "0", 10);
    const limit = Number.parseInt(process.env.VALIDATION_LIMIT ?? String(selected.length), 10);
    verifiedOutput = process.env.VERIFIED_OUTPUT ?? "/tmp/world_tv_verified_urls.txt";
    const passed = await validateCandidates(selected.slice(offset, offset + limit));
    await writeFile(verifiedOutput, passed.join("\n") + "\n", "utf8");
    verifiedCount = passed.length;
  }
  console.log(JSON.stringify({
    candidateOutput,
    candidates: selected.length,
    countries: countryCounts.size,
    verifiedOutput,
    verifiedCount,
  }, null, 2));
  process.exit(0);
}

const verifiedUrls = new Set(
  (await readFile(verifiedFile, "utf8")).split(/\r?\n/).filter(Boolean)
);
const verified = selected.filter(item => verifiedUrls.has(item.url));

if (verified.length < 100) {
  throw new Error(`Only ${verified.length} verified streams; refusing to generate the expansion.`);
}

const rows = verified.map((item, index) => {
  const channel = item.meta;
  const id = stableUuid(channel.id);
  const qualityHeight = Number.parseInt(item.quality) || 0;
  const quality = qualityHeight >= 1080 ? "FHD" : qualityHeight >= 720 ? "HD" : "SD";
  const countryAr = countryNames.of(channel.country) ?? channel.country;
  const language = channel.country === "US" || channel.country === "UK" ? "en" : "und";
  return `  (${sql(id)}, ${sql(channel.name)}, ${sql(channel.name)}, ${sql(`قناة مجانية مباشرة من ${countryAr}.`)}, ${sql(logoByChannel.get(channel.id) ?? null)}, ${sql(item.url)}, ${sql(item.url)}, ${sql(categorySlug(channel.categories))}, ${sql(quality)}, ${sql(language)}, ${sql(countryAr)}, ${2000 + index})`;
});

const sourceRows = verified.map(item => {
  const channelId = stableUuid(item.meta.id);
  return `  (${sql(stableUuid(`${item.meta.id}:primary`))}, ${sql(channelId)}, 'World HLS candidate', ${sql(item.url)}, 'hls', 0, 50, TRUE, 0)`;
});

const migration = `-- Second-stage VisionTV world expansion.
-- Sources enter as pending/inactive channels. The production health checker
-- publishes a channel only after its HLS manifest succeeds from production.

WITH catalog (
  id, name, name_ar, description_ar, logo_url, stream_url, official_url,
  category_slug, quality, language, country, sort_order
) AS (
VALUES
${rows.join(",\n")}
)
INSERT INTO public.tv_channels (
  id, name, name_ar, description_ar, logo_url, stream_url, official_url,
  category_id, quality, language, country, is_active, is_featured, sort_order
)
SELECT
  catalog.id::UUID, catalog.name, catalog.name_ar, catalog.description_ar,
  catalog.logo_url, catalog.stream_url, catalog.official_url,
  categories.id, catalog.quality, catalog.language, catalog.country,
  FALSE, FALSE, catalog.sort_order
FROM catalog
LEFT JOIN public.tv_categories categories ON categories.slug = catalog.category_slug
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar,
  logo_url = EXCLUDED.logo_url,
  stream_url = EXCLUDED.stream_url,
  official_url = EXCLUDED.official_url,
  category_id = EXCLUDED.category_id,
  quality = EXCLUDED.quality,
  language = EXCLUDED.language,
  country = EXCLUDED.country,
  is_active = FALSE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO public.tv_stream_sources (
  id, channel_id, label, url, type, priority, reliability, is_active, consecutive_failures
)
VALUES
${sourceRows.join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  channel_id = EXCLUDED.channel_id,
  label = EXCLUDED.label,
  url = EXCLUDED.url,
  reliability = 100,
  last_checked_at = NULL,
  is_active = TRUE,
  consecutive_failures = 0,
  updated_at = NOW();
`;

await writeFile(output, migration, "utf8");
console.log(JSON.stringify({
  verified: verified.length,
  countries: new Set(verified.map(item => item.meta.country)).size,
  categories: [...new Set(verified.map(item => categorySlug(item.meta.categories)))].sort(),
  output: output.pathname,
}, null, 2));
