// Preferences a sender can set by asking, in plain language.
//
// There is no settings screen on WhatsApp, so the only way to offer a
// preference is to notice someone asking for it. Matching is deliberately
// narrow: a phrase has to look like an instruction to the assistant, not like
// a sentence that happens to contain the word "English". Getting this wrong
// silently changes how someone is answered, which is worse than not offering
// the setting at all.
//
// Pure and provider-free so the matching can be tested exhaustively.

import { isSupportedLanguage, type SupportedLanguage } from "./whatsapp.ts";

export interface PreferenceChange {
  preferred_language?: SupportedLanguage;
  /** How replies are delivered. See `VoiceMode` in whatsappVoiceReply.ts. */
  voice_mode?: "mirror" | "always" | "never";
  /** Kept in step with `voice_mode` so a rolled-back function still works. */
  voice_replies?: boolean;
  verbosity?: "concise" | "detailed" | null;
}

/**
 * Language names a sender might use, mapped to the locale code.
 *
 * `\b` is applied only to the Latin spellings. JavaScript word boundaries are
 * defined against `[A-Za-z0-9_]`, so `\bعربي\b` never matches — the same trap
 * that had "شكرا" being sent for retrieval in Phase 4.
 */
const LANGUAGE_REQUESTS: ReadonlyArray<[SupportedLanguage, RegExp]> = [
  ["en", /\b(english)\b|إنجليزي|انجليزي|بالإنجليزية|بالانجليزي|انگلیسی|انگریزی/i],
  ["ar", /\b(arabic)\b|عربي|بالعربي|بالعربية|العربية|عربية/i],
  ["fr", /\b(french|français|francais)\b|فرنسي|بالفرنسية/i],
  ["es", /\b(spanish|español|espanol)\b|إسباني|اسباني/i],
  ["de", /\b(german|deutsch)\b|ألماني|الماني/i],
  ["tr", /\b(turkish|türkçe|turkce)\b|تركي|بالتركية/i],
  ["ur", /\b(urdu)\b|اردو|أردو/i],
  ["fa", /\b(persian|farsi)\b|فارسی|فارسي/i],
  ["hi", /\b(hindi)\b|हिंदी|هندي/i],
  ["ru", /\b(russian)\b|русский|روسي/i],
  ["pt", /\b(portuguese|português|portugues)\b|برتغالي/i],
  ["id", /\b(indonesian|bahasa indonesia)\b/i],
  ["it", /\b(italian|italiano)\b|إيطالي|ايطالي/i],
  ["nl", /\b(dutch|nederlands)\b/i],
  ["pl", /\b(polish|polski)\b/i],
  ["vi", /\b(vietnamese)\b|tiếng việt/i],
  ["zh", /\b(chinese)\b|中文|صيني/i],
  ["ja", /\b(japanese)\b|日本語|ياباني/i],
  ["ko", /\b(korean)\b|한국어|كوري/i],
  ["bn", /\b(bengali)\b|বাংলা/i],
];

/** Only these framings count as an instruction about language. */
const LANGUAGE_INTENT = [
  /\b(reply|answer|respond|write|speak|talk|switch)\b/i,
  /\b(in|to|using)\s+$/i,
  /(احكي|جاوب|رد|اكتب|تكلم|بدي).*(عرب|إنجليز|انجليز|فرنس|ترك)/i,
  /(بالعربي|بالإنجليزي|بالانجليزي|بالفرنسية|بالتركية)/i,
];

/**
 * Asking to be answered out loud.
 *
 * Wider than it was, in Arabic especially. The first version matched only
 * "ابعت/أرسل/بدي … صوت", which leaves out how most people actually say it —
 * «ردّ عليّ صوتياً», «جاوبني بالصوت», «احكيلي صوت» — and a preference nobody
 * can phrase is a preference nobody has.
 *
 * Wider, but not loose. "صوت" on its own is an ordinary word on a site that
 * also sells televisions and radios: "بدي أعرف كيف أشغل الصوت" is a support
 * question, and answering it by silently changing how every later reply
 * arrives would be worse than never offering the setting. So the adjectival
 * forms — صوتي، صوتية، صوتياً، بالصوت — carry the intent on their own after an
 * asking verb, while the bare noun counts only immediately after a verb that
 * means *reply*.
 */
const VOICE_ON = [
  /\b(send|reply|answer|respond)\b.{0,20}\b(voice|audio|voice note|voice message)\b/i,
  /\b(voice|audio|spoken)\b.{0,16}\b(reply|replies|answer|answers|response|mode)\b/i,
  // "on" and "please" only where the sentence ends: "voice replies on" is an
  // instruction, "the audio on this file is broken" is a support question.
  /\b(voice|audio)\b ?(notes?|messages?|replies|reply)? ?(please|on)\s*$/i,
  /\b(speak|say)\b.{0,16}\b(reply|replies|answer|answers)\b/i,
  /\btalk to me\b/i,
  /(ابعت|ابعث|إبعت|أرسل|ارسل|بدي|بدّي|أريد|اريد|رد|ردّ|ردود|جاوب|جاوبني|احكي|احكيلي|كلمني|تكلم|خليك).{0,20}(صوتياً|صوتيا|صوتية|صوتي|بالصوت)/i,
  /(بدي|بدّي|أريد|اريد|رد|ردّ|جاوب|جاوبني|احكي|احكيلي|كلمني|ابعتلي|ابعث لي)\s*(لي|عليّ|علي)?\s*(بال)?صوت/i,
];

const VOICE_OFF = [
  /\b(no|stop|don'?t|disable|turn off)\b.{0,20}\b(voice|audio)\b/i,
  /\b(text|written)\b.{0,20}\b(only|please|instead)\b/i,
  /(بدون|وقف|لا).{0,15}(صوت|صوتية)/i,
  // Syrian and Egyptian negation, which the list above misses entirely: left
  // out, "ما بدي صوت" reads as a request for exactly what it refuses.
  /(ما|مو|مش)\s*(بدي|بدّي|أريد|اريد|عايز|عاوز).{0,15}(صوت)/i,
  /(اكتب|نص).{0,12}(فقط|بس)/i,
];

/**
 * Asking for the medium to be matched rather than fixed.
 *
 * The default already does this, so these phrases exist to *undo* an earlier
 * "always" or "never" — and to be understood when somebody states the rule out
 * loud, which people do: «رد متل ما بحكيك» is an instruction, and answering it
 * with a paragraph about the weather would be absurd.
 */
const VOICE_MIRROR = [
  /\b(match|mirror)\b.{0,16}\b(me|my|the way)\b/i,
  /\b(same way|however i|the way i)\b.{0,16}\b(send|write|ask|message|speak|talk)\b/i,
  /\breply (in|the) (same|kind)\b/i,
  /(مثل|متل|زي)\s*(ما)\s*(أرسل|ارسل|ابعت|أبعت|بعتلك|احكي|بحكيك|أحكي|اكتب)/i,
  /(بنفس|نفس)\s*(الطريقة|الأسلوب|طريقتي)/i,
];

const CONCISE = [
  /\b(be )?(brief|short|concise|shorter)\b/i,
  /\b(keep it|make it)\b.{0,12}\b(short|brief)\b/i,
  /(اختصر|باختصار|جواب قصير|بدي جواب قصير)/i,
];

const DETAILED = [
  /\b(more detail|detailed|explain more|elaborate|in depth|full explanation)\b/i,
  /(بالتفصيل|تفاصيل أكثر|اشرح أكثر|شرح مفصل)/i,
];

/**
 * Read any preference the sender just asked for.
 *
 * Returns only what was actually requested — an empty object means the message
 * was an ordinary question and must be answered as one. A language name alone
 * is not enough: "my documents are in English" is a fact about documents, not
 * an instruction, so an intent phrase has to be present too.
 */
/** Writes the mode and the boolean the old column still expects. */
function setVoice(change: PreferenceChange, mode: "mirror" | "always" | "never"): void {
  change.voice_mode = mode;
  change.voice_replies = mode === "always";
}

export function parsePreferenceRequest(text: string): PreferenceChange {
  const change: PreferenceChange = {};
  const sample = (text ?? "").trim();
  if (!sample || sample.length > 300) return change;

  const wantsLanguageChange = LANGUAGE_INTENT.some((pattern) => pattern.test(sample));
  if (wantsLanguageChange) {
    for (const [code, pattern] of LANGUAGE_REQUESTS) {
      if (pattern.test(sample) && isSupportedLanguage(code)) {
        change.preferred_language = code;
        break;
      }
    }
  }

  // Off is checked first: "no voice replies" contains "voice replies". Mirror
  // is checked before on for the same reason: "reply the same way I write"
  // contains neither, but "answer me the same way, voice or text" contains on.
  if (VOICE_OFF.some((pattern) => pattern.test(sample))) setVoice(change, "never");
  else if (VOICE_MIRROR.some((pattern) => pattern.test(sample))) setVoice(change, "mirror");
  else if (VOICE_ON.some((pattern) => pattern.test(sample))) setVoice(change, "always");

  if (CONCISE.some((pattern) => pattern.test(sample))) change.verbosity = "concise";
  else if (DETAILED.some((pattern) => pattern.test(sample))) change.verbosity = "detailed";

  return change;
}

export const hasPreferenceChange = (change: PreferenceChange): boolean =>
  Object.keys(change).length > 0;

/** Confirms a change in the sender's language, so it is never silent. */
export function preferenceConfirmation(
  language: "ar" | "en",
  change: PreferenceChange,
  languageName: string,
): string {
  const parts: string[] = [];
  if (change.preferred_language) {
    parts.push(language === "ar" ? `سأتابع بـ${languageName}.` : `I'll continue in ${languageName}.`);
  }
  if (change.voice_mode === "always") {
    parts.push(language === "ar" ? "سأرسل الردود صوتياً أيضاً." : "I'll send replies as voice notes too.");
  }
  if (change.voice_mode === "never") {
    parts.push(language === "ar" ? "سأرد نصاً فقط." : "I'll reply with text only.");
  }
  if (change.voice_mode === "mirror") {
    parts.push(
      language === "ar"
        ? "سأرد بنفس طريقتك: صوت على الصوت، وكتابة على الكتابة."
        : "I'll answer the way you write: voice for voice, text for text.",
    );
  }
  if (change.verbosity === "concise") {
    parts.push(language === "ar" ? "وسأختصر." : "And I'll keep it brief.");
  }
  if (change.verbosity === "detailed") {
    parts.push(language === "ar" ? "وسأشرح بتفصيل أكثر." : "And I'll go into more detail.");
  }
  return parts.join(" ");
}

/**
 * The three ways replies can arrive, and which one is on.
 *
 * Sent when the sender opens the voice row of the menu. It says the state
 * first, because that is the question they actually have, and then the exact
 * words for the other two — a setting you cannot phrase is a setting you do not
 * have, which is the lesson the matching above is built on.
 */
export function voiceModeExplainer(
  language: "ar" | "en",
  mode: "mirror" | "always" | "never",
): string {
  if (language === "ar") {
    const now = mode === "always"
      ? "الآن: أرد بصوت دائماً."
      : mode === "never"
      ? "الآن: أرد نصاً فقط."
      : "الآن: أرد بنفس طريقتك — صوت على الصوت، وكتابة على الكتابة.";
    return [
      "*الردود الصوتية*",
      "",
      now,
      "",
      "• قل «ردّ عليّ صوتياً» لأرد بصوت دائماً",
      "• قل «اكتب فقط» لأرد نصاً فقط",
      "• قل «رد مثل ما أرسل» للعودة للوضع الافتراضي",
    ].join("\n");
  }
  const now = mode === "always"
    ? "Right now: I always reply out loud."
    : mode === "never"
    ? "Right now: I reply with text only."
    : "Right now: I match you — voice for voice, text for text.";
  return [
    "*Voice replies*",
    "",
    now,
    "",
    "• Say \"reply with voice\" and I'll always speak",
    "• Say \"text only\" and I'll always write",
    "• Say \"reply the same way I send\" for the default",
  ].join("\n");
}

/** Appended to the system prompt when a length preference is stored. */
export function verbosityDirective(verbosity: string | null | undefined): string {
  if (verbosity === "concise") {
    return "This customer asked for brief answers. Two or three sentences unless they ask for more.";
  }
  if (verbosity === "detailed") {
    return "This customer asked for detail. Explain the reasoning and cover the edge cases.";
  }
  return "";
}
