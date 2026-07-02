import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronLeft, FolderTree, Layers, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getModulesForCourseAny, getLessonsForModuleAny } from "@/lib/academy/instructorLocalStore";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

interface InstructorContentSectionProps {
  courses: AcademyCourseRow[];
}

const LESSON_KIND_LABEL: Record<string, string> = {
  video: "فيديو", youtube: "يوتيوب", text: "نص", pdf: "PDF", presentation: "عرض تقديمي",
  audio: "صوتي", live_session: "جلسة مباشرة", quiz: "اختبار", assignment: "واجب", project: "مشروع",
};

function CourseContentTree({ course }: { course: AcademyCourseRow }) {
  const modules = useMemo(() => getModulesForCourseAny(course.id), [course.id]);

  return (
    <div className="space-y-3">
      {modules.length === 0 ? (
        <p className="text-xs text-muted-foreground p-3">لا توجد وحدات في هذه الدورة بعد.</p>
      ) : (
        modules.map((module) => {
          const lessons = getLessonsForModuleAny(course.id, module.id);
          return (
            <div key={module.id} className="ps-4 border-s-2 border-border space-y-1.5">
              <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Layers className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                {module.title}
                <span className="text-xs font-normal text-muted-foreground">({lessons.length} درس)</span>
              </p>
              <ul className="space-y-1">
                {lessons.map((lesson) => (
                  <li key={lesson.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground ps-5">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{lesson.title}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-muted text-[10px]">{LESSON_KIND_LABEL[lesson.kind] ?? lesson.kind}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}

/** Aggregated course → module → lesson navigator across all of the instructor's courses — real data (own courses only), quick links into the existing Course Editor / Lesson Builder rather than a separate editing surface. */
export function InstructorContentSection({ courses }: InstructorContentSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(courses[0]?.id ?? null);

  if (courses.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
        <FolderTree className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">أنشئ دورة أولاً لإدارة محتواها هنا.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">استعرض بنية دوراتك (الوحدات والدروس) في مكان واحد.</p>
      {courses.map((course) => {
        const isOpen = expandedId === course.id;
        return (
          <div key={course.id} className="rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-4 bg-muted/30">
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : course.id)}
                aria-expanded={isOpen}
                className="flex items-center gap-2 text-sm font-bold text-foreground flex-1 min-w-0 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
              >
                {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />}
                <span className="truncate">{course.title}</span>
              </button>
              <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 shrink-0" aria-label="تعديل الدورة">
                <Link to={`/academy/instructor/courses/${course.id}/edit`}><Pencil className="w-3.5 h-3.5" /></Link>
              </Button>
            </div>
            {isOpen && (
              <div className="p-4">
                <CourseContentTree course={course} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
