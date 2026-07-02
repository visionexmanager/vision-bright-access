import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { searchCoursesAny, getLessonsForCourseAny } from "@/lib/academy/instructorLocalStore";
import { getCourseProgress } from "@/lib/academy/lessonLocalStore";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

type Tab = "current" | "completed";

interface CourseWithProgress {
  course: AcademyCourseRow;
  percent: number;
  completedLessons: number;
  totalLessons: number;
}

export default function AcademyMyCourses() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("current");

  const { current, completed } = useMemo(() => {
    if (!user) return { current: [] as CourseWithProgress[], completed: [] as CourseWithProgress[] };
    const allCourses = searchCoursesAny({});
    const currentList: CourseWithProgress[] = [];
    const completedList: CourseWithProgress[] = [];

    for (const course of allCourses) {
      const lessons = getLessonsForCourseAny(course.id);
      if (lessons.length === 0) continue;
      const progress = getCourseProgress(course.id).filter((p) => p.user_id === user.id && p.completed);
      if (progress.length === 0) continue; // not started — not "my courses" yet
      const entry: CourseWithProgress = {
        course,
        percent: Math.round((progress.length / lessons.length) * 100),
        completedLessons: progress.length,
        totalLessons: lessons.length,
      };
      if (progress.length === lessons.length) completedList.push(entry);
      else currentList.push(entry);
    }
    return { current: currentList, completed: completedList };
  }, [user]);

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول لعرض دوراتك.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/my-courses">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

  const visible = tab === "current" ? current : completed;

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              العودة إلى الأكاديمية
            </Link>
          </Button>
          <AcademySectionHeader
            icon={BookOpen}
            title="دوراتي"
            description="الدورات الحالية والمكتملة في مكان واحد"
            headingId="my-courses-heading"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="current">قيد التعلّم ({current.length})</TabsTrigger>
            <TabsTrigger value="completed">مكتملة ({completed.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">
            {tab === "current" ? "لا توجد دورات قيد التعلّم حالياً — " : "لم تُكمل أي دورة بعد — "}
            <Link to="/academy/courses" className="text-primary hover:underline">تصفّح الدورات</Link>
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="دوراتي">
            {visible.map(({ course, percent, completedLessons, totalLessons }) => (
              <li key={course.id} className="p-5 rounded-2xl border border-border bg-card space-y-3">
                <Link to={`/academy/courses/${course.id}`} className="font-bold text-foreground hover:underline block truncate">{course.title}</Link>
                <Progress value={percent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{completedLessons} / {totalLessons} درس</span>
                  {tab === "completed" && <span className="flex items-center gap-1 text-primary font-bold"><Award className="w-3.5 h-3.5" aria-hidden="true" />مكتملة</span>}
                  {tab === "current" && <span>{percent}%</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
