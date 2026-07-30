import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles, Users, HeartHandshake, BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useAiStoryById } from "@/features/visionkids/hooks/stories/useAiStoryGenerator";

export default function AiStoryDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: story, isLoading } = useAiStoryById(id);
  const [pageIndex, setPageIndex] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  useDocumentHead({ title: story ? `${story.title} — VisionKids` : t("kids.ai.libraryTitle"), description: "", canonicalPath: `/kids/stories/ai/${id}` });

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!story) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.notFound")}</p>
        <Link to="/kids/stories/ai" className="mt-2 inline-block text-kids-primary hover:underline">{t("kids.ai.libraryTitle")}</Link>
      </div>
    );
  }

  const page = story.pages[pageIndex];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/kids/stories/ai" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.ai.libraryTitle")}
      </Link>

      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-kids-purple" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide text-kids-purple">{t("kids.ai.badge")}</span>
      </div>
      <h1 className="mt-1 font-heading text-3xl font-extrabold">{story.title}</h1>

      {story.cover_image_url && <img src={story.cover_image_url} alt="" className="mt-4 aspect-video w-full rounded-2xl object-cover" />}

      {!showQuiz ? (
        <>
          <div className="mt-6 rounded-2xl border-2 border-border bg-card p-6">
            {page?.imageUrl && <img src={page.imageUrl} alt="" className="mb-4 w-full rounded-xl object-cover" />}
            <p className="text-lg leading-relaxed">{page?.text}</p>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.reader.previousPage")}
            </Button>
            <span className="text-sm text-muted-foreground">{pageIndex + 1} / {story.pages.length}</span>
            {pageIndex < story.pages.length - 1 ? (
              <Button onClick={() => setPageIndex((i) => i + 1)} className="gap-1 bg-kids-primary text-white hover:bg-kids-primary/90">
                {t("kids.reader.nextPage")} <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={() => setShowQuiz(true)} className="bg-kids-accent text-white hover:bg-kids-accent/90">{t("kids.ai.seeTheEnd")}</Button>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {story.characters.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold"><Users className="h-5 w-5 text-kids-secondary" aria-hidden="true" /> {t("kids.ai.characters")}</h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {story.characters.map((c, i) => (
                  <li key={i} className="rounded-xl bg-muted p-3 text-sm"><strong>{c.name}</strong> — {c.description}</li>
                ))}
              </ul>
            </section>
          )}

          {story.moral_lesson && (
            <section className="rounded-2xl bg-kids-green/10 p-4">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-kids-green"><HeartHandshake className="h-5 w-5" aria-hidden="true" /> {t("kids.ai.moralLesson")}</h2>
              <p className="mt-1 text-sm">{story.moral_lesson}</p>
            </section>
          )}

          {story.vocabulary.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold"><BookOpenText className="h-5 w-5 text-kids-accent" aria-hidden="true" /> {t("kids.ai.vocabulary")}</h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {story.vocabulary.map((v, i) => (
                  <li key={i} className="rounded-xl bg-muted p-3 text-sm"><strong>{v.word}</strong> — {v.meaning}</li>
                ))}
              </ul>
            </section>
          )}

          {story.quiz.length > 0 && (
            <section>
              <h2 className="font-heading text-lg font-bold">{t("kids.quiz.title")}</h2>
              <div className="mt-2 flex flex-col gap-4">
                {story.quiz.map((q, qi) => (
                  <div key={qi} className="rounded-xl border-2 border-border p-4">
                    <p className="font-semibold">{q.question}</p>
                    <div className="mt-2 grid gap-1.5">
                      {q.options.map((opt) => {
                        const chosen = answers[qi] === opt;
                        const revealed = !!answers[qi];
                        const isCorrect = opt === q.correctAnswer;
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={revealed}
                            onClick={() => setAnswers((a) => ({ ...a, [qi]: opt }))}
                            className={`rounded-lg border-2 px-3 py-2 text-start text-sm transition-colors ${
                              revealed && isCorrect ? "border-kids-green bg-kids-green/10" : revealed && chosen ? "border-destructive bg-destructive/10" : "border-border hover:bg-muted"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Button variant="outline" onClick={() => { setShowQuiz(false); setPageIndex(0); setAnswers({}); }} className="self-start">
            {t("kids.ai.readAgain")}
          </Button>
        </div>
      )}
    </div>
  );
}
