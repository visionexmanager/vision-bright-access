import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

interface InstructorStudentsSectionProps {
  courses: AcademyCourseRow[];
}

/**
 * Per-course enrollment summary — not an individual student roster.
 * A real roster needs actual enrollment records tied to real user accounts,
 * which don't exist yet; this stays honest about what data is available.
 */
export function InstructorStudentsSection({ courses }: InstructorStudentsSectionProps) {
  const totalStudents = courses.reduce((sum, c) => sum + c.students_count, 0);

  if (courses.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
        <Users className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">أنشئ دورة أولاً ليظهر هنا ملخص الطلاب المسجّلين.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        إجمالي الطلاب عبر جميع دوراتك: <span className="font-bold text-foreground">{totalStudents.toLocaleString()}</span>
      </p>
      <div className="rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الدورة</TableHead>
              <TableHead>الطلاب المسجّلون</TableHead>
              <TableHead>متوسط التقييم</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="font-medium max-w-[260px] truncate">{course.title}</TableCell>
                <TableCell>{course.students_count.toLocaleString()}</TableCell>
                <TableCell>{course.rating_avg != null ? course.rating_avg.toFixed(1) : "لا يوجد بعد"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        سجل طلاب فردي بالاسم يتطلب بيانات تسجيل حقيقية غير متوفرة بعد — هذا ملخص إجمالي لكل دورة.
      </p>
    </div>
  );
}
