// Reports how much of the WhatsApp fixed-reply text has a verified recording, and
// ranks the fixed replies that are worth recording next.
//
//   node scripts/local-audio/coverage.mjs                       coverage + candidates
//   node scripts/local-audio/coverage.mjs --usage counts.json   rank by real counts
//   node scripts/local-audio/coverage.mjs --json                machine-readable
//
// Read-only. Sends nothing, calls no provider, writes no file. `counts.json` is an
// aggregate `{ "<ui key>": <times sent> }` taken from the `local_audio` / `replied`
// log lines; it holds no message text and no identifier. Without it candidates are
// listed unranked and labelled so: nothing here invents a frequency.
//
// Coverage counts a clip only when the manifest says it is active AND the registry
// has text for that language. A language with UI strings but no clip is `text_only`.

import { readFileSync } from "node:fs";
import { LOCAL_RESPONSES, LOCAL_AUDIO_ASSETS } from "../../supabase/functions/_shared/localAudioManifest.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";
import { UI_STRINGS } from "../../supabase/functions/_shared/whatsappStrings.ts";

/** Keys whose text depends on a plan, price, balance or link: never a generic recording. */
const DYNAMIC_KEY = /subscri|plan|price|limit|balance|payment|billing|vx|link|trial|quota|credit|invoice|checkout|order|refund|gender|country/i;
/** Text that carries a variable, a number, a link or a list is read, not heard. */
const DYNAMIC_TEXT = /[{}$%*]|\d|https?:|www\.|\n|[•▪◦]/;
const MAX_CHARS = 90;

/** Why a fixed reply may not be recorded, or null when it may. */
export function ineligibleReason(key, english) {
  if (DYNAMIC_KEY.test(key)) return "dynamic_key";
  if (typeof english !== "string" || english.trim() === "") return "no_english_text";
  if (DYNAMIC_TEXT.test(english)) return "variable_or_list";
  if (english.length > MAX_CHARS) return "too_long";
  if (english.trim().split(/\s+/).length < 3) return "label_not_sentence";
  return null;
}

export function coverage(assets = LOCAL_AUDIO_ASSETS, responses = LOCAL_RESPONSES, strings = UI_STRINGS, languages = SUPPORTED_LANGUAGES) {
  const perLanguage = {};
  for (const language of languages) {
    const row = { approved: 0, withAudio: 0, textOnly: 0, disabled: 0, missing: [] };
    for (const [id, response] of Object.entries(responses)) {
      if (!(response.text ?? strings[response.uiKey])?.[language]) continue;
      row.approved += 1;
      const clip = assets[`${id}.${language}.ogg`];
      if (clip?.status === "active") row.withAudio += 1;
      else if (clip) { row.disabled += 1; row.missing.push(id); }
      else { row.textOnly += 1; row.missing.push(id); }
    }
    perLanguage[language] = row;
  }
  return perLanguage;
}

/**
 * Fixed replies not yet registered, ranked by real usage when `usage` is given.
 * Ranking never reorders on a guess: unranked candidates keep key order and say so.
 */
export function candidates(usage = null, responses = LOCAL_RESPONSES, strings = UI_STRINGS) {
  const registered = new Set(Object.values(responses).map((r) => r.uiKey).filter(Boolean));
  const rows = [];
  for (const [key, text] of Object.entries(strings)) {
    if (registered.has(key)) continue;
    const english = text?.en;
    const reason = ineligibleReason(key, english);
    if (reason) continue;
    const count = usage && Number.isFinite(usage[key]) && usage[key] >= 0 ? Math.floor(usage[key]) : null;
    rows.push({ key, english, chars: english.length, count });
  }
  if (!usage) return rows.map((r) => ({ ...r, ranked: false }));
  return rows
    .filter((r) => r.count !== null && r.count > 0)
    .sort((a, b) => b.count - a.count || a.chars - b.chars || a.key.localeCompare(b.key))
    .map((r) => ({ ...r, ranked: true }));
}

const isMain = process.argv[1] && process.argv[1].endsWith("coverage.mjs");
if (isMain) {
  const usageAt = process.argv.indexOf("--usage");
  const usage = usageAt > 0 ? JSON.parse(readFileSync(process.argv[usageAt + 1], "utf8")) : null;
  const report = { coverage: coverage(), candidates: candidates(usage) };
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("language  approved  audio  text_only  disabled");
    for (const [language, r] of Object.entries(report.coverage)) {
      console.log(`${language.padEnd(8)}  ${String(r.approved).padStart(8)}  ${String(r.withAudio).padStart(5)}  ${String(r.textOnly).padStart(9)}  ${String(r.disabled).padStart(8)}`);
    }
    const ranked = report.candidates.length > 0 && report.candidates[0].ranked;
    console.log(`\n${report.candidates.length} eligible unregistered fixed replies (${ranked ? "ranked by supplied counts" : "UNRANKED: no usage file supplied"})`);
    for (const c of report.candidates.slice(0, 40)) console.log(`${c.count ?? "-"}\t${c.key}\t${c.english}`);
  }
}
