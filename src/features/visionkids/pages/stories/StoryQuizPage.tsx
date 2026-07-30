import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Trophy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { bounceIn } from "@/features/visionkids/utils/animations";
import { useStoryBySlug } from "@/features/visionkids/hooks/stories/useStoryCatalog";
import { useQuizByStory, useSubmitQuizAttempt } from "@/features/visionkids/hooks/stories/useStoryQuiz";
import { useAwardAchievement, useAwardXp } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { QuizRunner } from "@/features/visionkids/components/stories/QuizRunner";
import type { QuizAnswer } from "@/features/visionkids/services/stories/quizzes";

export default function StoryQuizPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  const { data: story } = useStoryBySlug(slug);
  const { data: quiz, isLoading } = useQuizByStory(story?.id);
  const submitAttempt = useSubmitQuizAttempt();
  const awardAchievement = useAwardAchievement();
  const awardXp = useAwardXp();

  const [result, setResult] = useState<{ score: number; total: number; answers: QuizAnswer[] } | null>(null);
  const [key, setKey] = useState(0);

  useDocumentHead({ title: quiz ? `${quiz.title} — VisionKids` : t("kids.stories.meta.title"), description: "", canonicalPath: `/kids/stories/quiz/${slug}` });

  const handleComplete = async (r: { score: number; total: number; answers: QuizAnswer[] }) => {
    setResult(r);
    if (!user || !quiz) return;
    submitAttempt.mutate({ quizId: quiz.id, answers: r.answers, score: r.score, total: r.total });
    if (r.score === r.total) awardAchievement.mutate("quiz_ace");
    awardXp.mutate({ amount: Math.min(20, Math.round((r.score / r.total) * 20)), reason: `Quiz completed: ${quiz.id}` });
  };

  if (isLoading) return <div className="mx-auto max-w-xl px-4 py-16" aria-busy="true"><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!quiz || !story) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.quiz.noQuiz")}</p>
        <Link to="/kids/stories" className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link to={`/kids/stories/story/${story.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {story.title}
      </Link>
      <h1 className="mb-6 font-heading text-2xl font-extrabold">{quiz.title}</h1>

      {result ? (
        <motion.div initial="hidden" animate="visible" variants={bounceIn(reduced)} className="flex flex-col items-center gap-4 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-8 text-center">
          <Trophy className="h-12 w-12 text-kids-accent" aria-hidden="true" />
          <p className="font-heading text-2xl font-extrabold">{result.score} / {result.total}</p>
          <p className="text-muted-foreground">{t("kids.quiz.wellDone")}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => { setResult(null); setKey((k) => k + 1); }}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("kids.quiz.retake")}
            </Button>
            <Button asChild className="bg-kids-primary text-white hover:bg-kids-primary/90">
              <Link to="/kids/stories">{t("kids.stories.moreStories")}</Link>
            </Button>
          </div>
        </motion.div>
      ) : (
        <QuizRunner key={key} quiz={quiz} onComplete={handleComplete} />
      )}
    </div>
  );
}
