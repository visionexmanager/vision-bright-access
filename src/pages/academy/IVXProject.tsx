import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Volume2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { speakText } from "@/lib/audio/speech";
import {
  gradeIvxProject,
  ivxProjects,
  type IvxProjectDetail,
  type IvxProjectFeedback,
} from "@/features/ivx/api";

/**
 * One project: the brief, the rubric, a box to write in, and a mark.
 *
 * ── Why the rubric is on the page ───────────────────────────────────────────
 *
 * A question hides its answer; a project does not hide its rubric. Being told
 * what you are judged on is not a hint, it is the assignment — and a student
 * left to guess the criteria is being marked on their ability to guess.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * The mark arrives in an assertive live region and leads with a sentence
 * ("You scored 78 out of 100"), because a number in a heading beside a
 * progress bar is a number a listener never hears. Each criterion's note is
 * read as prose next to what it was out of.
 *
 * The writing box is a plain `textarea` with a real label and no rich-text
 * layer over it. Every assistive technology can already drive one of those,
 * and the work here is text.
 */
export default function IVXProject() {
  const { slug = "" } = useParams();
  const { translateText, dir, lang } = useLanguage();
  const language = lang === "ar" ? "ar" : lang;

  const [project, setProject] = useState<IvxProjectDetail | null>(null);
  const [content, setContent] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [grade, setGrade] = useState<{ score: number; xp: number; feedback: IvxProjectFeedback } | null>(null);
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    const got = await ivxProjects.get(slug, language);
    if (got.ok) {
      const detail = got as IvxProjectDetail;
      setProject(detail);
      setContent(detail.submission?.content ?? "");
      setRefusal(null);
      if (detail.submission?.status === "graded" && detail.submission.score !== null) {
        setGrade({
          score: detail.submission.score,
          xp: detail.submission.xp_awarded,
          feedback: detail.submission.feedback as IvxProjectFeedback,
        });
      }
    } else {
      setRefusal((got as { reason: string }).reason);
    }
  }, [slug, language]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true);
    await ivxProjects.save(slug, content);
    setBusy(false);
    setNotice(translateText("Draft saved."));
  };

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    const handed = await ivxProjects.submit(slug, content);
    if (!handed.ok) {
      setBusy(false);
      setNotice(
        (handed as { reason: string }).reason === "too_short"
          ? translateText("There is not enough here to mark yet. Write a little more, then hand it in.")
          : translateText("That did not work. Your draft is saved — try again shortly."),
      );
      return;
    }

    setNotice(translateText("Handed in. Marking it now — this takes a moment."));
    const marked = await gradeIvxProject(slug, language);
    setBusy(false);

    if ("ok" in marked && marked.ok) {
      setGrade({ score: marked.score, xp: marked.xp, feedback: marked.feedback });
      setNotice(null);
      await load();
      return;
    }
    setNotice(
      ("error" in marked && marked.error)
        ? marked.error
        : translateText("Marking is unavailable right now. Your work is saved — try again shortly."),
    );
  };

  if (refusal) {
    return (
      <Layout>
        <main className="mx-auto max-w-2xl px-4 py-10" dir={dir}>
          <p role="status">
            {refusal === "not_authenticated"
              ? translateText("Sign in to work on a project.")
              : translateText("That project is not available.")}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/academy/ivx/projects">{translateText("All projects")}</Link>
          </Button>
        </main>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <main className="mx-auto max-w-2xl px-4 py-10" dir={dir}>
          <p role="status">{translateText("Loading…")}</p>
        </main>
      </Layout>
    );
  }

  const spoken = `${project.title}. ${project.accessible || project.brief}`;
  const criterionWeight = (id: string) => project.rubric.find((c) => c.id === id)?.weight ?? 0;
  const criterionText = (id: string) => project.rubric.find((c) => c.id === id)?.criterion ?? id;

  return (
    <Layout>
      <main className="mx-auto max-w-3xl px-4 py-10" dir={dir}>
        <p className="text-sm text-muted-foreground">
          <Link to="/academy/ivx/projects" className="underline">{translateText("Projects")}</Link>
        </p>

        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-bold outline-none">
          {project.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {`${translateText("About")} ${project.est_minutes} ${translateText("minutes")} · ${project.xp_award} XP`}
        </p>

        <p className="mt-4 whitespace-pre-wrap">{project.brief}</p>
        {project.accessible && (
          <p className="mt-2 text-sm text-muted-foreground">{project.accessible}</p>
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

        <section className="mt-8" aria-labelledby="ivx-rubric-heading">
          <h2 id="ivx-rubric-heading" className="text-lg font-bold">
            {translateText("What this is marked on")}
          </h2>
          <ul className="mt-3 space-y-2" role="list">
            {project.rubric.map((criterion) => (
              <li key={criterion.id} className="text-sm">
                <strong>{`${criterion.weight} ${translateText("marks")}`}</strong>
                {` — ${criterion.criterion}`}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="ivx-work-heading">
          <h2 id="ivx-work-heading" className="text-lg font-bold">
            {translateText("Your work")}
          </h2>
          <label htmlFor="ivx-project-content" className="mt-2 block text-sm text-muted-foreground">
            {translateText("Write or paste your work here. It saves as a draft until you hand it in.")}
          </label>
          <textarea
            id="ivx-project-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={14}
            maxLength={20000}
            className="mt-2 w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
            dir="auto"
          />
          <p className="mt-1 text-sm text-muted-foreground" role="status">
            {`${content.trim().split(/\s+/).filter(Boolean).length} ${translateText("words")}`}
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => void save()} disabled={busy}>
              {translateText("Save draft")}
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={busy || !content.trim()}>
              {translateText("Hand it in")}
            </Button>
          </div>
        </section>

        {/* Assertive: the mark is what the student pressed the button for, and
            it arrives after a wait long enough that they may have looked away. */}
        <div aria-live="assertive" className="mt-8">
          {notice && <p className="rounded-lg bg-muted p-3 text-sm">{notice}</p>}

          {grade && (
            <article className="rounded-xl border border-border p-5" aria-labelledby="ivx-mark-heading">
              <h2 id="ivx-mark-heading" className="text-lg font-bold">
                {translateText("Your mark")}
              </h2>
              {/* The sentence first. A percentage in a heading beside a bar is
                  a number a listener never hears. */}
              <p className="mt-2 text-lg">
                {`${translateText("You scored")} ${Math.round(grade.score)} ${translateText("out of 100")}.`}
                {grade.xp > 0 && ` +${grade.xp} XP.`}
              </p>
              {grade.feedback?.summary && <p className="mt-3">{grade.feedback.summary}</p>}

              {grade.feedback?.criteria?.length > 0 && (
                <ul className="mt-4 space-y-3" role="list">
                  {grade.feedback.criteria.map((mark) => (
                    <li key={mark.id} className="text-sm">
                      <strong>
                        {`${Math.round(mark.score)} ${translateText("out of")} ${criterionWeight(mark.id)}`}
                      </strong>
                      {` — ${criterionText(mark.id)}`}
                      {mark.note && <span className="block text-muted-foreground">{mark.note}</span>}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-4 text-sm text-muted-foreground">
                {translateText(
                  "Edit your work and hand it in again to be marked afresh. XP is awarded once per project.",
                )}
              </p>
            </article>
          )}
        </div>
      </main>
    </Layout>
  );
}
