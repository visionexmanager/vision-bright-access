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
type IvxRpc =
  | "ivx_progress"
  | "ivx_next_question"
  | "ivx_submit_answer"
  | "ivx_hint"
  | "ivx_tutor_history"
  | "ivx_tutor_save_reply"
  | "ivx_guardian_invite"
  | "ivx_guardian_accept"
  | "ivx_guardian_revoke"
  | "ivx_guardian_links"
  | "ivx_guardian_students"
  | "ivx_guardian_progress"
  | "ivx_projects_list"
  | "ivx_project"
  | "ivx_project_save"
  | "ivx_project_submit"
  | "ivx_code_task"
  | "ivx_code_submit";

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

  /**
   * The inputs a code question runs against.
   *
   * Every case's arguments, and the expected output of the worked example
   * only. The rest stay in the database — which is what makes it safe to run
   * the code in the student's own browser and believe the outputs it reports.
   */
  codeTask: (questionId: string, language: string) =>
    call<IvxCodeTask>("ivx_code_task", { _question_id: questionId, _language: language }),

  /** Hand in a code answer: the source for the record, the outputs for grading. */
  submitCode: (options: {
    questionId: string;
    source: string;
    outputs: unknown[];
    hints: number;
    elapsedMs: number | null;
    language: string;
  }) =>
    call<IvxAnswerResult>("ivx_code_submit", {
      _question_id: options.questionId,
      _source: options.source,
      _outputs: options.outputs,
      _hints: options.hints,
      _elapsed_ms: options.elapsedMs,
      _language: options.language,
    }),

  /** The tutoring thread for one question, oldest turn first. */
  tutorHistory: (questionId: string) =>
    call<IvxTutorHistory>("ivx_tutor_history", { _question_id: questionId, _limit: 20 }),

  /**
   * Record the reply the student was just shown.
   *
   * The tutor streams, so the browser is the only thing that knows the reply
   * finished. It is the one tutor write a client makes, and it reaches only
   * the transcript: mastery, XP and question selection never read that table.
   */
  saveTutorReply: (questionId: string, body: string) =>
    call<{ ok: true }>("ivx_tutor_save_reply", { _question_id: questionId, _body: body }),
};

export interface IvxCodeTask {
  ok: true;
  /** The function name the student must define. */
  entry: string;
  cases: Array<{ in: unknown[]; out?: unknown; example: boolean }>;
  starter: string;
  language: string;
}

// ── Projects ────────────────────────────────────────────────────────────────
//
// A project earns XP and a score against a rubric. It does not move mastery:
// `ivx_mastery.score` answers "have I learned this skill" from evidence of one
// specific kind, and folding a graded essay into it would make one number mean
// two things. See the migration for the full reasoning.

export type IvxProjectStatus = "not_started" | "draft" | "submitted" | "graded";

export interface IvxProjectSummary {
  slug: string;
  subject: string;
  title: string;
  level: number;
  est_minutes: number;
  xp_award: number;
  skills: Array<{ slug: string; title: string }>;
  unlocked: boolean;
  status: IvxProjectStatus;
  score: number | null;
  attempt_no: number | null;
}

export interface IvxRubricCriterion {
  id: string;
  weight: number;
  criterion: string;
}

export interface IvxProjectFeedback {
  summary: string;
  criteria: Array<{ id: string; score: number; note: string }>;
}

export interface IvxProjectDetail {
  ok: true;
  slug: string;
  subject: string;
  title: string;
  brief: string;
  accessible: string;
  level: number;
  est_minutes: number;
  xp_award: number;
  rubric: IvxRubricCriterion[];
  submission: {
    id: string;
    content: string;
    status: Exclude<IvxProjectStatus, "not_started">;
    score: number | null;
    feedback: IvxProjectFeedback | Record<string, never>;
    xp_awarded: number;
    attempt_no: number;
    graded_at: string | null;
  } | null;
}

export const ivxProjects = {
  list: (language: string) =>
    call<{ ok: true; projects: IvxProjectSummary[] }>("ivx_projects_list", { _language: language }),

  get: (slug: string, language: string) =>
    call<IvxProjectDetail>("ivx_project", { _slug: slug, _language: language }),

  save: (slug: string, content: string) =>
    call<{ ok: true }>("ivx_project_save", { _slug: slug, _content: content }),

  submit: (slug: string, content: string) =>
    call<{ ok: true }>("ivx_project_submit", { _slug: slug, _content: content }),
};

export interface IvxGradeResult {
  ok: true;
  score: number;
  xp: number;
  feedback: IvxProjectFeedback;
}

/**
 * Ask for the submitted work to be graded.
 *
 * The client sends a slug. It does not send the work, the rubric or a score:
 * `ai-chat` reads the first two with the service role and writes the third
 * through a function no browser can call. What comes back is what was stored.
 */
export async function gradeIvxProject(
  slug: string,
  language: string,
): Promise<IvxGradeResult | { ok: false; error: string }> {
  const { callEdge } = await import("@/lib/api/edgeFunctions");
  try {
    // Not `stream: true`: a grade is a single object, written to the database
    // before it is returned. There is nothing to stream.
    const result = await callEdge({
      fn: "ai-chat",
      auth: "user-jwt",
      body: {
        assistantId: "ivx-project-grader",
        messages: [],
        context: { ivxProjectSlug: slug, language },
      },
    });
    return result as IvxGradeResult;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unavailable" };
  }
}

// ── Parents and teachers ────────────────────────────────────────────────────
//
// The link is issued by the student and redeemed by the guardian, never the
// other way round, and either side can end it. None of these calls takes a
// student id except `guardianProgress`, which names the person being looked
// at and is checked against an active link before it reads anything.

export type IvxGuardianRelation = "parent" | "teacher";

export interface IvxGuardianLink {
  id: string;
  relation: IvxGuardianRelation;
  label: string;
  status: "pending" | "active";
  /** Present only while the invitation is unredeemed and unexpired. */
  code: string | null;
  expires_at: string | null;
  guardian_name: string | null;
  accepted_at: string | null;
}

export interface IvxWatchedStudent {
  link_id: string;
  student_id: string;
  name: string;
  relation: IvxGuardianRelation;
  xp: number;
  streak_days: number;
  last_practised_at: string | null;
}

export interface IvxGuardianProgress {
  ok: true;
  student_id: string;
  name: string;
  xp: number;
  streak_days: number;
  attempts_30d: number;
  correct_30d: number;
  last_practised_at: string | null;
  subjects: Array<{
    slug: string; title: string;
    skills_total: number; skills_started: number; skills_mastered: number;
  }>;
  struggling: Array<{
    skill: string; title: string; subject: string;
    state: MasteryState; score: number; attempts: number; correct: number;
  }>;
  mastered: Array<{ skill: string; title: string; subject: string; at: string }>;
}

export const ivxGuardians = {
  invite: (relation: IvxGuardianRelation, label: string) =>
    call<{ ok: true; code: string; expires_at: string }>("ivx_guardian_invite", {
      _relation: relation,
      _label: label,
    }),

  accept: (code: string) =>
    call<{ ok: true; already: boolean }>("ivx_guardian_accept", { _code: code }),

  revoke: (id: string) => call<{ ok: true }>("ivx_guardian_revoke", { _id: id }),

  /** Who can see my progress. */
  links: () => call<{ ok: true; links: IvxGuardianLink[] }>("ivx_guardian_links", {}),

  /** Whose progress I can see. */
  students: () =>
    call<{ ok: true; students: IvxWatchedStudent[] }>("ivx_guardian_students", {}),

  progress: (studentId: string, language: string) =>
    call<IvxGuardianProgress>("ivx_guardian_progress", {
      _student_id: studentId,
      _language: language,
    }),
};

export interface IvxTutorTurn {
  role: "student" | "tutor";
  body: string;
  at: string;
}

export interface IvxTutorHistory {
  ok: true;
  turns: IvxTutorTurn[];
}

/**
 * Ask the tutor about a question.
 *
 * Note what is *not* sent: the question, the student's answer, and how they
 * have been doing on this skill. All of it is fetched inside `ai-chat` with
 * the service role, because the most important part — the correct answer — is
 * unreadable by any client on purpose, and because whether the question is
 * still open is not a claim a browser should get to make about itself.
 *
 * The reply streams. `useSSEStream` reads it.
 */
export async function askIvxTutor(
  options: {
    questionId: string;
    language: string;
    turns: IvxTutorTurn[];
    message: string;
  },
  signal?: AbortSignal,
): Promise<Response> {
  const { callAIChat } = await import("@/lib/api/edgeFunctions");
  return callAIChat(
    {
      assistantId: "ivx-tutor",
      context: { ivxQuestionId: options.questionId, language: options.language },
      messages: [
        ...options.turns.map((turn) => ({
          role: turn.role === "tutor" ? "assistant" : "user",
          content: turn.body,
        })),
        { role: "user", content: options.message },
      ],
    },
    signal,
  );
}

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
