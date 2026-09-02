import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ivxProjects, type IvxProjectSummary } from "@/features/ivx/api";

/** What a project's standing is called, in words a listener can act on. */
const STATUS_LABEL = {
  not_started: { en: "Not started", ar: "لم يبدأ" },
  draft:       { en: "Draft saved", ar: "مسودة محفوظة" },
  submitted:   { en: "Handed in, waiting to be marked", ar: "سُلّم، بانتظار التصحيح" },
  graded:      { en: "Marked", ar: "مُصحَّح" },
} as const;

/**
 * The project list.
 *
 * Status is a sentence rather than a colour or a badge, because "handed in,
 * waiting to be marked" is the thing a student needs and a coloured dot is
 * not. A locked project says what would unlock it instead of dimming itself.
 */
export default function IVXProjects() {
  const { translateText, dir, lang } = useLanguage();
  const language = lang === "ar" ? "ar" : lang;
  const [projects, setProjects] = useState<IvxProjectSummary[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const got = await ivxProjects.list(language);
    setLoading(false);
    if (got.ok) {
      setProjects((got as { projects: IvxProjectSummary[] }).projects);
      setRefusal(null);
    } else {
      setRefusal((got as { reason: string }).reason);
    }
  }, [language]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Layout>
      <main className="mx-auto max-w-3xl px-4 py-10" dir={dir}>
        <p className="text-sm text-muted-foreground">
          <Link to="/academy/ivx" className="underline">IVX</Link>
        </p>
        <h1 className="mt-1 text-3xl font-black">{translateText("Projects")}</h1>
        <p className="mt-2 text-muted-foreground">
          {translateText(
            "Longer pieces of work, marked against a rubric you can read before you start. A project earns XP; your skill mastery still comes from practice.",
          )}
        </p>

        {loading && <p className="mt-6" role="status">{translateText("Loading…")}</p>}

        {refusal && (
          <p className="mt-6 rounded-xl border border-border p-5" role="status">
            {refusal === "not_authenticated"
              ? translateText("Sign in to work on a project.")
              : translateText("Projects are unavailable right now. Please try again shortly.")}
          </p>
        )}

        {projects.length > 0 && (
          <ul className="mt-8 space-y-4" role="list">
            {projects.map((project) => (
              <li key={project.slug} className="rounded-xl border border-border p-5">
                <h2 className="text-lg font-bold">{project.title}</h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {`${translateText("About")} ${project.est_minutes} ${translateText("minutes")} · ${project.xp_award} XP`}
                  {project.skills.length > 0 && ` · ${project.skills.map((s) => s.title).join("، ")}`}
                </p>

                <p className="mt-2 text-sm">
                  {lang === "ar" ? STATUS_LABEL[project.status].ar : STATUS_LABEL[project.status].en}
                  {project.status === "graded" && project.score !== null && (
                    ` — ${Math.round(project.score)}%`
                  )}
                </p>

                {project.unlocked ? (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link to={`/academy/ivx/projects/${encodeURIComponent(project.slug)}`}>
                      {project.status === "not_started"
                        ? translateText("Read the brief")
                        : translateText("Open")}
                    </Link>
                  </Button>
                ) : (
                  /* Not dimmed and not hidden: a locked project says what to
                     practise, which is more useful than being unreachable. */
                  <p className="mt-3 text-sm text-muted-foreground">
                    {`${translateText("Practise these first")}: ${project.skills.map((s) => s.title).join("، ")}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </Layout>
  );
}
