import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn } from "@/features/visionkids/utils/animations";
import { useCourseBySlug, useLessonBySlug, useLessonActivities } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { useLessonProgress, useCompleteLessonAndAward, useSubmitActivityAttempt, useSaveLessonProgress } from "@/features/visionkids/hooks/academy/useAcademyProgress";
import { ExerciseRunner } from "@/features/visionkids/components/academy/ExerciseRunner";

export default function LessonPlayer() {
  const { courseSlug, lessonSlug } = useParams<{ courseSlug: string; lessonSlug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduced = useKidsReducedMotion();
  const startTimeRef = useRef(Date.now());

  const { data: course } = useCourseBySlug(courseSlug);
  const { data: lesson } = useLessonBySlug(course?.id, lessonSlug);
  const { data: activities = [] } = useLessonActivities(lesson?.id);
  const { data: progress } = useLessonProgress(lesson?.id);
  const completeAndAward = useCompleteLessonAndAward();
  const submitAttempt = useSubmitActivityAttempt();
  const saveProgress = useSaveLessonProgress();

  const [activityIndex, setActivityIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [phase, setPhase] = useState<"content" | "activities" | "done">("content");

  useDocumentHead({ title: lesson ? `${lesson.title} — VisionKids` : t("kids.academy.meta.title"), description: lesson?.description ?? "", canonicalPath: `/kids/academy/course/${courseSlug}/lesson/${lessonSlug}` });

  useEffect(() => {
    if (lesson && user) saveProgress.mutate({ lessonId: lesson.id, status: "in_progress", timeSpentDeltaSeconds: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, user?.id]);

  if (!course || !lesson) return <div className="mx-auto max-w-2xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  const finishLesson = async () => {
    const minutesSpent = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));
    const score = activities.length > 0 ? Math.round((correctCount / activities.length) * 100) : undefined;
    await completeAndAward.mutateAsync({ lesson, score, timeSpentDeltaSeconds: minutesSpent * 60, wasAlreadyCompleted: progress?.status === "completed" });
    setPhase("done");
  };

  const handleActivityComplete = (correct: boolean, answer: Record<string, unknown>) => {
    const activity = activities[activityIndex];
    if (user) submitAttempt.mutate({ activityId: activity.id, answer, correct });
    if (correct) setCorrectCount((c) => c + 1);

    if (activityIndex < activities.length - 1) {
      setActivityIndex((i) => i + 1);
    } else {
      finishLesson();
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to={`/kids/academy/course/${course.slug}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {course.title}
      </Link>

      <h1 className="font-heading text-2xl font-extrabold">{lesson.title}</h1>

      {phase === "content" && (
        <motion.div initial="hidden" animate="visible" variants={fadeIn(reduced)} className="mt-4">
          {lesson.video_url && (
            <video controls className="mb-4 w-full rounded-xl" src={lesson.video_url}>
              <track kind="captions" />
            </video>
          )}
          {lesson.audio_url && <audio controls className="mb-4 w-full" src={lesson.audio_url} />}
          {lesson.content && <p className="whitespace-pre-line leading-relaxed">{lesson.content}</p>}

          <Button
            onClick={() => (activities.length > 0 ? setPhase("activities") : finishLesson())}
            className="mt-6 bg-kids-primary text-white hover:bg-kids-primary/90"
          >
            {activities.length > 0 ? t("kids.academy.startExercises") : t("kids.academy.markComplete")}
          </Button>
        </motion.div>
      )}

      {phase === "activities" && activities[activityIndex] && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted-foreground">{t("kids.academy.exercise")} {activityIndex + 1}/{activities.length}</p>
          <ExerciseRunner activity={activities[activityIndex]} onComplete={handleActivityComplete} />
        </div>
      )}

      {phase === "done" && (
        <motion.div initial="hidden" animate="visible" variants={fadeIn(reduced)} className="mt-6 flex flex-col items-center gap-4 rounded-2xl border-2 border-kids-green/40 bg-kids-green/10 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-kids-green" aria-hidden="true" />
          <p className="font-heading text-xl font-extrabold">{t("kids.academy.lessonComplete")}</p>
          {activities.length > 0 && <p className="text-muted-foreground">{correctCount}/{activities.length} {t("kids.academy.correctAnswers")}</p>}
          <Button onClick={() => navigate(`/kids/academy/course/${course.slug}`)} className="bg-kids-primary text-white hover:bg-kids-primary/90">
            {t("kids.academy.backToCourse")}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
