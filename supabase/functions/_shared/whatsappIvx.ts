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

// ── The tutor ───────────────────────────────────────────────────────────────
//
// "اشرح" during a question and "اشرح" after answering are two different
// requests, and the difference is not one this file gets to decide.
// `ivx_wa_tutor_brief` decides it, in SQL, from the student's own session and
// attempt rows, and withholds the correct answer entirely while the question
// is still open. What arrives here is already safe to hand a model.
//
// This is deliberately a pure function over that brief: it builds the system
// text and nothing else, so the whole tutoring path can be driven by a test
// with no provider, no database and no Deno.

/** The brief, exactly as `ivx_wa_tutor_brief` returns it. */
export interface IvxTutorBrief {
  ok?: boolean;
  reason?: string;
  mode?: "socratic" | "explain";
  question_id?: string;
  skill_title?: string;
  objective?: string;
  prompt?: string;
  accessible?: string;
  hint?: string;
  options?: Array<{ id?: string; label?: string }>;
  expected?: string;
  explanation?: string;
  student_answer?: string;
  was_correct?: boolean;
  struggle?: { recent_wrong?: number; recent_total?: number; recent_wrong_answers?: string[] };
}

/**
 * What the tutor is told, on WhatsApp.
 *
 * Shorter than the website's brief on purpose. This answer is read aloud or
 * skimmed on a phone, often by somebody using a screen reader, so the model is
 * asked for a few sentences rather than a lesson — and told not to reach for
 * layout it cannot have here.
 */
export function ivxTutorDirective(brief: IvxTutorBrief, language: Language): string {
  const socratic = brief.mode !== "explain";
  const lines: string[] = [
    "You are the IVX tutor, helping one student with the question below on WhatsApp.",
    `Reply in ${language}. Three or four short sentences, no headings, no tables, no markdown.`,
    "Write it to be read aloud: spell mathematics out in words, describe anything that would otherwise need to be seen.",
    "",
    `SKILL: ${brief.skill_title ?? ""}`,
    brief.objective ? `OBJECTIVE: ${brief.objective}` : "",
    `QUESTION: ${brief.accessible || brief.prompt || ""}`,
  ];

  if (brief.options?.length) {
    lines.push(
      `OPTIONS: ${brief.options
        .map((option, index) => `${String.fromCharCode(65 + index)}) ${option.label ?? ""}`)
        .join(" · ")}`,
    );
  }

  if (socratic) {
    // The answer is absent from the brief, not merely forbidden. Saying so
    // plainly stops the model inventing one to be helpful with.
    lines.push(
      "",
      "MODE: the student has NOT answered yet, and you have not been given the correct answer.",
      "Do not state an answer, do not guess one, and do not narrow the options down to one.",
      "Ask one short question, or point at the step they have missed, so they can work it out.",
      brief.hint ? `A hint exists if they ask for one: ${brief.hint}` : "",
    );
  } else {
    lines.push(
      "",
      "MODE: the student has already answered and has already been shown the correct answer, so explain freely.",
      `CORRECT ANSWER: ${brief.expected ?? ""}`,
      brief.explanation ? `STORED EXPLANATION: ${brief.explanation}` : "",
      brief.student_answer ? `THEY ANSWERED: ${brief.student_answer} (${brief.was_correct ? "correct" : "wrong"})` : "",
      "Explain why the answer is right and where their thinking goes wrong. Do not just repeat the stored explanation.",
    );

    const wrong = brief.struggle?.recent_wrong ?? 0;
    if (wrong >= 2) {
      lines.push(
        `They have got this skill wrong ${wrong} times recently, answering: ${(brief.struggle?.recent_wrong_answers ?? []).slice(0, 4).join(", ")}.`,
        "If those mistakes share a pattern, name it — that is the most useful thing you can tell them.",
      );
    }
  }

  return lines.filter(Boolean).join("\n");
}
