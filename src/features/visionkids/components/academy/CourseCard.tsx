import { Link } from "react-router-dom";
import { GraduationCap, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { cardHover, cardTap } from "@/features/visionkids/utils/animations";
import type { Course } from "@/features/visionkids/types/academy.types";

const COVER_GRADIENTS = ["from-kids-primary/30 to-kids-purple/30", "from-kids-pink/30 to-kids-accent/30", "from-kids-secondary/30 to-kids-green/30"];
function coverGradient(seed: string) {
  return COVER_GRADIENTS[seed.charCodeAt(0) % COVER_GRADIENTS.length];
}

export function CourseCard({ course }: { course: Course }) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  return (
    <motion.div whileHover={cardHover(reduced)} whileTap={cardTap(reduced)}>
      <Link
        to={`/kids/academy/course/${course.slug}`}
        className="group block overflow-hidden rounded-2xl border-2 border-border bg-card transition-colors hover:border-kids-primary/50"
        aria-label={`${course.title}${course.subtitle ? ` — ${course.subtitle}` : ""}`}
      >
        <div className={`relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br ${coverGradient(course.title)}`}>
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <GraduationCap className="h-10 w-10 text-foreground/40" aria-hidden="true" />
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-1 font-heading text-sm font-bold text-foreground">{course.title}</h3>
          {course.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{course.subtitle}</p>}
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-1.5 py-0.5">{course.age_range}</span>
            <span className="flex items-center gap-0.5"><BookOpen className="h-3 w-3" aria-hidden="true" /> {course.lesson_count} {t("kids.academy.lessons")}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
