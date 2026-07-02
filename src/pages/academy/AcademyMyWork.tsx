import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ClipboardList, HelpCircle, Rocket, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { getLessonById } from "@/lib/academy/mockCourses";
import { getCourseByIdAny } from "@/lib/academy/instructorLocalStore";
import {
  getAllQuizAttemptsForUser, getAllAssignmentSubmissionsForUser, getAllProjectSubmissionsForUser,
  getQuizByIdAny, getAssignmentByIdAny, getProjectByIdAny,
} from "@/lib/academy/assessmentLocalStore";

type Tab = "quizzes" | "assignments" | "projects";

function LessonLink({ lessonId }: { lessonId: string }) {
  const lesson = getLessonById(lessonId);
  if (!lesson) return <span className="text-muted-foreground">درس محذوف</span>;
  const course = getCourseByIdAny(lesson.course_id);
  return (
    <Link to={`/academy/courses/${lesson.course_id}/learn/${lesson.id}`} className="text-primary hover:underline">
      {course?.title ?? "دورة"} — {lesson.title}
    </Link>
  );
}

export default function AcademyMyWork() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("quizzes");

  const quizAttempts = useMemo(() => (user ? getAllQuizAttemptsForUser(user.id) : []), [user]);
  const assignmentSubmissions = useMemo(() => (user ? getAllAssignmentSubmissionsForUser(user.id) : []), [user]);
  const projectSubmissions = useMemo(() => (user ? getAllProjectSubmissionsForUser(user.id) : []), [user]);

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول لعرض أعمالك.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/my-work">تسجيل الدخول</Link></Button>
        </div>
      </Layout>
    );
  }

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
            icon={ClipboardList}
            title="أعمالي"
            description="نتائج اختباراتك وواجباتك ومشاريعك عبر كل الدورات"
            headingId="my-work-heading"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="quizzes" className="gap-1.5"><HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />نتائج الاختبارات ({quizAttempts.length})</TabsTrigger>
            <TabsTrigger value="assignments" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />الواجبات ({assignmentSubmissions.length})</TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5"><Rocket className="w-3.5 h-3.5" aria-hidden="true" />المشاريع ({projectSubmissions.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "quizzes" && (
          quizAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">لم تخض أي اختبار بعد.</p>
          ) : (
            <ul className="space-y-2" aria-label="نتائج الاختبارات">
              {quizAttempts.map((attempt) => {
                const quiz = getQuizByIdAny(attempt.quiz_id);
                return (
                  <li key={attempt.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{quiz?.title ?? "اختبار"}</p>
                      {quiz && <p className="text-xs text-muted-foreground mt-1"><LessonLink lessonId={quiz.lesson_id} /></p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(attempt.submitted_at).toLocaleDateString("ar")} · المحاولة {attempt.attempt_number}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={attempt.passed ? "default" : "destructive"} className="gap-1">
                        {attempt.passed ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : <XCircle className="w-3 h-3" aria-hidden="true" />}
                        {attempt.score_percent}%
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {tab === "assignments" && (
          assignmentSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">لم تُسلّم أي واجب بعد.</p>
          ) : (
            <ul className="space-y-2" aria-label="الواجبات">
              {assignmentSubmissions.map((sub) => {
                const assignment = getAssignmentByIdAny(sub.assignment_id);
                return (
                  <li key={sub.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{assignment?.title ?? "واجب"}</p>
                      {assignment && <p className="text-xs text-muted-foreground mt-1"><LessonLink lessonId={assignment.lesson_id} /></p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(sub.submitted_at).toLocaleDateString("ar")} · المحاولة {sub.attempt_number}</p>
                    </div>
                    <Badge variant={sub.status === "graded" ? "default" : "secondary"} className="gap-1 shrink-0">
                      {sub.status === "graded" ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : <Clock className="w-3 h-3" aria-hidden="true" />}
                      {sub.status === "graded" ? `${sub.score ?? 0} نقطة` : "قيد المراجعة"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {tab === "projects" && (
          projectSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">لم تُسلّم أي مشروع بعد.</p>
          ) : (
            <ul className="space-y-2" aria-label="المشاريع">
              {projectSubmissions.map((sub) => {
                const project = getProjectByIdAny(sub.project_id);
                return (
                  <li key={sub.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{project?.title ?? "مشروع"}</p>
                      {project && <p className="text-xs text-muted-foreground mt-1"><LessonLink lessonId={project.lesson_id} /></p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(sub.submitted_at).toLocaleDateString("ar")} · المحاولة {sub.attempt_number}</p>
                    </div>
                    <Badge variant={sub.status === "reviewed" ? "default" : "secondary"} className="gap-1 shrink-0">
                      {sub.status === "reviewed" ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : <Clock className="w-3 h-3" aria-hidden="true" />}
                      {sub.status === "reviewed" ? "تمت المراجعة" : "قيد المراجعة"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>
    </Layout>
  );
}
