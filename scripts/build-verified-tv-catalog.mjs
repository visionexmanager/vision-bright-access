#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const SOURCE = "https://worldtvchannels.com/api/channels";
const OUTPUT = new URL("../supabase/migrations/20260811000000_verified_global_tv_refresh.sql", import.meta.url);
const COUNTRY_CAP = 7;
const CONCURRENCY = 16;
const TIMEOUT_MS = 12_000;

const countryNames = {
  AT: "النمسا", AU: "أستراليا", BE: "بلجيكا", CA: "كندا", CN: "الصين",
  CO: "كولومبيا", DZ: "الجزائر", ES: "إسبانيا", FR: "فرنسا", GR: "اليونان",
  HR: "كرواتيا", IN: "الهند", IT: "إيطاليا", JP: "اليابان", KR: "كوريا الجنوبية",
  MA: "المغرب", MO: "ماكاو", MY: "ماليزيا", NL: "هولندا", PL: "بولندا",
  PT: "البرتغال", QA: "قطر", SG: "سنغافورة", TH: "تايلاند", TR: "تركيا",
  UK: "المملكة المتحدة", US: "الولايات المتحدة",
};

const languages = {
  AT: "de", AU: "en", BE: "nl", CA: "en", CN: "zh", CO: "es", DZ: "ar",
  ES: "es", FR: "fr", GR: "el", HR: "hr", IN: "hi", IT: "it", JP: "ja",
  KR: "ko", MA: "ar", MO: "zh", MY: "ms", NL: "nl", PL: "pl", PT: "pt",
  QA: "ar", SG: "en", TH: "th", TR: "tr", UK: "en", US: "en",
};

function sql(value) {
  return value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
}

function stableUuid(key) {
  const hex = createHash("sha256").update(`visiontv:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function categorySlug(categories) {
  const value = categories.toLowerCase();
  if (value.includes("kids") || value.includes("animation")) return "kids";
  if (value.includes("documentary")) return "documentary";
  if (value.includes("education") || value.includes("science")) return "education";
  if (value.includes("culture")) return "culture";
  if (value.includes("entertainment")) return "entertainment";
  if (value.includes("sports")) return "sports";
  if (value.includes("business")) return "business";
  if (value.includes("news")) return "news";
  return "international";
}

function priority(channel) {
  const categories = channel.categories.toLowerCase();
  if (/kids|documentary|culture|education|science|sports|business/.test(categories)) return 0;
  if (categories.includes("news")) return 1;
  if (categories.includes("public")) return 2;
  return 3;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function loadCatalog() {
  if (process.env.TV_CATALOG_FILE) {
    return JSON.parse(await readFile(process.env.TV_CATALOG_FILE, "utf8"));
  }
  const first = await getJson(`${SOURCE}?page=1&limit=100`);
  const pages = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      getJson(`${SOURCE}?page=${index + 2}&limit=100`)
    )
  );
  return [first, ...pages].flatMap(page => page.items);
}

function selectBalanced(channels) {
  const eligible = channels
    .filter(channel =>
      channel.url.startsWith("https://") &&
      /\.m3u8(?:$|\?)/i.test(channel.url) &&
      !channel.categories.toLowerCase().includes("legislative")
    )
    .sort((a, b) =>
      a.countryCode.localeCompare(b.countryCode) ||
      priority(a) - priority(b) ||
      a.name.localeCompare(b.name)
    );

  const countryCounts = new Map();
  return eligible.filter(channel => {
    const count = countryCounts.get(channel.countryCode) ?? 0;
    if (count >= COUNTRY_CAP) return false;
    countryCounts.set(channel.countryCode, count + 1);
    return true;
  });
}

async function fetchManifest(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
      "User-Agent": "VisionexStreamValidator/2.0",
    },
  });
  const body = await response.text();
  if (!response.ok || !body.trimStart().startsWith("#EXTM3U")) {
    throw new Error(`HTTP ${response.status} or invalid manifest`);
  }
  const cors = response.headers.get("access-control-allow-origin");
  if (cors !== "*" && !cors?.includes("visionex")) {
    throw new Error("missing browser CORS");
  }
  return body;
}

async function validate(channel) {
  try {
    const manifest = await fetchManifest(channel.url);
    const lines = manifest.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const variant = lines.find((line, index) => lines[index - 1]?.startsWith("#EXT-X-STREAM-INF"));
    if (variant && !variant.startsWith("#")) {
      await fetchManifest(new URL(variant, channel.url).href);
    }
    return { ...channel, verified: true };
  } catch (error) {
    return { ...channel, verified: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function validateAll(channels) {
  const results = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < channels.length) {
      const index = cursor++;
      results[index] = await validate(channels[index]);
    }
  }));
  return results;
}

function buildMigration(channels) {
  const rows = channels.map((channel, index) => {
    const id = stableUuid(channel.id);
    return `  (${sql(id)}, ${sql(channel.name)}, ${sql(channel.name)}, ${sql(`بث عالمي مجاني ومباشر من ${countryNames[channel.countryCode] ?? channel.country}.`)}, ${sql(channel.logo || null)}, ${sql(channel.url)}, ${sql(channel.url)}, ${sql(categorySlug(channel.categories))}, 'HD', ${sql(languages[channel.countryCode] ?? "und")}, ${sql(countryNames[channel.countryCode] ?? channel.country)}, ${index < 12 ? "TRUE" : "FALSE"}, ${1000 + index})`;
  });

  const sourceRows = channels.map(channel => {
    const channelId = stableUuid(channel.id);
    return `  (${sql(stableUuid(`${channel.id}:primary`))}, ${sql(channelId)}, 'Verified official HLS', ${sql(channel.url)}, 'hls', 0, 100, TRUE, 0)`;
  });

  return `-- Verified global free-to-air TV refresh.
-- Generated from publicly available broadcaster streams and validated by
-- scripts/build-verified-tv-catalog.mjs on ${new Date().toISOString()}.

ALTER TABLE public.tv_stream_sources
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;

-- Plain HTTP video manifests are blocked as mixed content on the HTTPS app.
UPDATE public.tv_channels
SET is_active = FALSE
WHERE is_active = TRUE
  AND stream_url LIKE 'http://%';

UPDATE public.tv_stream_sources
SET is_active = FALSE
WHERE is_active = TRUE
  AND url LIKE 'http://%';

WITH catalog (
  id, name, name_ar, description_ar, logo_url, stream_url, official_url,
  category_slug, quality, language, country, is_featured, sort_order
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
  TRUE, catalog.is_featured, catalog.sort_order
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
  is_active = TRUE,
  is_featured = EXCLUDED.is_featured,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Ensure every legacy HLS channel participates in continuous health checks.
INSERT INTO public.tv_stream_sources (
  channel_id, label, url, type, priority, reliability, is_active, consecutive_failures
)
SELECT
  channel.id, 'Primary HLS', channel.stream_url, 'hls', 0, 100, TRUE, 0
FROM public.tv_channels channel
WHERE channel.is_active = TRUE
  AND channel.stream_url ~* '^https://.*\\.m3u8(?:\\?.*)?$'
  AND NOT EXISTS (
    SELECT 1
    FROM public.tv_stream_sources source
    WHERE source.channel_id = channel.id AND source.url = channel.stream_url
  );

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

-- Remove duplicate active sources while preserving the oldest source record.
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY channel_id, url ORDER BY created_at, id) AS row_number
  FROM public.tv_stream_sources
  WHERE is_active = TRUE
)
UPDATE public.tv_stream_sources source
SET is_active = FALSE
FROM duplicates
WHERE source.id = duplicates.id
  AND duplicates.row_number > 1;
`;
}

const catalog = await loadCatalog();
const excludedUrls = process.env.TV_EXCLUDE_FILE
  ? new Set((await readFile(process.env.TV_EXCLUDE_FILE, "utf8")).split(/\r?\n/).filter(Boolean))
  : new Set();
const selected = selectBalanced(catalog).filter(channel => !excludedUrls.has(channel.url));
const checked = process.env.TV_SKIP_VALIDATION === "1"
  ? selected.map(channel => ({ ...channel, verified: true }))
  : await validateAll(selected);
const verified = checked.filter(channel => channel.verified);
const failed = checked.filter(channel => !channel.verified);

if (verified.length < 60) {
  throw new Error(`Only ${verified.length} streams passed; refusing to generate a small catalog.`);
}

await writeFile(OUTPUT, buildMigration(verified), "utf8");
console.log(JSON.stringify({
  sourceCount: catalog.length,
  selectedCount: selected.length,
  verifiedCount: verified.length,
  failedCount: failed.length,
  countries: new Set(verified.map(channel => channel.countryCode)).size,
  categories: [...new Set(verified.map(channel => categorySlug(channel.categories)))].sort(),
  failed: failed.map(channel => ({ id: channel.id, reason: channel.error })),
}, null, 2));
