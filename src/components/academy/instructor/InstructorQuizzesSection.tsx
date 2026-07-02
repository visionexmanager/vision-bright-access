import { useMemo } from "react";
import { HelpCircle, Users, Target, TrendingUp } from "lucide-react";
import { getLessonsForCourseAny } from "@/lib/academy/instructorLocalStore";
import { getQuizForLessonAny, computeQuizAnalytics } from "@/lib/academy/assessmentLocalStore";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

interface InstructorQuizzesSectionProps {
  courses: AcademyCourseRow[];
}

export function InstructorQuizzesSection({ courses }: InstructorQuizzesSectionProps) {
  const quizzes = useMemo(() => {
    const resolved = [];
    for (const course of courses) {
      const lessons = getLessonsForCourseAny(course.id).filter((l) => l.kind === "quiz");
      for (const lesson of lessons) {
        const detail = getQuizForLessonAny(lesson.id);
        if (!detail) continue;
        resolved.push({ quiz: detail.quiz, questionCount: detail.questions.length, courseTitle: course.title, analytics: computeQuizAnalytics(detail.quiz.id) });
      }
    }
    return resolved;
  }, [courses]);

  if (quizzes.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
        <HelpCircle className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">لم تُنشئ أي اختبار بعد. أضف درساً من نوع "اختبار" في محرّر الدورة.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {quizzes.map(({ quiz, questionCount, courseTitle, analytics }) => (
        <li key={quiz.id} className="p-4 rounded-2xl bg-card border border-border">
          <p className="font-bold text-foreground text-sm">{quiz.title}</p>
          <p className="text-xs text-muted-foreground mb-3">{courseTitle} · {questionCount} أسئلة</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <Users className="w-4 h-4 mx-auto text-primary mb-1" aria-hidden="true" />
              <p className="text-sm font-bold text-foreground">{analytics.attempts_count}</p>
              <p className="text-[10px] text-muted-foreground">محاولة</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <TrendingUp className="w-4 h-4 mx-auto text-primary mb-1" aria-hidden="true" />
              <p className="text-sm font-bold text-foreground">{analytics.average_score_percent}%</p>
              <p className="text-[10px] text-muted-foreground">متوسط النتيجة</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-muted/50">
              <Target className="w-4 h-4 mx-auto text-primary mb-1" aria-hidden="true" />
              <p className="text-sm font-bold text-foreground">{analytics.pass_rate_percent}%</p>
              <p className="text-[10px] text-muted-foreground">نسبة النجاح</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
