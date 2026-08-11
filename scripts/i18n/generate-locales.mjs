import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "src/i18n/en.ts");
const REQUEST_PATH = path.join(ROOT, ".github/i18n-translation-request.json");
const STATE_PATH = path.join(ROOT, ".i18n/batch-state.json");
const REPORT_PATH = path.join(ROOT, ".i18n/translation-report.json");
const OPENAI_BASE = "https://api.openai.com/v1";
const CHUNK_SIZE = 100;
const LOCALE_NAMES = {
  id: "Indonesian (Bahasa Indonesia)",
  ja: "Japanese",
  it: "Italian",
  ko: "Korean",
  nl: "Dutch (Nederlands)",
  pl: "Polish (Polski)",
  vi: "Vietnamese (Tiếng Việt)",
  bn: "Bengali (বাংলা)",
  fa: "Persian (فارسی)",
};

function readDictionary(filePath) {
  const entries = [];
  const source = fs.readFileSync(filePath, "utf8");
  for (const line of source.split("\n")) {
    const match = line.match(/^\s{2}("(?:[^"\\]|\\.)+"):\s*("(?:[^"\\]|\\.)*"),?$/);
    if (!match) continue;
    entries.push([JSON.parse(match[1]), JSON.parse(match[2])]);
  }
  if (entries.length < 12_000) {
    throw new Error(`Parsed only ${entries.length} source translations; expected at least 12,000.`);
  }
  return entries;
}

function placeholders(value) {
  return [...value.matchAll(/\{[^{}]+\}|%[sdif]|\$\{[^{}]+\}/g)].map((match) => match[0]).sort();
}

function repairAndAssertPlaceholders(source, translated, id) {
  const before = placeholders(source);
  const after = placeholders(translated);

  // Every source placeholder is mandatory. If a model omits one, append it so
  // runtime interpolation remains intact. Completeness is more important than
  // perfect word order in the rare repaired string.
  const unmatchedAfter = [...after];
  const missing = [];
  for (const token of before) {
    const index = unmatchedAfter.indexOf(token);
    if (index === -1) {
      missing.push(token);
      continue;
    }
    unmatchedAfter.splice(index, 1);
  }

  // Models occasionally invent a count placeholder for a fragment rendered
  // beside an existing number (for example "day remaining" -> "{n} hari
  // tersisa"). Such extras are unsafe, but can be removed deterministically
  // without changing any placeholder that exists in the source.
  let repaired = translated;
  for (const token of unmatchedAfter) repaired = repaired.replace(token, "");
  if (missing.length) repaired = `${repaired} ${missing.join(" ")}`;
  repaired = repaired.replace(/\s{2,}/g, " ").trim();

  const repairedPlaceholders = placeholders(repaired);
  if (JSON.stringify(before) !== JSON.stringify(repairedPlaceholders)) {
    throw new Error(`Unrepairable placeholder mismatch for ${id}: ${JSON.stringify(before)} -> ${JSON.stringify(repairedPlaceholders)}`);
  }
  if (unmatchedAfter.length) console.warn(`Removed ${unmatchedAfter.length} invented placeholder(s) from ${id}.`);
  if (missing.length) console.warn(`Restored ${missing.length} missing placeholder(s) in ${id}.`);
  return repaired;
}

function translationIndex(groupIndex, rawId, expectedCount, customId) {
  const idText = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : "";
  if (!/^\d+$/.test(idText)) {
    console.warn(`Ignored malformed translation item in ${customId}: missing or invalid id.`);
    return null;
  }

  const absoluteIndex = Number(idText);
  const expectedGroup = Math.floor(absoluteIndex / CHUNK_SIZE);
  if (!Number.isSafeInteger(absoluteIndex) || absoluteIndex >= expectedCount || expectedGroup !== groupIndex) {
    console.warn(`Ignored out-of-range translation item in ${customId}: ${idText}.`);
    return null;
  }
  return absoluteIndex;
}

function requestConfig() {
  const requestFile = fs.existsSync(REQUEST_PATH)
    ? REQUEST_PATH
    : path.join(ROOT, ".github/i18n-translation-request.example.json");
  const request = JSON.parse(fs.readFileSync(requestFile, "utf8"));
  const locales = [...new Set(request.locales ?? [])];
  for (const locale of locales) {
    if (!LOCALE_NAMES[locale]) throw new Error(`Unsupported requested locale: ${locale}`);
  }
  if (locales.length === 0) throw new Error("No locales requested.");
  return { locales, model: request.model || "gpt-5.4-nano" };
}

function sourceHash() {
  return crypto.createHash("sha256").update(fs.readFileSync(SOURCE_PATH)).digest("hex");
}

function uniqueSourceValues(entries) {
  return [...new Set(entries.map(([, value]) => value))];
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function localizationMessages(locale, items) {
  return [
    {
      role: "system",
      content: [
        `You are the production localization engine for Visionex. Translate every provided UI string into ${LOCALE_NAMES[locale]}.`,
        "Return JSON only in the exact form {\"translations\":[{\"id\":\"...\",\"text\":\"...\"}] }.",
        "Preserve every placeholder such as {name}, ${value}, and %s exactly. Preserve URLs, HTML tags, Markdown syntax, VX, and the Visionex brand.",
        "Use natural, concise product UI language. Translate complete meanings, never isolated word substitutions. Do not omit, reorder, merge, or add items.",
      ].join(" "),
    },
    { role: "user", content: JSON.stringify({ translations: items }) },
  ];
}

function buildRequests(entries, locales, model) {
  const values = uniqueSourceValues(entries);
  const requests = [];
  for (const locale of locales) {
    chunk(values, CHUNK_SIZE).forEach((group, groupIndex) => {
      const items = group.map((text, itemIndex) => ({ id: String(groupIndex * CHUNK_SIZE + itemIndex), text }));
      requests.push({
        custom_id: `${locale}:${groupIndex}`,
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model,
          response_format: { type: "json_object" },
          messages: localizationMessages(locale, items),
        },
      });
    });
  }
  return { requests, values };
}

async function api(pathname, init = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetch(`${OPENAI_BASE}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${pathname} failed (${response.status}): ${await response.text()}`);
  return response;
}

async function uploadBatchFile(requests) {
  const jsonl = requests.map((request) => JSON.stringify(request)).join("\n") + "\n";
  const form = new FormData();
  form.set("purpose", "batch");
  form.set("file", new Blob([jsonl], { type: "application/jsonl" }), "visionex-i18n.jsonl");
  return api("/files", { method: "POST", body: form }).then((response) => response.json());
}

async function submit() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const entries = readDictionary(SOURCE_PATH);
  const config = requestConfig();
  const hash = sourceHash();

  if (fs.existsSync(STATE_PATH)) {
    const existing = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    if (existing.source_hash !== hash) throw new Error("English translations changed after the saved batch was submitted.");
    console.log(`Reusing existing batch ${existing.batch_id}.`);
    return;
  }

  const { requests, values } = buildRequests(entries, config.locales, config.model);
  const uploaded = await uploadBatchFile(requests);
  const batch = await api("/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_file_id: uploaded.id, endpoint: "/v1/chat/completions", completion_window: "24h" }),
  }).then((response) => response.json());

  fs.writeFileSync(STATE_PATH, JSON.stringify({
    batch_id: batch.id,
    input_file_id: uploaded.id,
    source_hash: hash,
    source_entries: entries.length,
    unique_values: values.length,
    request_count: requests.length,
    ...config,
  }, null, 2) + "\n");
  console.log(`Submitted ${requests.length} translation requests as batch ${batch.id}.`);
}

async function waitForBatch(batchId) {
  const terminal = new Set(["completed", "failed", "expired", "cancelled"]);
  while (true) {
    const batch = await api(`/batches/${batchId}`).then((response) => response.json());
    console.log(`Batch ${batch.id}: ${batch.status}; completed ${batch.request_counts?.completed ?? 0}/${batch.request_counts?.total ?? 0}.`);
    if (terminal.has(batch.status)) return batch;
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
}

async function downloadFile(fileId) {
  return api(`/files/${fileId}/content`).then((response) => response.text());
}

function parseBatchOutput(jsonl, expectedValues, locales) {
  const translated = Object.fromEntries(locales.map((locale) => [locale, new Map()]));
  const failures = [];
  for (const line of jsonl.trim().split("\n")) {
    if (!line) continue;
    const result = JSON.parse(line);
    const [locale, groupText] = result.custom_id.split(":");
    if (result.error || result.response?.status_code !== 200) {
      failures.push({ custom_id: result.custom_id, error: result.error ?? result.response?.body });
      continue;
    }
    const content = result.response.body.choices?.[0]?.message?.content;
    const payload = JSON.parse(content);
    const groupIndex = Number(groupText);
    for (const item of payload.translations ?? []) {
      const absoluteIndex = translationIndex(groupIndex, item?.id, expectedValues.length, result.custom_id);
      if (absoluteIndex === null) continue;
      const source = expectedValues[absoluteIndex];
      if (typeof item.text !== "string" || !item.text.trim()) throw new Error(`Empty translation in ${result.custom_id}: ${item.id}`);
      const safeText = repairAndAssertPlaceholders(source, item.text, `${locale}:${absoluteIndex}`);
      translated[locale].set(source, safeText);
    }
  }
  if (failures.length) throw new Error(`Batch contains ${failures.length} failed requests: ${JSON.stringify(failures.slice(0, 5))}`);
  return translated;
}

async function repairMissingTranslations(translated, expectedValues, locales, model) {
  for (const locale of locales) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const missingIndexes = expectedValues
        .map((source, index) => translated[locale].has(source) ? null : index)
        .filter((index) => index !== null);
      if (missingIndexes.length === 0) break;
      console.warn(`Repairing ${missingIndexes.length} missing ${locale} translation(s), attempt ${attempt}/3.`);

      for (const indexes of chunk(missingIndexes, CHUNK_SIZE)) {
        const allowed = new Set(indexes);
        const items = indexes.map((index) => ({ id: String(index), text: expectedValues[index] }));
        const response = await api("/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: localizationMessages(locale, items) }),
        }).then((result) => result.json());
        const content = response.choices?.[0]?.message?.content;
        const payload = JSON.parse(content);

        for (const item of payload.translations ?? []) {
          const idText = typeof item?.id === "string" || typeof item?.id === "number" ? String(item.id) : "";
          if (!/^\d+$/.test(idText) || !allowed.has(Number(idText))) {
            console.warn(`Ignored malformed repair item for ${locale}: ${idText || "missing id"}.`);
            continue;
          }
          const index = Number(idText);
          if (typeof item.text !== "string" || !item.text.trim()) continue;
          const source = expectedValues[index];
          translated[locale].set(source, repairAndAssertPlaceholders(source, item.text, `${locale}:repair:${index}`));
        }
      }
    }

    const remaining = expectedValues.filter((source) => !translated[locale].has(source));
    if (remaining.length) throw new Error(`${locale} is still missing ${remaining.length} unique translations after 3 repair attempts.`);
  }
}

function writeLocale(locale, entries, translations) {
  const missing = uniqueSourceValues(entries).filter((value) => !translations.has(value));
  if (missing.length) throw new Error(`${locale} is missing ${missing.length} unique translations.`);
  let identical = 0;
  const lines = entries.map(([key, source]) => {
    const value = translations.get(source);
    if (value === source) identical += 1;
    return `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`;
  });
  if (identical / entries.length > 0.35) throw new Error(`${locale} left ${identical}/${entries.length} values identical to English.`);
  fs.writeFileSync(path.join(ROOT, `src/i18n/${locale}.ts`), [
    "export const translations: Record<string, string> = {",
    ...lines,
    "};",
    "",
    "export default translations;",
    "",
  ].join("\n"));
  return { locale, keys: entries.length, identical_to_english: identical };
}

async function collect() {
  const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  if (state.source_hash !== sourceHash()) throw new Error("English translations changed after batch submission.");
  const batch = await waitForBatch(state.batch_id);
  if (batch.status !== "completed" || !batch.output_file_id) throw new Error(`Translation batch ended with status ${batch.status}.`);
  const entries = readDictionary(SOURCE_PATH);
  const values = uniqueSourceValues(entries);
  const output = await downloadFile(batch.output_file_id);
  const translated = parseBatchOutput(output, values, state.locales);
  await repairMissingTranslations(translated, values, state.locales, state.model);
  const locales = state.locales.map((locale) => writeLocale(locale, entries, translated[locale]));
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ ...state, status: "completed", output_file_id: batch.output_file_id, locales }, null, 2) + "\n");
  console.log(`Generated ${locales.length} complete locale files.`);
}

function inspect() {
  const entries = readDictionary(SOURCE_PATH);
  const config = requestConfig();
  const { requests, values } = buildRequests(entries, config.locales, config.model);
  console.log(JSON.stringify({ source_entries: entries.length, unique_values: values.length, requests: requests.length, ...config }, null, 2));
}

function selfTest() {
  const repaired = repairAndAssertPlaceholders("day remaining", "{n} hari tersisa", "self-test:invented");
  if (repaired !== "hari tersisa") throw new Error(`Unexpected repair result: ${repaired}`);

  const preserved = repairAndAssertPlaceholders("Hello {name}", "Ciao {name}", "self-test:preserved");
  if (preserved !== "Ciao {name}") throw new Error(`Unexpected preserved result: ${preserved}`);

  const restored = repairAndAssertPlaceholders("Hello {name}", "Ciao", "self-test:missing");
  if (restored !== "Ciao {name}") throw new Error(`Unexpected restored result: ${restored}`);

  if (translationIndex(0, "88", 200, "self-test:valid") !== 88) {
    throw new Error("A valid translation id was rejected.");
  }
  if (translationIndex(0, undefined, 200, "self-test:missing-id") !== null) {
    throw new Error("An item without an id must be ignored.");
  }
  if (translationIndex(0, "188", 200, "self-test:wrong-group") !== null) {
    throw new Error("An id from another group must be ignored.");
  }
  console.log("Placeholder repair self-test passed.");
}

const command = process.argv[2] ?? "inspect";
if (command === "inspect") inspect();
else if (command === "self-test") selfTest();
else if (command === "submit") await submit();
else if (command === "collect") await collect();
else throw new Error(`Unknown command: ${command}`);
