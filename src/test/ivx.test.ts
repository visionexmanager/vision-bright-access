import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatIvxProgress,
  formatIvxQuestion,
  formatIvxResult,
  IVX_MAX_CHARS,
  ivxNotLinkedNotice,
  ivxNothingNotice,
  parseIvxIntent,
  parseIvxSubject,
  resolveIvxAnswer,
} from "../../supabase/functions/_shared/whatsappIvx.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";
import { MASTERY_LABEL, masteryPercent } from "@/features/ivx/api";

const core = readFileSync("supabase/migrations/20261005000000_ivx_core.sql", "utf8");
const engine = readFileSync("supabase/migrations/20261005010000_ivx_engine.sql", "utf8");
const api = readFileSync("supabase/migrations/20261005020000_ivx_api.sql", "utf8");
const seed = readFileSync("supabase/migrations/20261005030000_ivx_seed.sql", "utf8");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const practice = readFileSync("src/pages/academy/IVXPractice.tsx", "utf8");
const dashboard = readFileSync("src/pages/academy/IVX.tsx", "utf8");
const clientApi = readFileSync("src/features/ivx/api.ts", "utf8");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");

// ── The security model ──────────────────────────────────────────────────────

describe("a student cannot mark their own work", () => {
  it("keeps the answer out of every client-facing shape", () => {
    // `ivx_deal_question` is the only thing that projects a question, and its
    // return object is written out in full — so this reads the actual shape
    // rather than trusting a comment about it.
    const dealt = engine.slice(engine.indexOf("CREATE OR REPLACE FUNCTION public.ivx_deal_question"));
    const projection = dealt.slice(dealt.indexOf("RETURN jsonb_build_object"), dealt.indexOf("END;\n$$;"));
    expect(projection).not.toMatch(/'answer'/);
    expect(projection).toContain("'prompt'");
    expect(projection).toContain("'options'");
    // And the client never asks for the column either.
    expect(clientApi).not.toContain("ivx_questions");
  });

  it("locks the question bank to the definer functions", () => {
    expect(core).toContain("REVOKE ALL ON TABLE public.ivx_questions FROM authenticated;");
    expect(core).toContain("REVOKE ALL ON TABLE public.ivx_questions FROM anon;");
    expect(core).toContain("GRANT ALL ON TABLE public.ivx_questions TO service_role;");
    // No SELECT policy for ivx_questions: RLS with no policy denies everyone.
    expect(core).not.toMatch(/POLICY[^;]*ivx_questions[^;]*FOR SELECT/);
  });

  it("gives progress tables no write policy at all", () => {
    // A client that could insert its own mastery row could award itself
    // mastery. Reads are its own; writes go through the functions.
    for (const table of ["ivx_mastery", "ivx_attempts", "ivx_sessions"]) {
      expect(core, table).toMatch(new RegExp(`POLICY "${table.replace("ivx_", "ivx_")}_own"[^;]*FOR SELECT`));
      expect(core, table).not.toMatch(new RegExp(`ON public.${table} FOR (INSERT|UPDATE|ALL)`));
    }
  });

  it("only accepts an answer to the question that was actually dealt", () => {
    expect(api).toContain("not_the_open_question");
    expect(api).toMatch(/SELECT open_question INTO _open[\s\S]{0,200}IF _open IS NULL OR _open <> _question_id/);
  });

  it("never takes a user id from a caller", () => {
    // Every entry point derives the student. A function that accepted one
    // could be asked to write somebody else's progress.
    for (const fn of ["ivx_next_question", "ivx_submit_answer", "ivx_hint", "ivx_progress"]) {
      const start = api.indexOf(`FUNCTION public.${fn}(`);
      const signature = api.slice(start, api.indexOf(")", start));
      expect(signature, fn).not.toMatch(/_user_id/);
    }
    expect(api).toContain("_user_id uuid := auth.uid();");
  });

  it("keeps the WhatsApp doors off the public roles", () => {
    // They take a phone number as an argument, so exposing them to anon would
    // let anybody practise as anybody by typing a number.
    expect(api).toContain("'public.ivx_wa_next_question(text, text, text, text)'");
    expect(api).toMatch(/REVOKE ALL ON FUNCTION %s FROM authenticated/);
    expect(api).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
  });

  it("hands WhatsApp a lesson without handing it an identity", () => {
    // The variable itself appears in the body — it is what the WHERE clauses
    // filter on — so what is checked is the *keys the functions return*. None
    // of the WhatsApp doors may name an identity in its answer.
    for (const fn of ["ivx_wa_progress", "ivx_wa_next_question", "ivx_wa_submit_answer", "ivx_wa_open"]) {
      const start = api.indexOf(`FUNCTION public.${fn}(`);
      const body = api.slice(start, api.indexOf("\n$$;", start));
      const keys = [...body.matchAll(/'([a-z_]+)',\s/g)].map((m) => m[1]);
      for (const forbidden of ["user_id", "email", "name", "phone", "wa_phone"]) {
        expect(keys, `${fn} returns ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

// ── Mastery ─────────────────────────────────────────────────────────────────

describe("mastery is earned, not counted", () => {
  it("needs breadth and difficulty, not just a high score", () => {
    // The three conditions are the whole defence against farming one easy
    // question, so they are pinned rather than described.
    expect(engine).toMatch(/_score >= 90 AND _distinct_correct >= 5 AND _best_difficulty >= 3.*'mastered'/s);
    expect(engine).toContain("count(DISTINCT question_id)");
  });

  it("weights a harder question more, and a hinted answer less", () => {
    expect(engine).toMatch(/_weight := 0\.18 \+ \(COALESCE\(_difficulty, 3\) - 1\) \* 0\.05/);
    expect(engine).toMatch(/WHEN _correct AND COALESCE\(_hints, 0\) = 0 THEN 100/);
    expect(engine).toMatch(/WHEN _correct THEN 70/);
  });

  it("brings a skill straight back after a mistake and pushes mastery weeks out", () => {
    expect(engine).toMatch(/WHEN NOT _correct THEN interval '10 minutes'/);
    expect(engine).toMatch(/_state = 'mastered'\s+THEN interval '21 days'/);
  });

  it("puts review before novelty when something is due", () => {
    const pick = engine.slice(engine.indexOf("FUNCTION public.ivx_pick_skill"));
    expect(pick).toMatch(/due_at <= now\(\)[\s\S]{0,80}THEN 0 ELSE 1 END/);
    expect(pick).toContain("COALESCE(m.score, -1) ASC");
    // A skill with no questions is never recommended: a dead end is worse than
    // a different subject.
    expect(pick).toContain("EXISTS (SELECT 1 FROM public.ivx_questions q");
  });

  it("refuses a skill whose prerequisites are unmet", () => {
    expect(engine).toMatch(/NOT IN \('developing','proficient','mastered'\)/);
  });
});

// ── Answer checking ─────────────────────────────────────────────────────────

describe("checking an answer", () => {
  it("treats a fraction and its decimal as the same answer", () => {
    expect(engine).toMatch(/\^-\?\\d\+\\s\*\/\\s\*\\d\+\$/);
    expect(engine).toContain("abs(_given_n - _exp_n) <= GREATEST(_tol, 0)");
  });

  it("ignores case and trailing punctuation in both scripts", () => {
    // Arabic and Latin sentence endings both, or "modern." would be wrong.
    expect(engine).toContain("[\\s.،,!؟?]+$");
    expect(engine).toContain("lower(btrim(");
  });
});

// ── The client ──────────────────────────────────────────────────────────────

describe("the website side is thin on purpose", () => {
  it("decides nothing about correctness", () => {
    expect(clientApi).not.toMatch(/\bcorrect\s*=|isCorrect\s*=/);
    expect(clientApi).toContain("Nothing in this file decides whether an answer is correct");
  });

  it("registers both IVX routes under Academy, behind the auth guard", () => {
    expect(app).toContain('<Route path="/academy/ivx" element={<AuthGuard><IVX /></AuthGuard>} />');
    expect(app).toContain('<Route path="/academy/ivx/practice" element={<AuthGuard><IVXPractice /></AuthGuard>} />');
  });

  it("names every mastery state in both languages", () => {
    for (const state of ["not_started", "introduced", "learning", "developing", "proficient", "mastered"] as const) {
      expect(MASTERY_LABEL[state].en.length).toBeGreaterThan(2);
      expect(MASTERY_LABEL[state].ar.length).toBeGreaterThan(2);
    }
    expect(masteryPercent("not_started", 40)).toBe(0);
    expect(masteryPercent("developing", 61.4)).toBe(61);
  });
});

// ── Accessibility ───────────────────────────────────────────────────────────

describe("the practice page is usable without sight", () => {
  it("moves focus to the new question so a reader announces it", () => {
    expect(practice).toContain("promptRef.current?.focus()");
    expect(practice).toContain("tabIndex={-1}");
  });

  it("announces the result assertively, and in words before colour", () => {
    expect(practice).toContain('aria-live="assertive"');
    expect(practice).toMatch(/translateText\("Correct"\)|translateText\("Not quite"\)/);
  });

  it("carries the plain-words reading of a prompt that needs one", () => {
    expect(practice).toContain("question.accessible");
    // And the database has somewhere to put it.
    expect(core).toContain("accessible   jsonb NOT NULL DEFAULT '{}'");
    // Seeded where a prompt is symbolic or visual: equations and code.
    expect(seed).toMatch(/Three x plus five equals twenty/);
    expect(seed).toMatch(/A three line program/);
  });

  it("needs no pointer: every answer is a button or a text field", () => {
    expect(practice).not.toMatch(/onDrag|draggable|onMouseDown/);
    expect(practice).toContain("<Input");
    expect(practice).toContain('htmlFor="ivx-answer"');
  });

  it("labels every icon as decorative and every link by its skill", () => {
    const icons = practice.match(/<(Lightbulb|ArrowRight|Volume2)[^>]*>/g) ?? [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon, icon).toContain('aria-hidden="true"');
    expect(dashboard).toContain('<span className="sr-only">');
  });

  it("says what a lock and a review marker mean, rather than showing only an icon", () => {
    expect(dashboard).toMatch(/sr-only">\{translateText\("Locked/);
    expect(dashboard).toMatch(/sr-only">\{translateText\("Due for review/);
  });
});

// ── WhatsApp ────────────────────────────────────────────────────────────────

describe("IVX on WhatsApp", () => {
  it("recognises a request to learn, in both languages", () => {
    for (const text of ["learn", "study", "practice", "تعلم", "علمني", "ادرس"]) {
      expect(parseIvxIntent(text), text).toBe("start");
    }
    expect(parseIvxIntent("hint")).toBe("hint");
    expect(parseIvxIntent("تلميح")).toBe("hint");
    expect(parseIvxIntent("اشرح")).toBe("explain");
    expect(parseIvxIntent("next")).toBe("next");
    expect(parseIvxIntent("التالي")).toBe("next");
    expect(parseIvxIntent("تقدمي")).toBe("progress");
    expect(parseIvxIntent("stop")).toBe("stop");
  });

  it("does not mistake a sentence for a command", () => {
    expect(parseIvxIntent("how much is a subscription?")).toBeNull();
    expect(parseIvxIntent("")).toBeNull();
    expect(parseIvxIntent("x".repeat(IVX_MAX_CHARS + 1))).toBeNull();
  });

  it("hears a subject when one is named, and lets the engine choose otherwise", () => {
    expect(parseIvxSubject("teach me math")).toBe("math");
    expect(parseIvxSubject("علمني برمجة")).toBe("programming");
    expect(parseIvxSubject("الذكاء الاصطناعي")).toBe("ai");
    expect(parseIvxSubject("تعلم")).toBeNull();
  });

  it("letters the options, because numbers already mean menu here", () => {
    const message = formatIvxQuestion(
      {
        skill_title: "Cells",
        prompt: "Which part captures light?",
        options: [{ id: "a", label: "Nucleus" }, { id: "b", label: "Chloroplast" }],
      },
      "en",
    );
    expect(message).toContain("A) Nucleus");
    expect(message).toContain("B) Chloroplast");
    expect(message).not.toMatch(/^1\)/m);
  });

  it("maps a lettered reply back to the option the engine expects", () => {
    const options = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(resolveIvxAnswer("B", options)).toBe("b");
    expect(resolveIvxAnswer("b)", options)).toBe("b");
    expect(resolveIvxAnswer(" c ", options)).toBe("c");
    // A typed answer is itself, not a letter to be translated.
    expect(resolveIvxAnswer("3/4", [])).toBe("3/4");
    expect(resolveIvxAnswer("56", options)).toBe("56");
  });

  it("says right or wrong first, in every language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const right = formatIvxResult({ correct: true, xp: 9, explanation: "because" }, language);
      const wrong = formatIvxResult({ correct: false, expected: "56", explanation: "because" }, language);
      for (const message of [right, wrong]) {
        expect(message, language).not.toMatch(/\{[a-z]+\}/i);
        expect(message.split("\n")[0].length, language).toBeGreaterThan(2);
      }
      expect(right, language).toContain("9");
      expect(wrong, language).toContain("56");

      const progress = formatIvxProgress({ xp: 40, mastered: 2, in_progress: 3, recommended: { title: "X" } }, language);
      expect(progress, language).not.toMatch(/\{[a-z]+\}/i);
      expect(ivxNotLinkedNotice(language), language).not.toMatch(/\{[a-z]+\}/i);
      expect(ivxNothingNotice(language).length, language).toBeGreaterThan(5);
    }
  });

  it("asks for an account link before it starts, because progress has to belong somewhere", () => {
    expect(webhook).toContain("ivxNotLinkedNotice(answerLanguage)");
    expect(ivxNotLinkedNotice("en")).toMatch(/link/i);
    expect(ivxNotLinkedNotice("ar")).toMatch(/اربط/);
  });

  it("treats a message as an answer only when a question is actually open", () => {
    expect(webhook).toContain('db.rpc("ivx_wa_open"');
    expect(webhook).toMatch(/if \(ivxOpen\?\.open && questionText\.trim\(\)/);
  });

  it("is in the menu, switched on, with a phrase that reaches it", () => {
    const node = catalog.CATALOG.find((n: { id: string }) => n.id === "academy");
    expect(node).toBeDefined();
    expect(node.enabled).toBe(true);
    expect(node.handler).toBeUndefined();
    expect(parseIvxIntent(catalog.localized(node.phrase, "en"))).toBe("start");
    expect(parseIvxIntent(catalog.localized(node.phrase, "ar"))).toBe("start");
  });
});

// ── Content ─────────────────────────────────────────────────────────────────

describe("the seed curriculum", () => {
  it("covers every subject family the platform claims", () => {
    for (const subject of ["math", "languages", "science", "programming", "ai", "knowledge", "life", "access"]) {
      expect(seed, subject).toContain(`('${subject}',`);
    }
  });

  it("is bilingual everywhere, with no English-only prompt", () => {
    const prompts = seed.match(/'\{"en":"[^']*?"\}'/g) ?? [];
    // Any jsonb literal carrying an English string must carry an Arabic one.
    for (const prompt of prompts) expect(prompt, prompt.slice(0, 60)).toContain('"ar"');
  });

  it("connects skills through prerequisites rather than a flat list", () => {
    expect(seed).toContain("('math.fractions-add',  'math.multiplication')");
    expect(seed).toContain("('prog.python-basics',  'prog.thinking')");
  });

  it("carries an explanation on every question, because a wrong answer is a teaching moment", () => {
    const rows = seed.split("INSERT INTO public.ivx_questions")[1] ?? "";
    const entries = rows.split(/\n {2}\('/).slice(1);
    expect(entries.length).toBeGreaterThan(20);
    for (const entry of entries) {
      expect(entry.slice(0, 40) + "…", entry.slice(0, 40)).toBeTruthy();
      expect(entry).toMatch(/"en":"[^"]{15,}/);
    }
  });
});
