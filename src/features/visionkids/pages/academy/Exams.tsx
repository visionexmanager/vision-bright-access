import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Trophy, RotateCcw, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { bounceIn } from "@/features/visionkids/utils/animations";
import { useCourseBySlug } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { useQuizByCourse, useSubmitQuizAttempt } from "@/features/visionkids/hooks/stories/useStoryQuiz";
import { QuizRunner } from "@/features/visionkids/components/stories/QuizRunner";
import type { QuizAnswer } from "@/features/visionkids/services/stories/quizzes";

export default function Exams() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  const { data: course } = useCourseBySlug(slug);
  const { data: quiz, isLoading } = useQuizByCourse(course?.id);
  const submitAttempt = useSubmitQuizAttempt();

  const [result, setResult] = useState<{ score: number; total: number; answers: QuizAnswer[] } | null>(null);
  const [key, setKey] = useState(0);

  useDocumentHead({ title: quiz ? `${quiz.title} — VisionKids` : t("kids.academy.meta.title"), description: "", canonicalPath: `/kids/academy/course/${slug}/exam` });

  const handleComplete = (r: { score: number; total: number; answers: QuizAnswer[] }) => {
    setResult(r);
    if (quiz) submitAttempt.mutate({ quizId: quiz.id, answers: r.answers, score: r.score, total: r.total });
  };

  if (isLoading) return <div className="mx-auto max-w-xl px-4 py-16" aria-busy="true"><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!quiz || !course) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.quiz.noQuiz")}</p>
        <Link to="/kids/academy" className="mt-4 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  const passed = result ? result.score / result.total >= 0.6 : false;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link to={`/kids/academy/course/${course.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {course.title}
      </Link>
      <h1 className="mb-6 font-heading text-2xl font-extrabold">{quiz.title}</h1>

      {result ? (
        <motion.div initial="hidden" animate="visible" variants={bounceIn(reduced)} className={`flex flex-col items-center gap-4 rounded-2xl border-2 p-8 text-center ${passed ? "border-kids-green/40 bg-kids-green/10" : "border-border bg-card"}`}>
          {passed ? <Award className="h-12 w-12 text-kids-green" aria-hidden="true" /> : <Trophy className="h-12 w-12 text-muted-foreground" aria-hidden="true" />}
          <p className="font-heading text-2xl font-extrabold">{result.score} / {result.total}</p>
          <p className="text-muted-foreground">{passed ? t("kids.academy.examPassed") : t("kids.academy.examNotPassed")}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => { setResult(null); setKey((k) => k + 1); }}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("kids.quiz.retake")}
            </Button>
            {passed && (
              <Button asChild className="bg-kids-green text-white hover:bg-kids-green/90">
                <Link to={`/kids/academy/course/${course.slug}`}>{t("kids.academy.backToCourse")}</Link>
              </Button>
            )}
          </div>
        </motion.div>
      ) : (
        <QuizRunner key={key} quiz={quiz} onComplete={handleComplete} />
      )}
    </div>
  );
}
