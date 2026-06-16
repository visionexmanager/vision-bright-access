import fs from "node:fs";
import path from "node:path";

const i18nDir = path.resolve("src/i18n");
const langs = ["ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"];
const targets = {
  ar: "ar",
  es: "es",
  de: "de",
  pt: "pt",
  zh: "zh-CN",
  tr: "tr",
  fr: "fr",
  ru: "ru",
  ur: "ur",
  hi: "hi",
};

const keepValues = new Set([
  "Visionex",
  "VisionEx",
  "VXBazaar",
  "VisionTV",
  "VisionRadio",
  "Akinator",
  "UNO",
  "Briscola",
  "FARKLE",
  "AI",
  "VX",
  "VIP",
  "SEO",
  "ARIA",
  "WCAG",
  "NVDA",
  "JAWS",
  "VoiceOver",
  "YouTube",
  "Supabase",
  "OpenAI",
  "AdSense",
  "LiveKit",
  "Stripe",
  "Google",
  "Apple",
  "Facebook",
  "Twitter",
  "WhatsApp",
  "Instagram",
  "TikTok",
]);

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function parseI18n(source) {
  const entries = new Map();
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1\s*:\s*(["'`])((?:\\.|(?!\3)[^\\])*?)\3\s*,?/g;
  let match;
  while ((match = re.exec(source))) {
    entries.set(unescapeJs(match[2]), {
      key: unescapeJs(match[2]),
      value: unescapeJs(match[4]),
      start: match.index,
      end: re.lastIndex,
      raw: match[0],
    });
  }
  return entries;
}

function unescapeJs(value) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}

function norm(value) {
  return value
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\ufe0f]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldTranslate(key, englishValue) {
  const value = norm(englishValue);
  if (!value || !/[A-Za-z]{3}/.test(value)) return false;
  if (keepValues.has(value)) return false;
  if (/^(https?:|www\.|mailto:)/i.test(value)) return false;
  if (/^[A-Z0-9_ .&+/-]{2,}$/.test(value) && !/[a-z]/.test(value)) return false;
  if (/^[\w.-]+@[\w.-]+$/.test(value)) return false;
  if (/^[\d\s+–—-]+(pts?|min|kbps|kwh|vx)?$/i.test(value)) return false;
  if (/^akinator\.char\./.test(key)) return false;
  if (/^legal\.privacy\.third\..*\.name$/.test(key)) return false;
  if (/^aptitude\.(twitter|facebook|whatsapp)$/.test(key)) return false;
  return true;
}

function protectPlaceholders(value) {
  const placeholders = [];
  const protectedText = value.replace(/\{[^}]+\}/g, (token) => {
    const marker = `__PH_${placeholders.length}__`;
    placeholders.push([marker, token]);
    return marker;
  });
  return { protectedText, placeholders };
}

function restorePlaceholders(value, placeholders) {
  let restored = value;
  for (const [marker, token] of placeholders) {
    restored = restored.replaceAll(marker, token);
    restored = restored.replaceAll(marker.toLowerCase(), token);
    restored = restored.replaceAll(marker.replaceAll("_", " "), token);
  }
  return restored;
}

async function translate(text, target) {
  const { protectedText, placeholders } = protectPlaceholders(text);
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", protectedText);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const translated = data?.[0]?.map((part) => part?.[0] ?? "").join("") ?? text;
      return restorePlaceholders(translated, placeholders);
    } catch (error) {
      if (attempt === 4) {
        console.warn(`[i18n] Failed ${target}: ${text} (${error.message})`);
        return text;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  return text;
}

function replaceEntries(source, replacements) {
  const sorted = [...replacements].sort((a, b) => b.entry.start - a.entry.start);
  let next = source;
  for (const { entry, value } of sorted) {
    const line = entry.raw.replace(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1\s*:\s*(["'`])((?:\\.|(?!\3)[^\\])*?)\3/, `${JSON.stringify(entry.key)}: ${JSON.stringify(value)}`);
    next = next.slice(0, entry.start) + line + next.slice(entry.end);
  }
  return next;
}

async function main() {
  const en = parseI18n(read(path.join(i18nDir, "en.ts")));

  for (const lang of langs) {
    const file = path.join(i18nDir, `${lang}.ts`);
    const source = read(file);
    const dict = parseI18n(source);
    const candidates = [];

    for (const [key, enEntry] of en.entries()) {
      const entry = dict.get(key);
      if (!entry) continue;
      if (norm(entry.value) !== norm(enEntry.value)) continue;
      if (!shouldTranslate(key, enEntry.value)) continue;
      candidates.push({ entry, englishValue: enEntry.value });
    }

    console.log(`[i18n] ${lang}: ${candidates.length} English leftovers`);
    const replacements = [];
    const concurrency = 12;
    for (let i = 0; i < candidates.length; i += concurrency) {
      const chunk = candidates.slice(i, i + concurrency);
      const translated = await Promise.all(
        chunk.map(async ({ entry, englishValue }) => ({
          entry,
          value: await translate(englishValue, targets[lang]),
        }))
      );
      replacements.push(...translated);
      if ((i + chunk.length) % 120 === 0 || i + chunk.length === candidates.length) {
        console.log(`[i18n] ${lang}: ${i + chunk.length}/${candidates.length}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    if (replacements.length) fs.writeFileSync(file, replaceEntries(source, replacements), "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
