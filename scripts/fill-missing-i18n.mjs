import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const i18nDir = path.resolve("src/i18n");
const langs = ["en", "ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"];
const translateTargets = {
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

const extraEnglish = {
  "contact.fileTypeUnsupported": "Unsupported file type. Please upload an image, PDF, Word document, or text file.",
  "contact.fileTooLarge": "File is too large. Maximum size is {size}.",
  "contact.whatsapp": "WhatsApp",
  "contact.attachment": "Attachment",
  "contact.removeFile": "Remove file",
  "contact.attachmentHint": "Optional: attach a screenshot, document, or supporting file.",
  "laptoptech.score": "Score",
  "news.featured": "Featured",
  "news.empty": "No news articles available right now.",
  "msg.sendToUser": "Send message to user",
  "msg.noResults": "No users found",
  "msg.send": "Send",
  "profile.requestsTitle": "Service Requests",
  "profile.requestsEmpty": "No service requests yet.",
  "profile.requestStatus": "Status",
  "settings.subtitle": "Manage your account, preferences, and accessibility settings.",
  "sharedTrip.aiTitle": "AI Trip Assistant",
  "sharedTrip.aiDesc": "Get route ideas, accessibility notes, and sharing suggestions for this trip.",
  "auth.passWeak": "Weak password",
  "auth.passFair": "Fair password",
  "auth.passStrong": "Strong password",
  "auth.emailRequired": "Email is required",
  "sim.glazing.stage.applySealant": "Applying sealant...",
  "sim.glazing.report.revenue": "Revenue",
  "sim.glazing.report.costs": "Costs",
  "sim.glazing.report.satisfaction": "Satisfaction",
  "sim.glazing.report.score": "Score",
  "sim.glazing.report.playAgain": "Play Again",
  "sim.glazing.costBreakdown.yourQuote": "Your quote",
  "sim.glazing.costBreakdown.customerBudget": "Customer budget",
  "sim.dairyfarm.market": "Market",
  "sim.dairyfarm.history.title": "Production History",
  "sim.common.correct": "Correct",
  "sim.detergent.label.revenue": "Revenue",
  "sim.detergent.label.cost": "Cost",
  "sim.logistics.stage.inTransit": "In transit...",
};

function walk(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", "dist"].includes(entry.name)) entries.push(...walk(fullPath));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      entries.push(fullPath);
    }
  }
  return entries;
}

function isVisibleEnglishText(text) {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value || value.length > 180) return false;
  if (!/[A-Za-z]{3}/.test(value)) return false;
  if (/https?:|www\.|@|\\|\/\//i.test(value)) return false;
  if (/^[A-Z0-9_ -]+$/.test(value) && /_/.test(value)) return false;
  if (/^[\w.-]+@[\w.-]+$/.test(value)) return false;
  if (/^[\d\s+–—-]+(pts?|min|kbps|kwh|vx)?$/i.test(value)) return false;
  return true;
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function collectDomEnglishText(existingEnglish) {
  const texts = new Set();
  const existingValues = new Set(Object.values(existingEnglish));
  for (const file of walk("src")) {
    if (!/\.tsx$/.test(file) || file.includes(`${path.sep}components${path.sep}ui${path.sep}`)) continue;
    const source = read(file);
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const add = (text) => {
      const value = text.replace(/\s+/g, " ").trim();
      if (isVisibleEnglishText(value) && !existingValues.has(value)) texts.add(value);
    };
    const visit = (node) => {
      if (ts.isJsxText(node)) add(node.getText(sourceFile));
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const attr = node.name.getText(sourceFile);
        if (["placeholder", "title", "aria-label", "alt", "aria-description"].includes(attr)) {
          add(node.initializer.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return Object.fromEntries(
    [...texts].sort((a, b) => a.localeCompare(b)).map((text) => [`dom.${hashText(text)}`, text])
  );
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function parseI18n(source) {
  const out = {};
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1\s*:\s*(["'`])((?:\\.|(?!\3)[^\\])*?)\3\s*,?/g;
  let match;
  while ((match = re.exec(source))) {
    out[unescapeJs(match[2])] = unescapeJs(match[4]);
  }
  return out;
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

function quote(value) {
  return JSON.stringify(value);
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
  if (!text.trim()) return text;
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
        console.warn(`[i18n] Translation failed for "${text}" -> ${target}: ${error.message}`);
        return text;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  return text;
}

function insertEntries(source, entries) {
  if (entries.length === 0) return source;
  const block = [
    "",
    "  // Auto-filled missing translations",
    ...entries.map(([key, value]) => `  ${quote(key)}: ${quote(value)},`),
  ].join("\n");
  return source.replace(/\n};\s*\n\s*export default \w+;\s*$/s, `${block}\n};\n\nexport default ${source.match(/export default (\w+);/)?.[1] ?? "translations"};\n`);
}

async function main() {
  const sources = Object.fromEntries(langs.map((lang) => [lang, read(path.join(i18nDir, `${lang}.ts`))]));
  const dicts = Object.fromEntries(langs.map((lang) => [lang, parseI18n(sources[lang])]));
  Object.assign(extraEnglish, collectDomEnglishText(dicts.en));

  const enMissing = Object.entries(extraEnglish).filter(([key]) => !(key in dicts.en));
  if (enMissing.length > 0) {
    const enPath = path.join(i18nDir, "en.ts");
    fs.writeFileSync(enPath, insertEntries(sources.en, enMissing), "utf8");
    sources.en = read(enPath);
    dicts.en = parseI18n(sources.en);
    console.log(`[i18n] Added ${enMissing.length} English base keys`);
  }

  const enKeys = Object.keys(dicts.en);
  for (const lang of langs.filter((lang) => lang !== "en")) {
    const missing = enKeys.filter((key) => !(key in dicts[lang]));
    if (missing.length === 0) {
      console.log(`[i18n] ${lang}: no missing keys`);
      continue;
    }

    console.log(`[i18n] ${lang}: translating ${missing.length} keys`);
    const entries = [];
    const concurrency = 12;
    for (let i = 0; i < missing.length; i += concurrency) {
      const chunk = missing.slice(i, i + concurrency);
      const translatedChunk = await Promise.all(
        chunk.map(async (key) => [key, await translate(dicts.en[key], translateTargets[lang])])
      );
      entries.push(...translatedChunk);
      if ((i + chunk.length) % 120 === 0 || i + chunk.length === missing.length) {
        console.log(`[i18n] ${lang}: ${i + chunk.length}/${missing.length}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    const file = path.join(i18nDir, `${lang}.ts`);
    fs.writeFileSync(file, insertEntries(sources[lang], entries), "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
