// IVX on WhatsApp.
//
// The learning happens in the database — selection, grading, mastery and XP are
// the same functions the website calls, so ten questions answered here and a
// lesson finished on the site are one student's progress and not two.
//
// What lives in this file is the part that is genuinely about WhatsApp: what
// counts as "start learning", how a question reads when it arrives as a
// message rather than on a page, and what a learner is told when they are not
// linked to an account yet.
//
// Pure. No `Deno`, no fetch, no database client — the calls are four lines in
// the webhook, where the client already is.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** Where a learner goes to see the whole picture. */
export const IVX_URL = "https://visionex.app/academy/ivx";

export type IvxIntent = "start" | "hint" | "explain" | "next" | "stop" | "progress";

const START = [
  /\b(ivx|learn|study|practi[sc]e|teach me|lesson)\b/i,
  /(تعلم|تعلّم|أتعلم|اتعلم|ادرس|أدرس|دراسة|تمرين|تمارين|درس|علمني|علّمني)/,
];

const HINT = [/\b(hint|clue|help me)\b/i, /(تلميح|مساعدة|ساعدني|لمحة)/];
const EXPLAIN = [/\b(explain|why|how come|i don'?t understand)\b/i, /(اشرح|إشرح|وضح|وضّح|ما فهمت|لم أفهم|مش فاهم)/];
const NEXT = [/\b(next|another|continue|skip)\b/i, /(التالي|التالية|كمان|غيرها|استمر|تخطي)/];
const STOP = [/\b(stop|enough|quit|exit)\b/i, /(توقف|كفى|خلاص|إنهاء|انهاء)/];
const PROGRESS = [/\b(my progress|how am i doing|my level)\b/i, /(تقدمي|مستواي|كيف أدائي|وين وصلت)/];

/** Longest a message can be and still be read as an IVX command. */
export const IVX_MAX_CHARS = 60;

/**
 * What the learner asked for, or null.
 *
 * Ordered so the specific beats the general: "explain" and "hint" are checked
 * before "start", because "اشرح لي" during a question is a request about that
 * question and not a request to begin something new.
 */
export function parseIvxIntent(text: string | null | undefined): IvxIntent | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > IVX_MAX_CHARS) return null;

  const matches = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(trimmed));

  if (matches(PROGRESS)) return "progress";
  if (matches(HINT)) return "hint";
  if (matches(EXPLAIN)) return "explain";
  if (matches(STOP)) return "stop";
  if (matches(NEXT)) return "next";
  if (matches(START)) return "start";
  return null;
}

/** The subjects a learner can name, mapped to their slugs in both languages. */
const SUBJECT_WORDS: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: "math", patterns: [/\b(math|maths|mathematics|arithmetic)\b/i, /(رياضيات|حساب|الرياضيات)/] },
  { slug: "languages", patterns: [/\b(language|english|arabic|vocabulary|grammar)\b/i, /(لغة|لغات|إنجليزي|انجليزي|عربي|مفردات|قواعد)/] },
  { slug: "science", patterns: [/\b(science|physics|chemistry|biology|space)\b/i, /(علوم|فيزياء|كيمياء|أحياء|فضاء)/] },
  { slug: "programming", patterns: [/\b(programming|coding|code|python|html|developer)\b/i, /(برمجة|بايثون|كود|تطوير)/] },
  { slug: "ai", patterns: [/\b(ai|artificial intelligence|machine learning)\b/i, /(ذكاء اصطناعي|الذكاء الاصطناعي|تعلم الآلة)/] },
  { slug: "knowledge", patterns: [/\b(general knowledge|geography|history)\b/i, /(ثقافة عامة|جغرافيا|تاريخ)/] },
  { slug: "life", patterns: [/\b(life skills|money|budget|safety)\b/i, /(مهارات الحياة|المال|ميزانية|أمان)/] },
  { slug: "access", patterns: [/\b(accessibility|screen reader)\b/i, /(إتاحة|اتاحة|قارئ الشاشة|وصولية)/] },
];

/** A subject named in a message, or null to let the engine choose. */
export function parseIvxSubject(text: string | null | undefined): string | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > IVX_MAX_CHARS) return null;
  return SUBJECT_WORDS.find((entry) => entry.patterns.some((p) => p.test(trimmed)))?.slug ?? null;
}

export interface IvxQuestionPayload {
  question_id?: string;
  skill_title?: string;
  prompt?: string;
  options?: Array<{ id?: string; label?: string }>;
  accessible?: string;
  has_hint?: boolean;
}

/**
 * A question, as a message.
 *
 * The prompt leads, because it is what the listener is waiting for. Options are
 * lettered rather than numbered: the numbers in this assistant already mean
 * "menu item", and a learner answering "2" to a question while a menu is open
 * would be ambiguous to a person as well as to the parser.
 *
 * The accessible reading replaces nothing — it is added underneath, because a
 * listener benefits from hearing "three x plus five equals twenty" whether or
 * not they can also see the symbols.
 */
export function formatIvxQuestion(payload: IvxQuestionPayload, language: Language): string {
  const lines: string[] = [];
  if (payload.skill_title) lines.push(`📘 *${payload.skill_title}*`);
  lines.push(payload.prompt ?? "");

  if (payload.accessible && payload.accessible !== payload.prompt) {
    lines.push(payload.accessible);
  }

  const options = payload.options ?? [];
  if (options.length > 0) {
    lines.push("");
    options.forEach((option, index) => {
      const letter = String.fromCharCode(65 + index);
      lines.push(`${letter}) ${option.label ?? ""}`);
    });
  }

  lines.push("");
  lines.push(options.length > 0 ? say("ivxAnswerLetter", language) : say("ivxAnswerType", language));
  return lines.filter((line) => line !== undefined).join("\n");
}

/**
 * A lettered reply mapped back to the option id the engine expects.
 *
 * "A", "a" and "a)" are all the same answer from somebody typing on a phone.
 * Anything else is returned untouched, because a numeric or written answer is
 * the answer itself.
 */
export function resolveIvxAnswer(given: string, options: Array<{ id?: string }> = []): string {
  const cleaned = given.trim().replace(/[).:\-\s]+$/, "").trim();
  if (options.length > 0 && /^[a-zA-Z]$/.test(cleaned)) {
    const index = cleaned.toUpperCase().charCodeAt(0) - 65;
    const picked = options[index]?.id;
    if (picked) return picked;
  }
  return given.trim();
}

export interface IvxResultPayload {
  correct?: boolean;
  expected?: string | null;
  explanation?: string;
  xp?: number;
  mastery?: { state?: string; score?: number };
}

/** The result of an answer, in the order a listener needs it. */
export function formatIvxResult(payload: IvxResultPayload, language: Language): string {
  const lines: string[] = [];

  // Right or wrong first, in words. Everything else is commentary on it, and a
  // listener should not have to wait through commentary to learn which it was.
  lines.push(
    payload.correct
      ? say("ivxCorrect", language).replace("{xp}", String(payload.xp ?? 0))
      : say("ivxIncorrect", language),
  );

  if (!payload.correct && payload.expected) {
    lines.push(say("ivxTheAnswer", language).replace("{answer}", payload.expected));
  }
  if (payload.explanation) lines.push(payload.explanation);

  lines.push("");
  lines.push(say("ivxContinue", language));
  return lines.join("\n");
}

/** Where a learner stands, in one line. */
export function formatIvxProgress(
  payload: { xp?: number; mastered?: number; in_progress?: number; recommended?: { title?: string } | null },
  language: Language,
): string {
  const lines = [
    say("ivxProgressHeading", language)
      .replace("{xp}", String(payload.xp ?? 0))
      .replace("{mastered}", String(payload.mastered ?? 0))
      .replace("{learning}", String(payload.in_progress ?? 0)),
  ];
  if (payload.recommended?.title) {
    lines.push(say("ivxRecommended", language).replace("{skill}", payload.recommended.title));
  }
  return lines.join("\n");
}

/**
 * Not linked yet.
 *
 * Progress has to belong to an account or it cannot follow somebody to the
 * website, so this is the one thing IVX asks for before it starts — and it
 * says how, because "link your account" without the steps is a dead end.
 */
export function ivxNotLinkedNotice(language: Language): string {
  return say("ivxNotLinked", language).replace("{url}", IVX_URL);
}

/** Nothing available in the subject they asked for. */
export function ivxNothingNotice(language: Language): string {
  return say("ivxNothing", language);
}
