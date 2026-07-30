import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Plus, Users, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCourseUnits, useCourseLessons } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { useCreateUnit, useCreateLesson, useCourseRoster } from "@/features/visionkids/hooks/academy/useAcademyTeacher";
import { useCourseHomework, useSubmissionsForHomework, useGradeHomeworkSubmission } from "@/features/visionkids/hooks/academy/useAcademyAssignments";

function GradingPanel({ courseId }: { courseId: string }) {
  const { t } = useLanguage();
  const { data: homeworkList = [] } = useCourseHomework(courseId);
  const [activeHomeworkId, setActiveHomeworkId] = useState<string | undefined>(homeworkList[0]?.id);
  const { data: submissions = [] } = useSubmissionsForHomework(activeHomeworkId);
  const gradeSubmission = useGradeHomeworkSubmission();
  const [grades, setGrades] = useState<Record<string, string>>({});

  if (homeworkList.length === 0) return <p className="text-muted-foreground">{t("kids.academy.noHomeworkYet")}</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {homeworkList.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setActiveHomeworkId(h.id)}
            className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${activeHomeworkId === h.id ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border"}`}
          >
            {h.title}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {submissions.length === 0 && <p className="text-sm text-muted-foreground">{t("kids.academy.noSubmissionsYet")}</p>}
        {submissions.map((s) => (
          <div key={s.id} className="rounded-xl border-2 border-border p-3">
            {s.text_answer && <p className="text-sm">{s.text_answer}</p>}
            {s.file_urls.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {s.file_urls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-kids-primary hover:underline">{t("kids.academy.viewFile")}</a>)}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={grades[s.id] ?? s.grade ?? ""}
                onChange={(e) => setGrades((prev) => ({ ...prev, [s.id]: e.target.value }))}
                placeholder="0-100"
                className="w-24"
              />
              <Button
                size="sm"
                onClick={() => grades[s.id] && gradeSubmission.mutate({ submissionId: s.id, grade: Number(grades[s.id]) })}
                disabled={!grades[s.id]}
              >
                {t("kids.academy.saveGrade")}
              </Button>
              {s.status === "graded" && <span className="text-xs text-kids-green">{t("kids.academy.graded")}: {s.grade}%</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeacherCourseManage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { t } = useLanguage();

  const { data: units = [] } = useCourseUnits(courseId);
  const { data: lessons = [] } = useCourseLessons(courseId);
  const { data: roster = [] } = useCourseRoster(courseId);
  const createUnit = useCreateUnit();
  const createLesson = useCreateLesson();

  const [unitTitle, setUnitTitle] = useState("");
  const [lessonUnitId, setLessonUnitId] = useState<string | undefined>(units[0]?.id);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");

  useDocumentHead({ title: t("kids.academy.manageCourse"), description: "", canonicalPath: `/kids/academy/teacher/course/${courseId}` });

  if (!courseId) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to="/kids/academy/teacher" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.teacherDashboardTitle")}
      </Link>
      <h1 className="font-heading text-2xl font-extrabold">{t("kids.academy.manageCourse")}</h1>

      <Tabs defaultValue="content" className="mt-6">
        <TabsList>
          <TabsTrigger value="content">{t("kids.academy.contentTab")}</TabsTrigger>
          <TabsTrigger value="roster" className="gap-1"><Users className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.rosterTab")}</TabsTrigger>
          <TabsTrigger value="grading" className="gap-1"><FileCheck className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.gradingTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4 flex flex-col gap-6">
          <div className="rounded-2xl border-2 border-border bg-card p-4">
            <p className="mb-2 font-semibold">{t("kids.academy.addUnit")}</p>
            <div className="flex gap-2">
              <Input value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} placeholder={t("kids.academy.unitTitlePlaceholder")} />
              <Button
                onClick={() => { if (unitTitle.trim()) { createUnit.mutate({ courseId, title: unitTitle.trim(), orderIndex: units.length + 1 }); setUnitTitle(""); } }}
                disabled={!unitTitle.trim()}
                className="gap-1"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.add")}
              </Button>
            </div>
            <ul className="mt-3 flex flex-col gap-1">
              {units.map((u) => <li key={u.id} className="text-sm text-muted-foreground">{u.order_index}. {u.title}</li>)}
            </ul>
          </div>

          {units.length > 0 && (
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <p className="mb-2 font-semibold">{t("kids.academy.addLesson")}</p>
              <div className="flex flex-col gap-2">
                <select
                  value={lessonUnitId}
                  onChange={(e) => setLessonUnitId(e.target.value)}
                  className="rounded-lg border-2 border-border bg-background px-3 py-2 text-sm"
                >
                  {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
                </select>
                <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder={t("kids.academy.lessonTitlePlaceholder")} />
                <Textarea value={lessonContent} onChange={(e) => setLessonContent(e.target.value)} placeholder={t("kids.academy.lessonContentPlaceholder")} className="min-h-24" />
                <Button
                  onClick={() => {
                    if (lessonTitle.trim() && lessonUnitId) {
                      createLesson.mutate({ unitId: lessonUnitId, courseId, title: lessonTitle.trim(), content: lessonContent.trim(), orderIndex: lessons.length + 1 });
                      setLessonTitle(""); setLessonContent("");
                    }
                  }}
                  disabled={!lessonTitle.trim() || !lessonUnitId}
                  className="self-start gap-1 bg-kids-primary text-white hover:bg-kids-primary/90"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.addLesson")}
                </Button>
              </div>
              <ul className="mt-3 flex flex-col gap-1">
                {lessons.map((l) => <li key={l.id} className="text-sm text-muted-foreground">{l.order_index}. {l.title}</li>)}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="roster" className="mt-4">
          {roster.length === 0 ? (
            <p className="text-muted-foreground">{t("kids.academy.noStudentsYet")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{roster.length} {t("kids.academy.studentsEnrolled")}</p>
          )}
        </TabsContent>

        <TabsContent value="grading" className="mt-4">
          <GradingPanel courseId={courseId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
