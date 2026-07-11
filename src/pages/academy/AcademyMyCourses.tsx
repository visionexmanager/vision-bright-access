import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { useMyCourses } from "@/hooks/academy/useMyCourses";

type Tab = "current" | "completed";

export default function AcademyMyCourses() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("current");
  const { myCourses, isLoading } = useMyCourses();

  const { current, completed } = useMemo(() => {
    const currentList = myCourses.filter((row) => !row.enrollment.completed_at);
    const completedList = myCourses.filter((row) => !!row.enrollment.completed_at);
    return { current: currentList, completed: completedList };
  }, [myCourses]);

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

        {isLoading ? (
          <p className="text-sm text-muted-foreground p-8 text-center">جارِ التحميل...</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">
            {tab === "current" ? "لا توجد دورات قيد التعلّم حالياً — " : "لم تُكمل أي دورة بعد — "}
            <Link to="/academy/courses" className="text-primary hover:underline">تصفّح الدورات</Link>
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="دوراتي">
            {visible.map(({ course, enrollment }) => (
              <li key={course!.id} className="p-5 rounded-2xl border border-border bg-card space-y-3">
                <Link to={`/academy/courses/${course!.id}`} className="font-bold text-foreground hover:underline block truncate">{course!.title}</Link>
                <Progress value={enrollment.progress_percent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {tab === "completed" && <span className="flex items-center gap-1 text-primary font-bold"><Award className="w-3.5 h-3.5" aria-hidden="true" />مكتملة</span>}
                  <span>{Math.round(enrollment.progress_percent)}%</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
