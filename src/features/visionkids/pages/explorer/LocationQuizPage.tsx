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
import { useLocationBySlug } from "@/features/visionkids/hooks/explorer/useExplorerWorlds";
import { useQuizByLocation, useSubmitQuizAttempt } from "@/features/visionkids/hooks/stories/useStoryQuiz";
import { useAwardAchievement, useAwardXp } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { useAwardCoins } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useBumpQuizMissions } from "@/features/visionkids/hooks/explorer/useExplorerPassport";
import { QuizRunner } from "@/features/visionkids/components/stories/QuizRunner";
import type { QuizAnswer } from "@/features/visionkids/services/stories/quizzes";

export default function LocationQuizPage() {
  const { worldSlug, locationSlug } = useParams<{ worldSlug: string; locationSlug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  const { data: location } = useLocationBySlug(worldSlug, locationSlug);
  const { data: quiz, isLoading } = useQuizByLocation(location?.id);
  const submitAttempt = useSubmitQuizAttempt();
  const awardAchievement = useAwardAchievement();
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const bumpQuizMissions = useBumpQuizMissions();

  const [result, setResult] = useState<{ score: number; total: number; answers: QuizAnswer[] } | null>(null);
  const [key, setKey] = useState(0);

  useDocumentHead({ title: quiz ? `${quiz.title} — VisionKids Explorer` : t("kids.explorer.meta.title"), description: "", canonicalPath: `/kids/explorer/world/${worldSlug}/${locationSlug}/quiz` });

  const handleComplete = async (r: { score: number; total: number; answers: QuizAnswer[] }) => {
    setResult(r);
    if (!user || !quiz) return;
    submitAttempt.mutate({ quizId: quiz.id, answers: r.answers, score: r.score, total: r.total });
    if (r.score === r.total) awardAchievement.mutate("quiz_whiz");
    awardXp.mutate({ amount: Math.min(20, Math.round((r.score / r.total) * 20)), reason: `Location quiz completed: ${quiz.id}` });
    awardCoins.mutate({ amount: Math.min(10, Math.round((r.score / r.total) * 10)), reason: `Location quiz completed: ${quiz.id}` });
    if (worldSlug) bumpQuizMissions.mutate(worldSlug);
  };

  if (isLoading) return <div className="mx-auto max-w-xl px-4 py-16" aria-busy="true"><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!quiz || !location) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.quiz.noQuiz")}</p>
        <Link to={`/kids/explorer/world/${worldSlug}`} className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link to={`/kids/explorer/world/${worldSlug}/${locationSlug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {location.name}
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
              <Link to={`/kids/explorer/world/${worldSlug}`}>{t("kids.explorer.moreLocations")}</Link>
            </Button>
          </div>
        </motion.div>
      ) : (
        <QuizRunner key={key} quiz={quiz} onComplete={handleComplete} />
      )}
    </div>
  );
}
