import { supabase } from "@/integrations/supabase/client";

/**
 * IVX, from the website's side.
 *
 * Every function here is a thin call onto a database function. That is the
 * whole design: selection, grading, mastery and XP live in one place so the
 * site and WhatsApp cannot drift apart, and so the answer to a question never
 * travels to a browser where a student could read it out of a response.
 *
 * Nothing in this file decides whether an answer is correct.
 */

export type MasteryState =
  | "not_started" | "introduced" | "learning" | "developing" | "proficient" | "mastered";

export type QuestionKind =
  | "multiple_choice" | "true_false" | "numeric" | "text" | "fill_blank" | "ordering" | "code";

export interface IvxOption {
  id: string;
  label: string;
}

export interface IvxQuestion {
  ok: true;
  question_id: string;
  skill: string;
  skill_title: string;
  kind: QuestionKind;
  prompt: string;
  options: IvxOption[];
  /** What a screen reader should hear in place of a visual prompt. */
  accessible: string;
  difficulty: number;
  has_hint: boolean;
}

export interface IvxRefusal {
  ok: false;
  reason: string;
}

export interface IvxAnswerResult {
  ok: true;
  correct: boolean;
  /** Only present when the answer was wrong — there is nothing to reveal otherwise. */
  expected: string | null;
  explanation: string;
  xp: number;
  mastery: { skill: string; score: number; state: MasteryState; streak: number };
}

export interface IvxSkillProgress {
  slug: string;
  subject: string;
  title: string;
  level: number;
  state: MasteryState;
  score: number;
  unlocked: boolean;
  due: boolean;
}

export interface IvxSubjectProgress {
  slug: string;
  title: string;
  icon: string | null;
  skills_total: number;
  skills_started: number;
  skills_mastered: number;
}

export interface IvxProgress {
  ok: true;
  xp: number;
  streak_days: number;
  recommended: { skill: string; title: string; subject: string } | null;
  subjects: IvxSubjectProgress[];
  skills: IvxSkillProgress[];
}

/**
 * The four functions this file may call.
 *
 * `src/integrations/supabase/types.ts` is generated from the live schema by
 * `.github/workflows/supabase-types.yml`, so it cannot know a function until
 * that function's migration has been deployed — which is every new RPC, once.
 * The names are listed here so the gap is one greppable place with a union
 * TypeScript still checks, rather than a cast at each of four call sites, and
 * so it collapses to nothing the next time the types are regenerated.
 */
type IvxRpc = "ivx_progress" | "ivx_next_question" | "ivx_submit_answer" | "ivx_hint";

type UntypedRpc = (
  name: string,
  params: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Every RPC answers with `ok`, so a refusal is data rather than an exception. */
async function call<T>(fn: IvxRpc, args: Record<string, unknown>): Promise<T | IvxRefusal> {
  const { data, error } = await (supabase.rpc as unknown as UntypedRpc)(fn, args);
  if (error) {
    // The message, never the arguments: an RPC failure quotes what it was
    // given, and what it was given is a student's answer.
    console.error(`[ivx] ${fn} failed:`, error.message);
    return { ok: false, reason: "unavailable" };
  }
  return (data ?? { ok: false, reason: "empty" }) as T | IvxRefusal;
}

export const ivx = {
  progress: (language: string) =>
    call<IvxProgress>("ivx_progress", { _language: language }),

  nextQuestion: (options: { subject?: string | null; skill?: string | null; language: string }) =>
    call<IvxQuestion>("ivx_next_question", {
      _subject: options.subject ?? null,
      _skill: options.skill ?? null,
      _language: options.language,
    }),

  submitAnswer: (options: {
    questionId: string;
    given: string;
    hints: number;
    elapsedMs: number | null;
    language: string;
  }) =>
    call<IvxAnswerResult>("ivx_submit_answer", {
      _question_id: options.questionId,
      _given: options.given,
      _hints: options.hints,
      _elapsed_ms: options.elapsedMs,
      _language: options.language,
    }),

  hint: (questionId: string, language: string) =>
    call<{ ok: true; hint: string }>("ivx_hint", { _question_id: questionId, _language: language }),
};

/** How far through mastery a skill is, for a progress bar and for a sentence. */
export function masteryPercent(state: MasteryState, score: number): number {
  return state === "not_started" ? 0 : Math.round(score);
}

/**
 * The label a screen reader reads for a mastery state.
 *
 * Words, not a colour and not a bar: the six states are the whole point of the
 * model, and a learner who cannot see the bar still needs to know whether they
 * are developing or proficient.
 */
export const MASTERY_LABEL: Record<MasteryState, { en: string; ar: string }> = {
  not_started: { en: "Not started", ar: "لم يبدأ" },
  introduced:  { en: "Introduced", ar: "تعرّفت عليها" },
  learning:    { en: "Learning", ar: "قيد التعلّم" },
  developing:  { en: "Developing", ar: "في تقدّم" },
  proficient:  { en: "Proficient", ar: "متمكّن" },
  mastered:    { en: "Mastered", ar: "أتقنتها" },
};
