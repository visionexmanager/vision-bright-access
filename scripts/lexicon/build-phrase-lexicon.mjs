// Builds supabase/functions/_shared/chatPhraseLexicon.ts from two open datasets.
//
//   node scripts/lexicon/build-phrase-lexicon.mjs --massive <dir> --tatoeba <dir>
//
//   --massive  the extracted amazon-massive-dataset-1.0 (data/<locale>.jsonl)
//   --tatoeba  a folder of <iso3>.tsv.bz2 per-language exports, already bunzip2'd to <iso3>.tsv
//
// What it takes from each, and why:
//
//   MASSIVE (Amazon, CC BY 4.0) carries an intent label on every utterance, in
//   all twenty of our languages. From it: (1) the short utterances labelled
//   general_greet become greeting phrases, and (2) the tokens that are
//   distinctive of everyday-assistant intents (weather, news, alarms, music,
//   recipes, transport, takeaway, calendar, lists, time) become the keywords of
//   the "assistant" topic: a question the paid assistant answers, which a free
//   reply can honestly say "yes, with a plan".
//
//   Tatoeba (CC BY 2.0 FR) has no intent labels. It is used only to *reject*:
//   any keyword that appears in more than 0.6% of ordinary short sentences is
//   too common to be a signal and is dropped.
//
// The output is a list of folded keywords, not a copy of either dataset.
// Deterministic: same inputs, same file.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : null;
};
const MASSIVE = arg("massive");
const TATOEBA = arg("tatoeba");
if (!MASSIVE || !TATOEBA) throw new Error("usage: --massive <dir> --tatoeba <dir>");

// language → [massive locale, tatoeba iso3]
const LANGS = {
  en: ["en-US", "eng"], ar: ["ar-SA", "ara"], ur: ["ur-PK", "urd"], hi: ["hi-IN", "hin"], id: ["id-ID", "ind"],
  ja: ["ja-JP", "jpn"], it: ["it-IT", "ita"], ko: ["ko-KR", "kor"], nl: ["nl-NL", "nld"], pl: ["pl-PL", "pol"],
  vi: ["vi-VN", "vie"], bn: ["bn-BD", "ben"], fa: ["fa-IR", "pes"], es: ["es-ES", "spa"], de: ["de-DE", "deu"],
  pt: ["pt-PT", "por"], zh: ["zh-CN", "cmn"], tr: ["tr-TR", "tur"], fr: ["fr-FR", "fra"], ru: ["ru-RU", "rus"],
};
// Dataset artefacts and words that also mean something else on a sales chat (an order is not a takeaway).
const DROP = new Set(["mean", "order", "date", "capital", "font", "non", "florida", "paris", "coat", "jacket", "jack", "customer", "client", "complaint", "definition", "description", "louder", "artist", "classical", "classique", "clasica", "commande", "cliente", "cambio", "cae", "fera", "disant", "diciendo", "concernant",
  "pay", "fall", "hut", "hits", "pop", "tall", "later", "wear", "dad", "indian", "states", "united", "regarding", "service", "report",
  "received", "sent", "saying", "pasta", "pending", "jennifer", "mumbai", "orlando", "dominoes", "station", "train", "trains", "route",
  "veut", "envie", "rencontrer", "etats", "unis", "nacio", "lange", "familie", "geboren", "daran", "dollar", "dolar", "euro"]);
// Japanese bigrams from this data are mostly particles and fragments: not a usable signal.
const NO_ASSISTANT = new Set(["ja"]);
const BIGRAM = new Set(["ja", "zh"]);
const LATIN = new Set(["en", "id", "it", "nl", "pl", "vi", "es", "de", "pt", "tr", "fr"]); // no spaces: character bigrams stand in for words

const ASSISTANT_INTENTS = new Set([
  "weather_query", "news_query", "alarm_set", "alarm_query", "alarm_remove", "play_music", "music_query",
  "recipes_query", "transport_query", "transport_ticket", "transport_traffic", "takeaway_order", "takeaway_query",
  "lists_createoradd", "lists_query", "calendar_set", "calendar_query", "datetime_query", "qa_currency",
  "qa_definition", "qa_maths", "qa_factoid", "play_podcasts", "play_radio", "audio_volume_up", "audio_volume_down",
  "email_query", "email_sendemail", "cooking_recipe", "social_post",
]);

/** The same folding the runtime applies to a message, so keywords compare like for like. */
function fold(text) {
  return text
    .normalize("NFD")
    .replace(/[\p{M}ـ]/gu, "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(lang, text) {
  const f = fold(text);
  if (!BIGRAM.has(lang)) return f.split(" ").filter((t) => [...t].length >= 2);
  const chars = [...f.replace(/\s/g, "")];
  const out = [];
  for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
  return out;
}

function tatoebaSample(iso3) {
  const f = join(TATOEBA, `${iso3}.tsv`);
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").split("\n").map((l) => l.split("\t")[2]).filter((t) => t && t.length < 60).slice(0, 20000).map((t) => ` ${fold(t)} `);
}

const result = {};
const examples = {};
const report = {};
const sentences = {}; // a stable sample of ordinary short sentences per language, for the final cross-language check

for (const [lang, [locale, iso3]] of Object.entries(LANGS)) {
  const file = join(MASSIVE, "data", `${locale}.jsonl`);
  if (!existsSync(file)) throw new Error(`missing ${file}`);
  const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

  // ── greeting phrases: short general_greet utterances ─────────────────────
  const greetings = new Set();
  for (const r of rows) {
    if (r.intent !== "general_greet") continue;
    const f = fold(r.utt);
    const n = BIGRAM.has(lang) ? [...f.replace(/\s/g, "")].length : f.split(" ").length;
    if (f && n <= (BIGRAM.has(lang) ? 8 : 4)) greetings.add(f);
  }

  // ── assistant keywords: distinctive tokens of everyday-assistant intents ──
  const inSet = new Map();
  const outSet = new Map();
  let nIn = 0;
  let nOut = 0;
  for (const r of rows) {
    const toks = new Set(tokens(lang, r.utt));
    const inside = ASSISTANT_INTENTS.has(r.intent);
    inside ? nIn++ : nOut++;
    for (const t of toks) (inside ? inSet : outSet).set(t, ((inside ? inSet : outSet).get(t) ?? 0) + 1);
  }

  // Tatoeba: how common is each token in ordinary short sentences?
  const tFile = join(TATOEBA, `${iso3}.tsv`);
  const common = new Map();
  let nT = 0;
  if (existsSync(tFile)) {
    let seen = 0;
    for (const line of readFileSync(tFile, "utf8").split("\n")) {
      const text = line.split("\t")[2];
      if (!text || text.length > 80) continue;
      if (++seen > 60000) break; // a stable sample, enough to see what is everyday
      nT++;
      for (const t of new Set(tokens(lang, text))) common.set(t, (common.get(t) ?? 0) + 1);
    }
  }

  sentences[lang] = tatoebaSample(iso3);
  const scored = [];
  for (const [t, c] of inSet) {
    if (c < 12 || DROP.has(t) || NO_ASSISTANT.has(lang)) continue;
    const pIn = c / nIn;
    const pOut = (outSet.get(t) ?? 0) / nOut;
    if (pIn < 12 * pOut || pOut > 0.003) continue; // at least twelve times more likely inside, and rare outside
    if (nT && (common.get(t) ?? 0) / nT > 0.0015) continue; // too ordinary to be a signal
    scored.push([t, c]); // the most frequent signals first: they are the ones people actually type
  }
  scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // ── example requests, in the language's own words, to show what the assistant can do ──
  const wanted = {
    weather: "weather_query", news: "news_query", alarm: "alarm_set", music: "play_music",
    recipes: "recipes_query", time: "datetime_query", transport: "transport_query", facts: "qa_factoid",
  };
  examples[lang] = {};
  for (const [group, intent] of Object.entries(wanted)) {
    const seen = new Set();
    const pool = [];
    for (const r of rows) {
      if (r.intent !== intent) continue;
      const u = r.utt.trim();
      const len = [...u].length;
      if (len < (BIGRAM.has(lang) ? 5 : 14) || len > (BIGRAM.has(lang) ? 20 : 48)) continue;
      if (!LATIN.has(lang) && /[A-Za-z]{3,}/.test(u)) continue; // Latin names inside non-Latin text
      // initials, ampersands and cut-off sentences make bad examples
      if (/olly/i.test(u) || /\d/.test(u) || /(^|\s)\p{L}\.(\s|$)/u.test(u) || u.includes("&") || / (for|at|in|on|to|a|de|à|para|en)$/i.test(u)) continue;
      const key = fold(u);
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(u);
    }
    // The most typical phrasings, not the oddest: score each utterance by how common its
    // words are among all the utterances of the intent (a proper noun or a stray topic scores low).
    const freq = new Map();
    for (const u of pool) for (const t of new Set(tokens(lang, u))) freq.set(t, (freq.get(t) ?? 0) + 1);
    const score = (u) => {
      const ts = [...new Set(tokens(lang, u))];
      return ts.length ? ts.reduce((a, t) => a + (freq.get(t) ?? 0), 0) / ts.length : 0;
    };
    pool.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
    const pick = [];
    const firsts = new Set();
    for (const u of pool) {
      const first = tokens(lang, u)[0];
      if (firsts.has(first)) continue; // vary the openings
      firsts.add(first);
      pick.push(u);
      if (pick.length === 6) break;
    }
    examples[lang][group] = pick;
  }
  result[lang] = {
    greeting: [...greetings].sort().slice(0, 25),
    assistant: scored.slice(0, 60).map(([t]) => t).sort(),
  };
  report[lang] = { greeting: result[lang].greeting.length, assistant: result[lang].assistant.length, rows: rows.length, tatoeba: nT };
}

// A merged list is matched against every language, so a keyword must be rare in ordinary
// sentences of ALL of them, not just its own (a Turkish greeting that is an English word).
const MAX_RATE = 0.0002;
const allSentences = Object.values(sentences).flat();
const hits = (kw) => {
  const bigram = /[぀-ヿ㐀-鿿가-힯]/u.test(kw);
  const needle = bigram ? kw : ` ${kw} `;
  let n = 0;
  for (const s of allSentences) if (s.includes(needle)) n++;
  return n / Math.max(1, allSentences.length);
};
for (const lang of Object.keys(result)) {
  for (const topic of ["greeting", "assistant"]) {
    result[lang][topic] = result[lang][topic].filter((kw) => hits(kw) <= MAX_RATE);
  }
  report[lang].greeting = result[lang].greeting.length;
  report[lang].assistant = result[lang].assistant.length;
}

const header = `// GENERATED by scripts/lexicon/build-phrase-lexicon.mjs — do not edit by hand.
//
// Folded keywords for the free replies, mined from open datasets:
//   • MASSIVE, © Amazon, CC BY 4.0 — https://github.com/alexa/massive
//   • Tatoeba sentences, CC BY 2.0 FR — https://tatoeba.org (used only to drop over-common words)
// This file holds keywords, not a copy of either dataset. Attribution is also
// listed on the site's credits.
//
// greeting   short greeting phrases (whole-phrase match)
// assistant  words typical of everyday-assistant requests (weather, news, alarms,
//            music, recipes, transport, takeaway, calendar, lists, time)
`;
writeFileSync(
  "supabase/functions/_shared/chatPhraseLexicon.ts",
  `${header}\nexport const LEXICON: Record<string, { greeting: string[]; assistant: string[] }> = ${JSON.stringify(result, null, 2)};\n`,
);
writeFileSync(
  "supabase/functions/_shared/chatExamples.ts",
  `${header.replace("GENERATED by", "GENERATED by").split("\n\n")[0]}
//
// Short example requests per language and group, taken from MASSIVE (CC BY 4.0),
// shown to people who have not subscribed yet so they see what the assistant does.
// Utterances are kept as written in the dataset.

export const EXAMPLES: Record<string, Record<string, string[]>> = ${JSON.stringify(examples, null, 2)};
`,
);
console.table(report);
