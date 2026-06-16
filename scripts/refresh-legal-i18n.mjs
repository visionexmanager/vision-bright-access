import fs from "node:fs";
import path from "node:path";

const i18nDir = path.join(process.cwd(), "src", "i18n");
const languages = {
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

const legalKeyPattern =
  /^(legal(\.|Center)|footer\.legal$|footer\.link\.(privacyPolicy|termsOfUse|communityGuidelines|marketplacePolicy|accessibility|legalDisclaimer|legalCenter|buyerProtection|vxCoinsPolicy|intellectualProperty|aiPolicy|enforcementAppeals)$)/;

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
  const lines = entries.map(
    ({ key, value }) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`,
  );
  return `export const translations: Record<string, string> = {\n${lines.join("\n")}\n};\n\nexport default translations;\n`;
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
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
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

const { entries: englishEntries } = parseFile("en");
const englishLegal = new Map(
  englishEntries
    .filter(({ key }) => legalKeyPattern.test(key))
    .map(({ key, value }) => [key, value]),
);

console.log(`Refreshing ${englishLegal.size} legal keys per language.`);

for (const [lang, target] of Object.entries(languages)) {
  const parsed = parseFile(lang);
  const indexByKey = new Map(parsed.entries.map((entry, index) => [entry.key, index]));
  const keys = [...englishLegal.keys()];

  console.log(`\n${lang}: translating ${keys.length} keys...`);
  const translated = await mapLimit(keys, 8, async (key) => {
    const value = englishLegal.get(key);
    return [key, await translate(value, target)];
  });

  for (const [key, value] of translated) {
    const index = indexByKey.get(key);
    if (index == null) {
      parsed.entries.push({ key, value });
    } else {
      parsed.entries[index].value = value;
    }
  }

  fs.writeFileSync(parsed.file, serialize(parsed.entries), "utf8");
  console.log(`${lang}: done`);
}
