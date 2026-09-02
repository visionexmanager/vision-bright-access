import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Flame, Sparkles, Lock, RotateCcw } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ivx, MASTERY_LABEL, masteryPercent, type IvxProgress } from "@/features/ivx/api";

/**
 * IVX — the learner's own page.
 *
 * One call fills it. A dashboard that fetched subjects, then skills, then
 * mastery, then a recommendation would keep a screen reader waiting through
 * four rounds of "loading" before saying anything worth hearing.
 *
 * Nothing here is decorative-only. Every state is a word before it is a colour
 * or a bar, because the six mastery states are the substance of the model and a
 * learner who cannot see the bar still has to know which one they are in.
 */
export default function IVX() {
  const { lang, dir, translateText } = useLanguage();
  const language = lang === "ar" ? "ar" : lang;

  const { data, isLoading } = useQuery({
    queryKey: ["ivx-progress", language],
    queryFn: () => ivx.progress(language),
  });

  const progress = data && data.ok ? (data as IvxProgress) : null;
  const label = (state: keyof typeof MASTERY_LABEL) =>
    lang === "ar" ? MASTERY_LABEL[state].ar : MASTERY_LABEL[state].en;

  return (
    <Layout>
      <main className="mx-auto max-w-5xl px-4 py-10" dir={dir}>
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {translateText("Visionex Academy")}
          </p>
          <h1 className="mt-1 text-3xl font-black md:text-4xl">
            IVX — {translateText("Intelligent Visionex Learning")}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {translateText(
              "Practice adapts to what you already know. Answer a few questions and IVX works out what to give you next.",
            )}
          </p>
        </header>

        {isLoading && <p className="mt-8" role="status">{translateText("Loading your progress…")}</p>}

        {data && !data.ok && (
          <p className="mt-8 rounded-lg border border-border p-4" role="status">
            {translateText("Sign in to start learning with IVX.")}
          </p>
        )}

        {progress && (
          <>
            {/* The two numbers a learner actually asks for, as text. */}
            <dl className="mt-8 grid grid-cols-2 gap-4 sm:max-w-md">
              <div className="rounded-xl border border-border p-4">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> {translateText("Total XP")}
                </dt>
                <dd className="mt-1 text-2xl font-black">{progress.xp.toLocaleString()}</dd>
              </div>
              <div className="rounded-xl border border-border p-4">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Flame className="h-4 w-4" aria-hidden="true" /> {translateText("Day streak")}
                </dt>
                <dd className="mt-1 text-2xl font-black">{progress.streak_days}</dd>
              </div>
            </dl>

            {progress.recommended && (
              <section className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6"
                       aria-labelledby="ivx-next">
                <h2 id="ivx-next" className="text-lg font-bold">
                  {translateText("Recommended next")}
                </h2>
                <p className="mt-1 text-muted-foreground">
                  {translateText("Chosen from what you have practised and what is due for review.")}
                </p>
                <p className="mt-3 text-xl font-semibold">{progress.recommended.title}</p>
                <Button asChild className="mt-4">
                  <Link to={`/academy/ivx/practice?skill=${encodeURIComponent(progress.recommended.skill)}`}>
                    {translateText("Start practising")}
                  </Link>
                </Button>
              </section>
            )}

            <section className="mt-10" aria-labelledby="ivx-subjects">
              <h2 id="ivx-subjects" className="text-xl font-bold">{translateText("Subjects")}</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
                {progress.subjects.map((subject) => (
                  <li key={subject.slug} className="rounded-xl border border-border p-4">
                    <h3 className="font-bold">
                      <span aria-hidden="true">{subject.icon} </span>
                      {subject.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {/* Counted as a sentence, not as a ring somebody has to see. */}
                      {`${subject.skills_mastered} / ${subject.skills_total} `}
                      {translateText("skills mastered")}
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-3">
                      <Link to={`/academy/ivx/practice?subject=${encodeURIComponent(subject.slug)}`}>
                        {translateText("Practise")} — {subject.title}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-10" aria-labelledby="ivx-skills">
              <h2 id="ivx-skills" className="text-xl font-bold">{translateText("Your skills")}</h2>
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border" role="list">
                {progress.skills.map((skill) => (
                  <li key={skill.slug} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {skill.title}
                        {!skill.unlocked && (
                          <>
                            {" "}
                            <Lock className="inline h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">{translateText("Locked — finish the earlier skill first")}</span>
                          </>
                        )}
                        {skill.due && (
                          <>
                            {" "}
                            <RotateCcw className="inline h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                            <span className="sr-only">{translateText("Due for review")}</span>
                          </>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {label(skill.state)} — {masteryPercent(skill.state, skill.score)}%
                      </p>
                    </div>
                    {skill.unlocked && (
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/academy/ivx/practice?skill=${encodeURIComponent(skill.slug)}`}>
                          {translateText("Practise")}
                          <span className="sr-only"> — {skill.title}</span>
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/* Projects sit beside practice rather than inside it. A question asks
            whether you know something; a project asks what you can do with it,
            and it earns XP without touching mastery — see the migration. */}
        <section className="mt-10 border-t border-border pt-6" aria-labelledby="ivx-projects-heading">
          <h2 id="ivx-projects-heading" className="text-base font-bold">
            {translateText("Projects")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {translateText("Longer pieces of work, marked against a rubric you can read before you start.")}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/academy/ivx/projects">{translateText("See the projects")}</Link>
          </Button>
        </section>

        {/* Last, and quiet. A learner opens this page to practise; sharing
            their progress with a parent or a teacher is a decision they make
            occasionally, and putting it at the top would suggest somebody is
            already watching. */}
        <section className="mt-10 border-t border-border pt-6" aria-labelledby="ivx-sharing-heading">
          <h2 id="ivx-sharing-heading" className="text-base font-bold">
            {translateText("Parents and teachers")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {translateText("Invite somebody to follow how you are doing, or follow a student who invited you.")}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/academy/ivx/guardians">{translateText("Manage who can see my progress")}</Link>
          </Button>
        </section>
      </main>
    </Layout>
  );
}
