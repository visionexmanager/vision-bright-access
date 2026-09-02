import { useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ivx, type IvxCodeTask } from "./api";
import { describeIvxCase, runIvxCode, type IvxCodeRun } from "./runCode";

/**
 * Answering a code question.
 *
 * ── What this component may and may not know ────────────────────────────────
 *
 * It gets the inputs for every case and the expected output for the worked
 * example only. The rest of the expected outputs stay in the database, which
 * is what lets the outputs this component reports be trusted: to fake a pass
 * you would have to work out the right answers, and working them out is the
 * exercise.
 *
 * So there is no `correct` state here, and nothing here decides anything. Run
 * shows the student what their code did. Check sends the outputs and waits to
 * be told.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * Results are a list of sentences — "3, 7 → 7", "0, 0 → TypeError: …" — in a
 * polite live region, never a column of ticks and crosses. A tick is invisible
 * to a listener and a colour is invisible to plenty of people looking at it.
 *
 * The editor is a plain `textarea`. Tab inserts a tab only when the student
 * has asked for it with the toggle below, because a code box that swallows Tab
 * is a keyboard trap — the standard way out of a form field stops working, and
 * for a keyboard-only user that is the end of the page.
 */
export function IVXCodeAnswer({
  questionId,
  disabled,
  onSubmitted,
}: {
  questionId: string;
  disabled: boolean;
  onSubmitted: (outputs: unknown[], source: string) => void;
}) {
  const { translateText, lang } = useLanguage();
  const language = lang === "ar" ? "ar" : lang;

  const [task, setTask] = useState<IvxCodeTask | null>(null);
  const [source, setSource] = useState("");
  const [run, setRun] = useState<IvxCodeRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [tabIndents, setTabIndents] = useState(false);

  const load = useCallback(async () => {
    const got = await ivx.codeTask(questionId, language);
    if (got.ok) {
      const detail = got as IvxCodeTask;
      setTask(detail);
      setSource(detail.starter);
      setRun(null);
    }
  }, [questionId, language]);

  useEffect(() => { void load(); }, [load]);

  const execute = async (): Promise<IvxCodeRun | null> => {
    if (!task) return null;
    setBusy(true);
    const outcome = await runIvxCode(source, task.entry, task.cases);
    setBusy(false);
    setRun(outcome);
    return outcome;
  };

  const check = async () => {
    const outcome = await execute();
    // A run that never finished, or never compiled, has no outputs worth
    // sending. Handing in nulls would be recorded as a wrong answer for a
    // mistake the student can still fix in front of them.
    if (!outcome || outcome.timedOut || outcome.fatal) return;
    onSubmitted(outcome.outputs, source);
  };

  if (!task) return null;

  return (
    <section className="mt-6" aria-labelledby="ivx-code-heading">
      <h2 id="ivx-code-heading" className="sr-only">{translateText("Your code")}</h2>

      <label htmlFor="ivx-code-source" className="block text-sm text-muted-foreground">
        {`${translateText("Write a function called")} ${task.entry}.`}
      </label>
      <textarea
        id="ivx-code-source"
        value={source}
        onChange={(event) => setSource(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Tab" || !tabIndents) return;
          event.preventDefault();
          const field = event.currentTarget;
          const { selectionStart, selectionEnd, value } = field;
          setSource(`${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`);
          // Put the caret after the two spaces that were just inserted, once
          // React has rendered the new value — otherwise it jumps to the end
          // and indenting a line means losing your place in it.
          const caret = selectionStart + 2;
          window.requestAnimationFrame(() => {
            field.selectionStart = caret;
            field.selectionEnd = caret;
          });
        }}
        rows={12}
        spellCheck={false}
        disabled={disabled}
        dir="ltr"
        className="mt-2 w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
      />

      {/* Off by default. A textarea that eats Tab is a keyboard trap, and the
          person most likely to be caught in it is the person who cannot use a
          mouse to get out. */}
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={tabIndents}
          onChange={(event) => setTabIndents(event.target.checked)}
        />
        {translateText("Use Tab to indent (Tab will no longer move to the next control)")}
      </label>

      <section className="mt-4" aria-labelledby="ivx-cases-heading">
        <h3 id="ivx-cases-heading" className="text-sm font-bold">
          {translateText("It will be run on these")}
        </h3>
        <ul className="mt-2 space-y-1 font-mono text-sm" role="list">
          {task.cases.map((testCase, index) => (
            <li key={index} dir="ltr">
              {testCase.in.map((value) => JSON.stringify(value)).join(", ")}
              {testCase.example && "out" in testCase && ` → ${JSON.stringify(testCase.out)}`}
              {!testCase.example && (
                <span className="text-muted-foreground">{` → ${translateText("?")}`}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => void execute()} disabled={busy || disabled}>
          <Play className="me-2 h-4 w-4" aria-hidden="true" />
          {translateText("Run")}
        </Button>
        <Button type="button" onClick={() => void check()} disabled={busy || disabled || !source.trim()}>
          {translateText("Check")}
        </Button>
      </div>

      {/* Polite: this is the student looking at their own work, not the verdict
          on it. The verdict is the practice page's assertive region. */}
      <div aria-live="polite" className="mt-4">
        {busy && <p className="text-sm text-muted-foreground">{translateText("Running…")}</p>}

        {run?.fatal === "missing-entry" && (
          <p className="text-sm">
            {`${translateText("There is no function called")} ${task.entry} ${translateText("in your code yet.")}`}
          </p>
        )}
        {run?.fatal && run.fatal !== "missing-entry" && (
          <p className="text-sm">{`${translateText("Your code did not compile")}: ${run.fatal}`}</p>
        )}
        {run?.timedOut && (
          <p className="text-sm">
            {translateText("Your code did not finish in three seconds — it is probably looping forever. Nothing was handed in.")}
          </p>
        )}

        {run && !run.fatal && !run.timedOut && (
          <ul className="space-y-1 font-mono text-sm" role="list">
            {task.cases.map((testCase, index) => (
              <li key={index} dir="ltr">{describeIvxCase(index, testCase, run)}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
