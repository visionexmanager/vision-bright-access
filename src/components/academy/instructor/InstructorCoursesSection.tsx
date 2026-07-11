import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Copy, Trash2, Eye, EyeOff, Archive, BookOpen } from "lucide-react";
import { useInstructorCourses } from "@/hooks/academy/useInstructorCourses";
import type { AcademyCourseRow, AcademyCourseStatus } from "@/lib/types/academy-modules";

const STATUS_LABEL: Record<AcademyCourseStatus, string> = {
  draft: "مسودة",
  published: "منشورة",
  unpublished: "غير منشورة",
  archived: "مؤرشفة",
};

const STATUS_VARIANT: Record<AcademyCourseStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  published: "default",
  unpublished: "secondary",
  archived: "secondary",
};

interface InstructorCoursesSectionProps {
  courses: AcademyCourseRow[];
  onCoursesChange: () => void;
}

export function InstructorCoursesSection({ courses, onCoursesChange }: InstructorCoursesSectionProps) {
  const { duplicateCourse, setCourseStatus, deleteCourse } = useInstructorCourses();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AcademyCourseStatus>("all");

  const visibleCourses = useMemo(
    () => (statusFilter === "all" ? courses : courses.filter((c) => c.status === statusFilter)),
    [courses, statusFilter]
  );

  const handleDuplicate = async (courseId: string) => {
    await duplicateCourse(courseId);
    onCoursesChange();
  };

  const handleToggleStatus = async (course: AcademyCourseRow) => {
    const next: AcademyCourseStatus = course.status === "published" ? "unpublished" : "published";
    await setCourseStatus({ courseId: course.id, status: next });
    onCoursesChange();
  };

  const handleArchive = async (courseId: string) => {
    await setCourseStatus({ courseId, status: "archived" });
    onCoursesChange();
  };

  const handleDelete = async (courseId: string) => {
    await deleteCourse(courseId);
    setPendingDeleteId(null);
    onCoursesChange();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{visibleCourses.length} من {courses.length} دورة</p>
        <Button asChild size="sm" className="gap-2 rounded-xl">
          <Link to="/academy/instructor/courses/new">
            <Plus className="w-4 h-4" aria-hidden="true" />
            إنشاء دورة جديدة
          </Link>
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">الكل ({courses.length})</TabsTrigger>
          <TabsTrigger value="draft">مسودة ({courses.filter((c) => c.status === "draft").length})</TabsTrigger>
          <TabsTrigger value="published">منشورة ({courses.filter((c) => c.status === "published").length})</TabsTrigger>
          <TabsTrigger value="unpublished">غير منشورة ({courses.filter((c) => c.status === "unpublished").length})</TabsTrigger>
          <TabsTrigger value="archived">مؤرشفة ({courses.filter((c) => c.status === "archived").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {visibleCourses.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">{courses.length === 0 ? "لم تنشئ أي دورة بعد." : "لا توجد دورات بهذه الحالة."}</p>
          {courses.length === 0 && (
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link to="/academy/instructor/courses/new">ابدأ بإنشاء أول دورة</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الدورة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الطلاب</TableHead>
                <TableHead>التقييم</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCourses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium max-w-[220px] truncate">{course.title}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[course.status]}>{STATUS_LABEL[course.status]}</Badge></TableCell>
                  <TableCell>{course.students_count.toLocaleString()}</TableCell>
                  <TableCell>{course.rating_avg != null ? course.rating_avg.toFixed(1) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0" aria-label="تعديل">
                        <Link to={`/academy/instructor/courses/${course.id}/edit`}><Pencil className="w-3.5 h-3.5" /></Link>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="نسخ" onClick={() => handleDuplicate(course.id)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={course.status === "published" ? "إلغاء النشر" : "نشر"} onClick={() => handleToggleStatus(course)}>
                        {course.status === "published" ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      {course.status !== "archived" && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="أرشفة" onClick={() => handleArchive(course.id)}>
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {pendingDeleteId === course.id ? (
                        <Button variant="destructive" size="sm" className="h-8 px-2 text-xs" onClick={() => handleDelete(course.id)}>
                          تأكيد الحذف
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" aria-label="حذف" onClick={() => setPendingDeleteId(course.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
