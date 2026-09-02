import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projects = readFileSync("supabase/migrations/20261006020000_ivx_projects.sql", "utf8");
const seed = readFileSync("supabase/migrations/20261006030000_ivx_projects_seed.sql", "utf8");
const aiChat = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");
const assistants = readFileSync("supabase/functions/_shared/assistants.ts", "utf8");
const list = readFileSync("src/pages/academy/IVXProjects.tsx", "utf8");
const detail = readFileSync("src/pages/academy/IVXProject.tsx", "utf8");
const dashboard = readFileSync("src/pages/academy/IVX.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const clientApi = readFileSync("src/features/ivx/api.ts", "utf8");

/**
 * The SQL with its prose removed.
 *
 * A comment that discusses a rule is not the rule. Several assertions below
 * are "this file must not mention X", and the comments explaining *why* it
 * must not mention X say X — so without this, a migration could pass by
 * describing itself and fail once somebody tightened the wording.
 */
const stripComments = (sql: string) => sql.replace(/^\s*--.*$/gm, "");

function region(source: string, from: string, to?: string): string {
  const start = source.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const rest = source.slice(start);
  if (!to) return rest;
  const end = rest.indexOf(to);
  expect(end, `end marker not found: ${to}`).toBeGreaterThan(-1);
  const cut = rest.slice(0, end);
  expect(cut.length, `region ${from} → ${to} is empty`).toBeGreaterThan(20);
  return cut;
}

// ── A student cannot mark their own project ─────────────────────────────────

describe("grading happens where a client cannot reach", () => {
  it("keeps both grading functions off the browser's roles", () => {
    const graderBlock = region(projects, "'public.ivx_project_for_grading(uuid, text, text)'", "END LOOP;");
    expect(graderBlock).toContain("'public.ivx_project_grade(uuid, text, numeric, jsonb)'");
    expect(graderBlock).toContain("REVOKE ALL ON FUNCTION %s FROM authenticated");
    expect(graderBlock).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
  });

  it("gives submissions a read-only policy, so no client can set a score", () => {
    expect(projects).toMatch(/POLICY "ivx_project_submissions_own"[^;]*FOR SELECT/);
    expect(projects).not.toMatch(/ON public\.ivx_project_submissions FOR (INSERT|UPDATE|ALL)/);
    expect(projects).not.toMatch(/GRANT (ALL|INSERT|UPDATE)[^;]*ivx_project_submissions TO authenticated/);
  });

  it("never lets the client send the score it wants", () => {
    const grade = region(clientApi, "export async function gradeIvxProject", "\n}");
    expect(grade).toContain("ivxProjectSlug: slug");
    expect(grade).not.toMatch(/_score|score:|feedback:/);
  });

  it("clamps a score the model overshot rather than storing it", () => {
    // A model asked for 0–100 will occasionally answer 105, and a stored 105
    // quietly breaks every average built on the column afterwards.
    const grade = region(projects, "FUNCTION public.ivx_project_grade", "$$;");
    expect(grade).toContain("LEAST(100, GREATEST(0, COALESCE(_score, 0)))");
    // And each criterion is capped at its own weight before they are added.
    const branch = region(aiChat, 'assistantId === "ivx-project-grader"', "// ── Resolve provider");
    expect(branch).toContain("Math.min(weights.get(c.id as string) ?? 0");
  });

  it("adds the total up itself instead of asking the model for one", () => {
    const branch = region(aiChat, 'assistantId === "ivx-project-grader"', "// ── Resolve provider");
    expect(branch).toContain("marks.reduce(");
    // Two numbers from a model disagree, and the wrong one gets shown.
    const schema = region(branch, "schema: {", "toolName:");
    expect(schema).not.toMatch(/"?total"?|overall/);
  });

  it("does not tell the grader whose work it is", () => {
    const forGrading = region(projects, "FUNCTION public.ivx_project_for_grading", "$$;");
    const returned = region(forGrading, "RETURN jsonb_build_object(", "END;");
    expect(returned).toContain("'work'");
    expect(returned).not.toMatch(/'name'|'user_id'|'student'|academy_profiles/);
  });
});

// ── Mastery is left alone, deliberately ─────────────────────────────────────

describe("a project earns XP without touching mastery", () => {
  it("never writes the mastery or attempt tables", () => {
    // `ivx_mastery.score` answers one question from one kind of evidence. A
    // graded essay folded into it would make the number mean two things.
    expect(stripComments(projects)).not.toContain("ivx_mastery");
    expect(stripComments(projects)).not.toContain("ivx_apply_attempt");
    expect(projects).not.toContain("INSERT INTO public.ivx_attempts");
  });

  it("writes all three XP tables, not just the visible total", () => {
    const grade = region(projects, "FUNCTION public.ivx_project_grade", "$$;");
    expect(grade).toContain("academy_xp_events");
    expect(grade).toContain("user_points");
    expect(grade).toContain("academy_profiles");
  });

  it("does not reintroduce the user-id XP function that was deliberately dropped", () => {
    // 20260705000000 removed award_academy_xp(uuid, …) because any
    // authenticated caller could award XP to any account. Adding one back,
    // even service-role only, puts that shape in the schema again.
    expect(projects).not.toMatch(/FUNCTION public\.award_academy_xp\w*\s*\(\s*_user_id uuid/);
    expect(projects).not.toContain("award_academy_xp_for");
  });

  it("pays the award once, topping up rather than paying again", () => {
    const grade = region(projects, "FUNCTION public.ivx_project_grade", "$$;");
    expect(grade).toContain("- _sub.xp_awarded");
    expect(grade).toContain("_clamped >= 60");
  });
});

// ── The rubric is not a secret ──────────────────────────────────────────────

describe("the brief and the rubric", () => {
  it("shows the rubric to the student, unlike a question's answer", () => {
    const project = region(projects, "FUNCTION public.ivx_project(", "$$;");
    expect(project).toContain("'rubric'");
    expect(projects).toMatch(/POLICY "ivx_projects_read"/);
  });

  it("refuses a submission with nothing in it", () => {
    const submit = region(projects, "FUNCTION public.ivx_project_submit", "$$;");
    expect(submit).toContain("'too_short'");
    expect(submit).toContain("length(_text) < 40");
  });

  it("drops a graded piece back to a draft when the work is edited", () => {
    const save = region(projects, "FUNCTION public.ivx_project_save", "$$;");
    expect(save).toContain("status = 'graded'");
    expect(save).toContain("'draft'");
  });

  it("seeds one project per subject, in Arabic and English", () => {
    // Slugs carry digits as well as letters — `know.place-in-500-words`.
    const subjects = [...seed.matchAll(/^\('[a-z0-9.-]+', '([a-z]+)',$/gm)].map((m) => m[1]);
    expect(new Set(subjects).size).toBe(8);
    // Every localized field carries both languages. A missing translation
    // would fall back to English, which is a lesson in the wrong language.
    const localized = [...seed.matchAll(/'\{"en":.*?\}'/gs)];
    expect(localized.length).toBeGreaterThan(8);
    for (const [text] of localized) {
      expect(text, text.slice(0, 60)).toMatch(/"ar"\s*:/);
    }
  });

  it("gives every rubric weights that add to 100", () => {
    const rubrics = [...seed.matchAll(/'\[\{"id":"c1".*?\}\]'/gs)].map((m) => m[0]);
    expect(rubrics.length).toBe(8);
    for (const rubric of rubrics) {
      const total = [...rubric.matchAll(/"weight":(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
      expect(total, rubric.slice(0, 80)).toBe(100);
    }
  });

  it("asks for nothing that needs sight", () => {
    // No brief may require looking at something, and where one would, it
    // carries an `accessible` reading instead.
    const briefs = stripComments(seed);
    expect(briefs).not.toMatch(/look at the (chart|image|picture|diagram)/i);
    expect(briefs).not.toMatch(/the (red|green|blue) (one|button|line) (means|shows)/i);
    expect(seed).toContain("without a map");
    expect(seed).toContain("No table and no picture is needed");
  });
});

// ── The pages ───────────────────────────────────────────────────────────────

describe("the project pages", () => {
  it("are routed and linked from the dashboard", () => {
    expect(app).toContain('path="/academy/ivx/projects"');
    expect(app).toContain('path="/academy/ivx/projects/:slug"');
    expect(dashboard).toContain('to="/academy/ivx/projects"');
  });

  it("says the status in words rather than as a colour", () => {
    expect(list).toContain("Handed in, waiting to be marked");
    expect(list).not.toMatch(/bg-(red|green|amber|yellow)-\d00/);
  });

  it("tells a listener the mark in a sentence before any number in a heading", () => {
    const mark = region(detail, 'aria-live="assertive"', "</div>");
    const sentence = mark.indexOf("You scored");
    expect(sentence).toBeGreaterThan(-1);
    // Each criterion is read as "N out of W", not as a bare fraction.
    expect(mark).toContain('translateText("out of")');
  });

  it("labels the writing box and keeps it a plain textarea", () => {
    expect(detail).toContain('htmlFor="ivx-project-content"');
    expect(detail).toContain('id="ivx-project-content"');
    expect(detail).toContain("<textarea");
    // `dir="auto"` so Arabic work in an English interface still reads right.
    expect(detail).toContain('dir="auto"');
  });

  it("explains that a locked project needs practice, rather than dimming it", () => {
    expect(list).toContain("Practise these first");
  });
});

describe("the grader's provider chain", () => {
  it("does not open on the weakest model", () => {
    const openaiFirst = region(assistants, "const OPENAI_FIRST", "const MISTRAL_FIRST");
    expect(openaiFirst).toContain('"ivx-project-grader"');
  });

  it("is told to mark what is there, and to score absent work zero", () => {
    const branch = region(aiChat, 'assistantId === "ivx-project-grader"', "// ── Resolve provider");
    expect(branch).toContain("score it zero");
    expect(branch).toContain("do not penalise unusual formatting");
    expect(branch).toContain("never out of 100");
  });

  it("needs a project slug and refuses when nothing is submitted", () => {
    const branch = region(aiChat, 'assistantId === "ivx-project-grader"', "// ── Resolve provider");
    expect(branch).toContain("ivxProjectSlug is required");
    expect(branch).toContain("status: 409");
    expect(branch).toContain("status: 503");
  });
});
