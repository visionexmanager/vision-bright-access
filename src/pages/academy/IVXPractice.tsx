import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Lightbulb, ArrowRight, Volume2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { speakText } from "@/lib/audio/speech";
import { ivx, MASTERY_LABEL, type IvxAnswerResult, type IvxQuestion } from "@/features/ivx/api";
import { IVXTutor } from "@/features/ivx/IVXTutor";
import { IVXCodeAnswer } from "@/features/ivx/IVXCodeAnswer";

/**
 * One question at a time.
 *
 * ── What accessibility means on this page ───────────────────────────────────
 *
 * A practice page is a loop of read, answer, hear the result. Every part of
 * that loop is built for somebody who cannot see it happen:
 *
 *   * The question is a heading that takes focus when it arrives, so a screen
 *     reader starts reading the new question instead of leaving the listener
 *     wondering whether anything changed.
 *   * The result is an assertive live region and states correct or incorrect in
 *     words before anything else — never as a colour, never as an icon alone.
 *   * `accessible` from the database replaces a prompt that would only make
 *     sense on screen: "3x + 5 = 20" is read as words, and a code sample is
 *     described before it is shown.
 *   * Answering is typing or choosing a button. Nothing here needs a pointer,
 *     a drag, or a chart.
 *   * "Read aloud" uses the platform's own speech, for a learner who wants the
 *     question spoken without turning a screen reader on.
 */
export default function IVXPractice() {
  const { lang, dir, translateText } = useLanguage();
  const language = lang === "ar" ? "ar" : lang;
  const [params] = useSearchParams();

  const [question, setQuestion] = useState<IvxQuestion | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [result, setResult] = useState<IvxAnswerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const startedAt = useRef<number>(Date.now());
  const promptRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setResult(null);
    setHint(null);
    setHintsUsed(0);
    setTyped("");
    const next = await ivx.nextQuestion({
      subject: params.get("subject"),
      skill: params.get("skill"),
      language,
    });
    setBusy(false);
    if (next.ok) {
      setQuestion(next as IvxQuestion);
      setRefusal(null);
      startedAt.current = Date.now();
    } else {
      setQuestion(null);
      setRefusal((next as { reason: string }).reason);
    }
  }, [language, params]);

  useEffect(() => { void load(); }, [load]);

  // The new question takes focus, so the next thing a screen reader says is the
  // question — not silence after the previous answer.
  //
  // Keyed on the id rather than on `question`: focusing again because an
  // unrelated piece of state changed would interrupt somebody mid-sentence,
  // which is worse than not moving focus at all.
  const questionId = question?.question_id;
  useEffect(() => {
    if (questionId) promptRef.current?.focus();
  }, [questionId]);

  const submit = async (given: string) => {
    if (!question || busy || !given.trim()) return;
    setBusy(true);
    const outcome = await ivx.submitAnswer({
      questionId: question.question_id,
      given,
      hints: hintsUsed,
      elapsedMs: Date.now() - startedAt.current,
      language,
    });
    setBusy(false);
    if (outcome.ok) {
      const answer = outcome as IvxAnswerResult;
      setResult(answer);
      setAnswered((n) => n + 1);
      if (answer.correct) setCorrectCount((n) => n + 1);
    } else {
      setRefusal((outcome as { reason: string }).reason);
    }
  };

  const submitCode = async (outputs: unknown[], source: string) => {
    if (!question || busy) return;
    setBusy(true);
    const outcome = await ivx.submitCode({
      questionId: question.question_id,
      source,
      outputs,
      hints: hintsUsed,
      elapsedMs: Date.now() - startedAt.current,
      language,
    });
    setBusy(false);
    if (outcome.ok) {
      const answer = outcome as IvxAnswerResult;
      setResult(answer);
      setAnswered((n) => n + 1);
      if (answer.correct) setCorrectCount((n) => n + 1);
    } else {
      setRefusal((outcome as { reason: string }).reason);
    }
  };

  const askForHint = async () => {
    if (!question) return;
    const got = await ivx.hint(question.question_id, language);
    if (got.ok) {
      setHint((got as { hint: string }).hint);
      setHintsUsed((n) => n + 1);
    }
  };

  const spoken = question ? `${question.accessible || question.prompt}` : "";

  return (
    <Layout>
      <main className="mx-auto max-w-2xl px-4 py-10" dir={dir}>
        <p className="text-sm text-muted-foreground">
          <Link to="/academy/ivx" className="underline">IVX</Link>
          {question && <> — {question.skill_title}</>}
        </p>

        {/* Session tally, as a sentence a listener can act on. */}
        <p className="mt-1 text-sm text-muted-foreground" role="status">
          {`${translateText("Answered")}: ${answered} · ${translateText("Correct")}: ${correctCount}`}
        </p>

        {refusal && (
          <div className="mt-8 rounded-xl border border-border p-5" role="status">
            <p>
              {refusal === "not_authenticated"
                ? translateText("Sign in to practise with IVX.")
                : refusal === "nothing_available"
                  ? translateText("Nothing to practise here yet. Try another subject.")
                  : translateText("Practice is unavailable right now. Please try again shortly.")}
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/academy/ivx">{translateText("Back to IVX")}</Link>
            </Button>
          </div>
        )}

        {question && (
          <section className="mt-6" aria-labelledby="ivx-prompt">
            <h1
              id="ivx-prompt"
              ref={promptRef}
              tabIndex={-1}
              className="whitespace-pre-wrap text-2xl font-bold outline-none"
            >
              {question.prompt}
            </h1>

            {/* Present for everyone, not hidden: a plain-words reading of a
                prompt helps more people than it costs. */}
            {question.accessible && (
              <p className="mt-2 text-sm text-muted-foreground">{question.accessible}</p>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => speakText(spoken, lang, { rate: 0.95 })}
            >
              <Volume2 className="me-2 h-4 w-4" aria-hidden="true" />
              {translateText("Read aloud")}
            </Button>

            {question.kind === "code" ? (
              /* A code question is answered by running code, not by typing an
                 answer. The run happens in the student's own browser; whether
                 it was right is decided in the database against outputs this
                 page was never sent. */
              <IVXCodeAnswer
                questionId={question.question_id}
                disabled={busy || !!result}
                onSubmitted={(outputs, source) => void submitCode(outputs, source)}
              />
            ) : question.options.length > 0 ? (
              <ul className="mt-6 space-y-3" role="list">
                {question.options.map((option) => (
                  <li key={option.id}>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto w-full justify-start whitespace-normal py-3 text-start"
                      disabled={busy || !!result}
                      onClick={() => void submit(option.id)}
                    >
                      {option.label}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <form
                className="mt-6 flex flex-wrap gap-3"
                onSubmit={(event) => { event.preventDefault(); void submit(typed); }}
              >
                <label htmlFor="ivx-answer" className="sr-only">
                  {translateText("Your answer")}
                </label>
                <Input
                  id="ivx-answer"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  disabled={busy || !!result}
                  autoComplete="off"
                  className="flex-1"
                  placeholder={translateText("Type your answer")}
                />
                <Button type="submit" disabled={busy || !!result || !typed.trim()}>
                  {translateText("Check")}
                </Button>
              </form>
            )}

            {!result && question.has_hint && (
              <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={() => void askForHint()}>
                <Lightbulb className="me-2 h-4 w-4" aria-hidden="true" />
                {translateText("Hint")}
              </Button>
            )}

            {hint && (
              <p className="mt-3 rounded-lg bg-muted p-3 text-sm" role="status">{hint}</p>
            )}

            {/* Assertive: the outcome of an answer is the one thing that must
                interrupt whatever the reader was saying. */}
            <div aria-live="assertive" className="mt-6">
              {result && (
                <div className="rounded-xl border border-border p-5">
                  <p className="text-lg font-bold">
                    {result.correct
                      ? `${translateText("Correct")} — +${result.xp} XP`
                      : translateText("Not quite")}
                  </p>
                  {!result.correct && result.expected && (
                    <p className="mt-1">
                      {translateText("The answer is")}: <strong>{result.expected}</strong>
                    </p>
                  )}
                  {result.explanation && <p className="mt-2">{result.explanation}</p>}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {translateText("Mastery")}:{" "}
                    {lang === "ar"
                      ? MASTERY_LABEL[result.mastery.state].ar
                      : MASTERY_LABEL[result.mastery.state].en}{" "}
                    — {Math.round(result.mastery.score)}%
                  </p>
                  <Button className="mt-4" onClick={() => void load()} disabled={busy}>
                    {translateText("Next question")}
                    <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>

            {/* Outside the assertive region, and present in both phases. Which
                conversation this has — walk me to it, or explain what I got
                wrong — is decided by the database from the student's own
                session, not by anything this page passes down. */}
            <IVXTutor questionId={question.question_id} />
          </section>
        )}
      </main>
    </Layout>
  );
}
