import fs from "node:fs";
import path from "node:path";

const i18nDir = path.join(process.cwd(), "src", "i18n");
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

function parseFile(lang) {
  const file = path.join(i18nDir, `${lang}.ts`);
  const text = fs.readFileSync(file, "utf8");
  const entries = [];
  const re = /"((?:\\.|[^"\\])+)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = re.exec(text))) {
    entries.push({
      key: JSON.parse(`"${match[1]}"`),
      value: JSON.parse(`"${match[2]}"`),
    });
  }
  return { file, entries };
}

function serialize(entries) {
  return `export const translations: Record<string, string> = {\n${entries
    .map(({ key, value }) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n")}\n};\n\nexport default translations;\n`;
}

function isProbablyCorrupt(value, englishValue) {
  if (!value) return false;
  if (value.includes("\uFFFD")) return true;
  if (/\?{2,}/.test(value)) return true;
  if (/(?:â€¦|â€”|â€“|â€˜|â€™|â€œ|â€|Â |Ã[^\s]|Ø[^\s]|Ù[^\s]|Ð[^\s]|Ñ[^\s])/.test(value)) return true;

  // Accented letters lost as question marks, e.g. "Navega??o" or "R?seau".
  if (/[A-Za-zÀ-ÿ]\?[A-Za-zÀ-ÿ]/.test(value)) return true;

  // If English is not a question but the translation contains stray question
  // marks inside prose, it is usually a failed encoding/translation artifact.
  if (!englishValue?.includes("?") && /[^\s]\?[^\s]?/.test(value)) return true;

  return false;
}

async function translate(text, target) {
  if (!text || /^[\s\d.,:;!?()[\]{}'"“”‘’/\\@+_-]+$/.test(text)) return text;

  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
    encodeURIComponent(target) +
    "&dt=t&q=" +
    encodeURIComponent(text);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data[0].map((part) => part[0]).join("");
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await mapper(items[index], index);
      }
    }),
  );
  return results;
}

const english = new Map(parseFile("en").entries.map(({ key, value }) => [key, value]));

for (const [lang, target] of Object.entries(targets)) {
  const parsed = parseFile(lang);
  const corrupt = parsed.entries.filter(({ key, value }) => {
    const englishValue = english.get(key);
    return englishValue && isProbablyCorrupt(value, englishValue);
  });

  console.log(`${lang}: ${corrupt.length} corrupt-looking values`);
  if (corrupt.length === 0) continue;

  const translated = await mapLimit(corrupt, 8, async ({ key }) => [
    key,
    await translate(english.get(key), target),
  ]);
  const replacementByKey = new Map(translated);
  for (const entry of parsed.entries) {
    if (replacementByKey.has(entry.key)) entry.value = replacementByKey.get(entry.key);
  }

  fs.writeFileSync(parsed.file, serialize(parsed.entries), "utf8");
}
