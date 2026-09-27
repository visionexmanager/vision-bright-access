// Is an answer in the writing system the user asked for?
//
// An answer in the wrong language is not a successful answer. The live route
// contract probe caught Groq replying in English to an Arabic question, and a
// production request did the same; both were delivered as successes. The chains
// now treat it as a failed attempt and move on (aiProvider.ts, `expectScript`).
//
// This judges the *script*, not the language: Arabic from Latin, Cyrillic, CJK
// and the rest can be told apart from a few words, reliably and with no model.
// English cannot be told from French this way, and nothing here pretends to.
// Persian and Urdu share the Arabic script and pass as Arabic — the check is a
// floor that catches the failure that happens, not a language identifier.

export type Script =
  | "arabic" | "hebrew" | "cyrillic" | "greek" | "devanagari" | "bengali"
  | "thai" | "hangul" | "kana" | "han" | "latin";

const SCRIPTS: ReadonlyArray<[Script, RegExp]> = [
  ["arabic", /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/],
  ["hebrew", /[֐-׿]/],
  ["cyrillic", /[Ѐ-ӿ]/],
  ["greek", /[Ͱ-Ͽ]/],
  ["devanagari", /[ऀ-ॿ]/],
  ["bengali", /[ঀ-৿]/],
  ["thai", /[฀-๿]/],
  ["hangul", /[가-힯ᄀ-ᇿ]/],
  ["kana", /[぀-ヿ]/],
  ["han", /[一-鿿]/],
  ["latin", /[A-Za-zÀ-ɏ]/],
];

/** Scripts that count as one another's: Japanese mixes kana and kanji. */
const COMPATIBLE: Partial<Record<Script, readonly Script[]>> = { kana: ["han"], han: ["kana"] };

const LANGUAGE_SCRIPT: Readonly<Record<string, Script>> = {
  ar: "arabic", fa: "arabic", ur: "arabic", ps: "arabic", ku: "arabic",
  he: "hebrew", ru: "cyrillic", uk: "cyrillic", bg: "cyrillic", el: "greek",
  hi: "devanagari", mr: "devanagari", ne: "devanagari", bn: "bengali", th: "thai",
  ko: "hangul", ja: "kana", zh: "han",
  en: "latin", fr: "latin", es: "latin", de: "latin", it: "latin", pt: "latin", tr: "latin",
  nl: "latin", pl: "latin", id: "latin", ms: "latin", sw: "latin", ro: "latin", sv: "latin", vi: "latin",
};

/** The script a language code is written in, or null when it is not known here. */
export function scriptOfLanguage(code: string | null | undefined): Script | null {
  if (!code) return null;
  return LANGUAGE_SCRIPT[code.toLowerCase().split(/[-_]/)[0]] ?? null;
}

function counts(text: string): Map<Script, number> {
  const out = new Map<Script, number>();
  for (const ch of text) {
    for (const [script, re] of SCRIPTS) {
      if (re.test(ch)) { out.set(script, (out.get(script) ?? 0) + 1); break; }
    }
  }
  return out;
}

/** The script most of the text's letters are in, or null with fewer than `minLetters`. */
export function dominantScript(text: string, minLetters = 3): Script | null {
  const c = counts(text);
  const total = [...c.values()].reduce((a, b) => a + b, 0);
  if (total < minLetters) return null;
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// A request for another language is honoured, not overruled: "translate this
// into English", written in Arabic, must be allowed to answer in English.
const ASKS_FOR_ANOTHER_LANGUAGE =
  /ترجم|translat|traduc|übersetz|إنجليزي|انجليزي|إنكليزي|انكليزي|english|فرنسي|french|français|إسباني|اسباني|spanish|ألماني|الماني|german|بالتركي|turkish|بالروسي|russian|بالصيني|chinese|باللغة/i;

/**
 * The script a reply to this message must be written in, or null when there is
 * nothing to enforce: a Latin-script message (English and French look alike to
 * a script check), too few letters to judge, or a message that asks for another
 * language.
 */
export function expectedScriptForMessage(text: string | null | undefined): Script | null {
  if (!text || ASKS_FOR_ANOTHER_LANGUAGE.test(text)) return null;
  const script = dominantScript(text, 3);
  return script && script !== "latin" ? script : null;
}

/**
 * Whether an answer is in the expected script. Undecidable (fewer than
 * `minLetters` letters — "OK", a number, a link) counts as yes: the check only
 * refuses what it can see is wrong.
 */
export function answerIsInScript(answer: string, expected: Script, minLetters = 12): boolean {
  const c = counts(answer);
  const total = [...c.values()].reduce((a, b) => a + b, 0);
  if (total < minLetters) return true;
  const inScript = [expected, ...(COMPATIBLE[expected] ?? [])].reduce((n, s) => n + (c.get(s) ?? 0), 0);
  return inScript / total >= 0.5;
}

/** Every string inside a structured result, for judging its language. */
export function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(textOf).join(" ");
  return "";
}
