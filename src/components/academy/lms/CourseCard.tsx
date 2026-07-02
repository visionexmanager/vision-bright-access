import { memo } from "react";
import { Link } from "react-router-dom";
import { Clock, Users, BookOpen, Zap } from "lucide-react";
import { DifficultyBadge } from "./DifficultyBadge";
import { CourseSourceBadge } from "./CourseSourceBadge";
import { StarRating } from "./StarRating";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

interface CourseCardProps {
  course: AcademyCourseRow;
}

export const CourseCard = memo(function CourseCard({ course }: CourseCardProps) {
  const hours = Math.round((course.duration_minutes / 60) * 10) / 10;

  return (
    <Link
      to={`/academy/courses/${course.id}`}
      className="group flex flex-col rounded-2xl border border-border bg-muted/30 overflow-hidden hover:border-primary hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center" aria-hidden="true">
        <BookOpen className="w-10 h-10 text-primary/40" />
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex flex-wrap gap-1.5">
          <CourseSourceBadge source={course.source} />
          <DifficultyBadge difficulty={course.difficulty} />
        </div>
        <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {course.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>

        <div className="mt-auto pt-2 flex items-center justify-between text-xs text-muted-foreground">
          <StarRating rating={course.rating_avg} count={course.rating_count} />
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" aria-hidden="true" />
            {course.students_count.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50 mt-1">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {hours > 0 ? `${hours} ساعة` : "قيد الإعداد"}
          </span>
          {course.is_free ? (
            <span className="font-bold text-emerald-600">مجانية</span>
          ) : (
            <span className="font-bold text-primary flex items-center gap-1">
              <Zap className="w-3 h-3" aria-hidden="true" />
              {course.price_vx?.toLocaleString()} VX
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});
