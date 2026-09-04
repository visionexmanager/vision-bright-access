import { readFileSync as readRaw } from "node:fs";
import { describe, expect, it } from "vitest";
import { ivxTutorDirective, type IvxTutorBrief } from "../../supabase/functions/_shared/whatsappIvx.ts";

/**
 * Source, with line endings normalised.
 *
 * The region markers below are multi-line literals written with `\n` —
 * `")\nRETURNS"` most of all. Git checks these files out with CRLF on Windows,
 * so `indexOf` returned -1 and two checks failed on a repository nobody had
 * touched, in a way that reads exactly like a renamed function. The assertions
 * are about SQL and TSX structure; line endings are not part of the contract.
 */
const source = (path: string) => readRaw(path, "utf8").replace(/\r\n/g, "\n");

const tutor = source("supabase/migrations/20261006000000_ivx_tutor.sql");
const aiChat = source("supabase/functions/ai-chat/index.ts");
const assistants = source("supabase/functions/_shared/assistants.ts");
const webhook = source("supabase/functions/whatsapp-webhook/index.ts");
const clientApi = source("src/features/ivx/api.ts");
const panel = source("src/features/ivx/IVXTutor.tsx");

/**
 * Cut a named region out of a file, and fail if it is not there.
 *
 * Most of the checks below are "this region must NOT contain X", and a slice
 * whose start marker has moved returns an empty string — against which every
 * such check passes while proving nothing. Renaming a function is exactly how
 * that happens, so the marker being missing is itself the failure.
 */
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

// ── The one rule the whole tutor rests on ───────────────────────────────────
//
// A model that has been told the answer will eventually say it, however the
// prompt is worded. So while a question is open the answer is not in the
// context at all — and the decision about which of those two situations this
// is belongs to the database, because it is the one place a caller cannot
// argue with.

describe("the tutor is not told the answer while the question is open", () => {
  it("adds the answer only inside the explain branch", () => {
    const body = region(tutor, "FUNCTION public.ivx_tutor_brief", "$$;");

    // The base object is built first, and the answer is concatenated onto it
    // afterwards under an explicit mode test. If the answer ever moves into
    // the base object, this fails.
    const base = region(body, "_brief := jsonb_build_object", "IF _mode = 'explain'");
    expect(base).not.toContain("_q.answer");
    expect(base).not.toContain("explanation");
    expect(base).toContain("'prompt'");

    const explain = region(body, "IF _mode = 'explain'");
    expect(explain).toContain("_q.answer ->> 'value'");
  });

  it("derives the mode from the student's own rows rather than an argument", () => {
    const signature = region(tutor, "FUNCTION public.ivx_tutor_brief(", ")\nRETURNS");
    expect(signature).not.toContain("_mode");

    // Open beats answered: a question dealt again is being worked on now, so
    // it goes back behind the socratic wall even though an attempt exists.
    expect(tutor).toMatch(/IF _is_open THEN\s+_mode := 'socratic';\s+ELSIF _attempt\.id IS NOT NULL THEN\s+_mode := 'explain';/);
  });

  it("refuses a question the student was never dealt", () => {
    expect(tutor).toContain("'not_your_question'");
    // Neither open nor attempted is the refusal case, so tutoring cannot be
    // used to walk the question bank.
    const fn = tutor.slice(tutor.indexOf("FUNCTION public.ivx_tutor_brief"));
    expect(fn.slice(0, fn.indexOf("$$;"))).toMatch(/ELSE\s+RETURN jsonb_build_object\('ok', false, 'reason', 'not_your_question'\)/);
  });
});

describe("who may call what", () => {
  it("keeps every function that names a student off the browser's roles", () => {
    for (const fn of [
      "public.ivx_tutor_brief(uuid, uuid, text)",
      "public.ivx_tutor_log(uuid, uuid, text, text, text)",
      "public.ivx_wa_tutor_brief(text, text)",
      "public.ivx_wa_tutor_log(text, uuid, text, text)",
    ]) {
      expect(tutor, fn).toContain(`'${fn}'`);
    }
    expect(tutor).toContain("REVOKE ALL ON FUNCTION %s FROM anon");
    expect(tutor).toContain("REVOKE ALL ON FUNCTION %s FROM authenticated");
    // A revoke from PUBLIC also revokes service_role, so the grant back is not
    // optional — without it every one of these fails in production.
    expect(tutor).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
  });

  it("lets a browser reach only the two that derive the student from the session", () => {
    const browserBlock = tutor.slice(tutor.indexOf("'public.ivx_tutor_history(uuid, integer)'"));
    expect(browserBlock).toContain("'public.ivx_tutor_save_reply(uuid, text)'");
    expect(browserBlock).toContain("GRANT EXECUTE ON FUNCTION %s TO authenticated");

    for (const fn of ["ivx_tutor_history", "ivx_tutor_save_reply"]) {
      expect(region(tutor, `FUNCTION public.${fn}(`, ")\nRETURNS"), fn).not.toMatch(/_user_id|_wa_phone/);
    }
    expect(tutor).toContain("_user_id uuid := (select auth.uid());");
  });

  it("gives the transcript a read-only policy and no write policy at all", () => {
    expect(tutor).toMatch(/POLICY "ivx_tutor_turns_own"[^;]*FOR SELECT/);
    expect(tutor).not.toMatch(/ON public\.ivx_tutor_turns FOR (INSERT|UPDATE|ALL)/);
    // Wrapped, so it is evaluated once rather than per row.
    expect(tutor).toContain("(select auth.uid()) = user_id");
  });

  it("only accepts a saved reply that answers something the student asked", () => {
    const fn = tutor.slice(tutor.indexOf("FUNCTION public.ivx_tutor_save_reply"));
    const body = fn.slice(0, fn.indexOf("$$;"));
    expect(body).toContain("'no_turn_outstanding'");
    expect(body).toContain("IF _last_role IS DISTINCT FROM 'student'");
    // And it reuses the brief's rule rather than restating it, so the two
    // cannot drift apart.
    expect(body).toContain("public.ivx_tutor_brief(_user_id, _question_id, 'en')");
  });
});

// ── The website ─────────────────────────────────────────────────────────────

describe("the browser never assembles the tutor's context", () => {
  it("fetches the brief inside ai-chat with the service role", () => {
    const branch = aiChat.slice(aiChat.indexOf('assistantId === "ivx-tutor"'));
    expect(branch).toContain('serviceClient.rpc("ivx_tutor_brief"');
    expect(branch).toContain("_user_id: user.id");
    // A refused brief is a refusal, not an empty conversation.
    expect(branch).toContain("status: 403");
  });

  it("requires a question id rather than tutoring in the abstract", () => {
    const branch = aiChat.slice(aiChat.indexOf('assistantId === "ivx-tutor"'));
    expect(branch).toContain("ivxQuestionId is required");
    expect(branch).toContain("status: 400");
  });

  it("sends only a question id and a sentence from the client", () => {
    const ask = region(clientApi, "export async function askIvxTutor");
    expect(ask).toContain('assistantId: "ivx-tutor"');
    expect(ask).toContain("ivxQuestionId: options.questionId");
    // The three things a browser must never claim to know about itself.
    expect(ask).not.toMatch(/expected|explanation|\bmode\b/);
  });

  it("takes no mode prop, because that is the database's decision", () => {
    expect(panel).toContain("{ questionId }: { questionId: string }");
    expect(panel).not.toMatch(/mode\s*[?:]/);
  });
});

describe("the tutor panel is usable without sight", () => {
  it("announces finished turns politely and keeps the streaming draft out of the log", () => {
    // Polite, not assertive: the assertive region on the practice page belongs
    // to correct/not quite, and a tutor reply must not cut across it.
    expect(panel).toContain('role="log"');
    expect(panel).toContain('aria-live="polite"');
    expect(panel).not.toContain('aria-live="assertive"');
    // A half-written sentence re-announced on every token is unusable.
    const draft = panel.slice(panel.indexOf("{streamed && ("));
    expect(draft.slice(0, 200)).toContain('aria-hidden="true"');
  });

  it("says who is speaking, and labels its one input", () => {
    expect(panel).toContain("You said");
    expect(panel).toContain("Tutor said");
    expect(panel).toContain('htmlFor="ivx-tutor-input"');
    expect(panel).toContain('id="ivx-tutor-input"');
    expect(panel).toContain('role="alert"');
  });

  it("sits outside the practice page's assertive region", () => {
    const practice = source("src/pages/academy/IVXPractice.tsx");
    const live = practice.indexOf('aria-live="assertive"');
    const closeOfLive = practice.indexOf("</div>", practice.indexOf("</section>", live) - 200);
    expect(practice.indexOf("<IVXTutor")).toBeGreaterThan(closeOfLive);
  });
});

// ── The provider chain ──────────────────────────────────────────────────────

describe("the assistant registration", () => {
  it("registers ivx-tutor and puts a capable model first", () => {
    expect(assistants).toContain('"ivx-tutor": assistant(');
    // Not the default chain: it opens on an 8B model, and a tutor that
    // explains arithmetic wrongly does not fail visibly — a student believes
    // it. Gemini is deliberately not first anywhere: it stays out of automatic
    // routing until a live generation probe passes.
    const openaiFirst = assistants.slice(assistants.indexOf("const OPENAI_FIRST"), assistants.indexOf("const MISTRAL_FIRST"));
    expect(openaiFirst).toContain('"ivx-tutor"');
  });

  it("states the socratic rule as a fact rather than a request", () => {
    const prompt = assistants.slice(assistants.indexOf('"ivx-tutor": assistant('), assistants.indexOf("};", assistants.indexOf('"ivx-tutor": assistant(')));
    expect(prompt).toContain("You do NOT have the answer");
    expect(prompt).toContain("MODE: explain");
    // Written for a listener: this reply is read aloud as often as it is read.
    expect(prompt).toMatch(/screen reader|listening/);
  });
});

// ── WhatsApp ────────────────────────────────────────────────────────────────

describe("the WhatsApp tutor directive", () => {
  const base: IvxTutorBrief = {
    ok: true,
    question_id: "q1",
    skill_title: "Adding fractions",
    objective: "Add fractions with unlike denominators",
    prompt: "1/2 + 1/4 = ?",
    accessible: "one half plus one quarter",
    hint: "Make the denominators the same first.",
    options: [{ id: "a", label: "3/4" }, { id: "b", label: "2/6" }],
  };

  it("carries no answer at all in socratic mode", () => {
    const directive = ivxTutorDirective({ ...base, mode: "socratic" }, "en");
    expect(directive).not.toMatch(/CORRECT ANSWER|STORED EXPLANATION|THEY ANSWERED/);
    expect(directive).toContain("you have not been given the correct answer");
    expect(directive).toContain("one half plus one quarter");
  });

  it("cannot leak an answer that a socratic brief still carried by mistake", () => {
    // Defence in depth: even handed a brief with the answer on it, the
    // socratic directive must not put it in front of the model.
    const directive = ivxTutorDirective(
      { ...base, mode: "socratic", expected: "3/4", explanation: "Because quarters." },
      "en",
    );
    expect(directive).not.toContain("Because quarters.");
    expect(directive).not.toMatch(/CORRECT ANSWER/);
  });

  it("explains freely once the student has already seen the answer", () => {
    const directive = ivxTutorDirective(
      { ...base, mode: "explain", expected: "3/4", explanation: "Quarters first.", student_answer: "2/6", was_correct: false },
      "en",
    );
    expect(directive).toContain("CORRECT ANSWER: 3/4");
    expect(directive).toContain("THEY ANSWERED: 2/6 (wrong)");
    expect(directive).toContain("Do not just repeat the stored explanation");
  });

  it("names a repeating mistake, which is the useful part", () => {
    const directive = ivxTutorDirective(
      {
        ...base, mode: "explain", expected: "3/4",
        struggle: { recent_wrong: 3, recent_total: 5, recent_wrong_answers: ["2/6", "2/6", "1/6"] },
      },
      "en",
    );
    expect(directive).toContain("wrong 3 times recently");
    expect(directive).toContain("2/6, 2/6, 1/6");
  });

  it("asks for something a phone and a screen reader can take", () => {
    const directive = ivxTutorDirective({ ...base, mode: "explain" }, "ar");
    expect(directive).toContain("Reply in ar");
    expect(directive).toMatch(/no headings, no tables, no markdown/);
    expect(directive).toContain("read aloud");
  });
});

describe("IVX on WhatsApp, the explain path", () => {
  const block = webhook.slice(webhook.indexOf('if (ivxIntent === "explain") {'));
  const branch = block.slice(0, block.indexOf('if (ivxIntent === "start"'));

  it("asks the database what may be said before asking a model anything", () => {
    expect(branch).toContain('db.rpc("ivx_wa_tutor_brief"');
    expect(branch.indexOf("ivx_wa_tutor_brief")).toBeLessThan(branch.indexOf("askAssistant"));
    expect(branch).toContain("ivxTutorDirective(brief, answerLanguage)");
  });

  it("charges the allowance before the ask and records it only after an answer", () => {
    expect(branch).toContain("if (!(await maySpend())) continue;");
    const spentAt = branch.indexOf('spent("ai")');
    expect(spentAt).toBeGreaterThan(branch.indexOf('asked.status === "answered"'));
  });

  it("records both sides so the next question continues the thread", () => {
    expect(branch).toMatch(/_role: "student"/);
    expect(branch).toMatch(/_role: "tutor"/);
    expect(branch).toContain('db.rpc("ivx_wa_tutor_history"');
  });

  it("falls back to the stored explanation when a provider fails", () => {
    // A provider outage should not cost a student the explanation that was
    // sitting in the database the whole time.
    expect(branch).toContain('brief.mode === "explain" && brief.explanation');
    expect(branch).toContain("failureNotice(answerLanguage)");
  });

  it("tells an unlinked number to link, and lets nothing-open mean teach me", () => {
    expect(branch).toContain('brief?.reason === "not_linked"');
    expect(branch).toContain("ivxNotLinkedNotice(answerLanguage)");
    // No `continue` for nothing_open: it falls through to the branch that
    // deals a new question.
    expect(branch).toContain("`nothing_open` falls through");
  });
});
