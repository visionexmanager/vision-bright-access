import { useMemo } from "react";
import { Users, Star, BookOpenCheck, TrendingUp, Eye, Clock, MapPinned } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCourseProgress } from "@/lib/academy/lessonLocalStore";
import { getLessonsForCourseAny } from "@/lib/academy/instructorLocalStore";
import type { AcademyCourseRow, AcademyInstructorRow } from "@/lib/types/academy-modules";

const STATUS_LABEL: Record<AcademyCourseRow["status"], string> = {
  draft: "مسودة", published: "منشورة", unpublished: "غير منشورة", archived: "مؤرشفة",
};

function courseCompletionPercent(course: AcademyCourseRow): number | null {
  const lessons = getLessonsForCourseAny(course.id);
  if (lessons.length === 0) return null;
  const progress = getCourseProgress(course.id);
  return Math.round((progress.filter((p) => p.completed).length / lessons.length) * 100);
}

interface InstructorAnalyticsSectionProps {
  instructor: AcademyInstructorRow;
  courses: AcademyCourseRow[];
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-2xl border border-border p-5 text-center">
      <Icon className="w-6 h-6 mx-auto text-primary mb-2" aria-hidden="true" />
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export function InstructorAnalyticsSection({ instructor, courses }: InstructorAnalyticsSectionProps) {
  const totalStudents = courses.reduce((sum, c) => sum + c.students_count, 0);
  const publishedCount = courses.filter((c) => c.status === "published").length;

  // Honest scope: this reflects only the current browser's locally-tracked
  // lesson progress, not real aggregate telemetry across all students.
  const localCompletionPercent = useMemo(() => {
    const allLessons = courses.flatMap((c) => getLessonsForCourseAny(c.id));
    if (allLessons.length === 0) return null;
    const allProgress = courses.flatMap((c) => getCourseProgress(c.id));
    const completedCount = allProgress.filter((p) => p.completed).length;
    return Math.round((completedCount / allLessons.length) * 100);
  }, [courses]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="إجمالي الطلاب" value={totalStudents.toLocaleString()} />
        <StatCard icon={BookOpenCheck} label="دورات منشورة" value={String(publishedCount)} />
        <StatCard icon={Star} label="متوسط التقييم" value={instructor.rating != null ? instructor.rating.toFixed(1) : "—"} />
        <StatCard
          icon={TrendingUp}
          label="نسبة الإكمال (هذا المتصفح)"
          value={localCompletionPercent != null ? `${localCompletionPercent}%` : "—"}
        />
      </div>

      {courses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-foreground">أداء كل دورة</h3>
          <div className="rounded-2xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الدورة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الطلاب</TableHead>
                  <TableHead>التقييم</TableHead>
                  <TableHead>نسبة الإكمال (هذا المتصفح)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => {
                  const percent = courseCompletionPercent(course);
                  return (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium max-w-[220px] truncate">{course.title}</TableCell>
                      <TableCell>{STATUS_LABEL[course.status]}</TableCell>
                      <TableCell>{course.students_count.toLocaleString()}</TableCell>
                      <TableCell>{course.rating_avg != null ? course.rating_avg.toFixed(1) : "—"}</TableCell>
                      <TableCell>{percent != null ? `${percent}%` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="p-5 rounded-2xl border-2 border-dashed border-border space-y-3">
        <p className="text-sm font-bold text-foreground">مقاييس تتطلب بيانات تشغيل حقيقية (قيد التطوير)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2"><Clock className="w-4 h-4" aria-hidden="true" />متوسط وقت المشاهدة</p>
          <p className="flex items-center gap-2"><Eye className="w-4 h-4" aria-hidden="true" />نقاط التسرّب من الدروس</p>
          <p className="flex items-center gap-2"><MapPinned className="w-4 h-4" aria-hidden="true" />مصادر الزيارات</p>
        </div>
      </div>
    </div>
  );
}
