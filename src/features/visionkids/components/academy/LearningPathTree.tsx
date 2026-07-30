import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { staggerContainer, slideUp } from "@/features/visionkids/utils/animations";
import type { Lesson, LessonProgress } from "@/features/visionkids/types/academy.types";

interface LearningPathTreeProps {
  courseSlug: string;
  lessons: Lesson[];
  progressByLessonId: Map<string, LessonProgress>;
}

/** Each lesson unlocks the next — a lesson is playable once every lesson
 *  before it (in order_index order) is completed, or it's the first one. */
export function LearningPathTree({ courseSlug, lessons, progressByLessonId }: LearningPathTreeProps) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  let previousCompleted = true;

  return (
    <motion.ol initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="relative flex flex-col gap-3 ps-2">
      {lessons.map((lesson, i) => {
        const progress = progressByLessonId.get(lesson.id);
        const isCompleted = progress?.status === "completed";
        const isUnlocked = previousCompleted;
        previousCompleted = isCompleted;

        return (
          <motion.li key={lesson.id} variants={slideUp(reduced)} className="relative flex items-center gap-3">
            {i < lessons.length - 1 && (
              <span className="absolute start-4 top-9 h-full w-0.5 bg-border" aria-hidden="true" />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                isCompleted ? "border-kids-green bg-kids-green/20" : isUnlocked ? "border-kids-primary bg-kids-primary/10" : "border-border bg-muted"
              }`}
              aria-hidden="true"
            >
              {isCompleted ? <CheckCircle2 className="h-4 w-4 text-kids-green" /> : isUnlocked ? <PlayCircle className="h-4 w-4 text-kids-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            </span>

            {isUnlocked ? (
              <Link
                to={`/kids/academy/course/${courseSlug}/lesson/${lesson.slug}`}
                className="flex-1 rounded-xl border-2 border-border bg-card px-4 py-2.5 font-medium transition-colors hover:border-kids-primary hover:bg-kids-primary/5"
              >
                {lesson.title}
                <span className="ms-2 text-xs text-muted-foreground">{lesson.estimated_minutes}m</span>
              </Link>
            ) : (
              <span className="flex-1 rounded-xl border-2 border-dashed border-border px-4 py-2.5 font-medium text-muted-foreground" aria-label={`${lesson.title} — ${t("kids.academy.locked")}`}>
                {lesson.title}
              </span>
            )}
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
