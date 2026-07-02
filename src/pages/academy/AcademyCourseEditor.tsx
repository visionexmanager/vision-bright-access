import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Eye, Save, Send,
  GripVertical, BookOpen, HelpCircle, ClipboardList, Rocket, Settings2, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TagInput } from "@/components/academy/ui/TagInput";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { QuizBuilder } from "@/components/academy/assessment/QuizBuilder";
import { AssignmentBuilder } from "@/components/academy/assessment/AssignmentBuilder";
import { ProjectBuilder } from "@/components/academy/assessment/ProjectBuilder";
import {
  getOrCreateMyInstructorProfile, getCourseByIdAny, createCourseLocal, updateCourseLocal,
  getModulesForCourseAny, getLessonsForCourseAny, saveModulesForCourse, saveLessonsForCourse,
  setCourseStatusLocal,
} from "@/lib/academy/instructorLocalStore";
import {
  getQuizForLessonAny, saveQuizForLesson, getAssignmentForLessonAny, saveAssignmentForLesson,
  getProjectForLessonAny, saveProjectForLesson,
} from "@/lib/academy/assessmentLocalStore";
import type { AcademyCourseModuleRow, AcademyCourseDifficulty } from "@/lib/types/academy-modules";
import type { AcademyLessonRow, AcademyLessonKind, AcademyQuizRow, AcademyQuizQuestionRow, AcademyAssignmentRow, AcademyProjectRow } from "@/lib/types/academy-lms";

const LESSON_KIND_LABELS: Record<AcademyLessonKind, string> = {
  video: "فيديو",
  youtube: "يوتيوب مضمّن",
  text: "نص",
  pdf: "ملف PDF",
  presentation: "عرض تقديمي",
  audio: "صوت",
  external_link: "رابط خارجي",
  downloads: "ملفات للتنزيل",
  live_session: "جلسة مباشرة (تحضير)",
  code_example: "مثال برمجي",
  exercise: "تمرين",
  quiz: "اختبار قصير",
  assignment: "واجب",
  project: "مشروع",
};

function blankLesson(moduleId: string, courseId: string, orderIndex: number): AcademyLessonRow {
  return {
    id: `local-lesson-${crypto.randomUUID()}`,
    module_id: moduleId,
    course_id: courseId,
    title: "درس جديد",
    kind: "video",
    order_index: orderIndex,
    duration_seconds: 0,
    video_url: null,
    youtube_video_id: null,
    body_markdown: null,
    file_url: null,
    live_session_scheduled_at: null,
    attachments: [],
    external_links: [],
    code_snippets: [],
    is_preview: false,
  };
}

function EditableList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={item}
            onChange={(e) => onChange(items.map((it, idx) => (idx === i ? e.target.value : it)))}
            className="rounded-xl"
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(items.filter((_, idx) => idx !== i))} aria-label="حذف السطر">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])} className="gap-1.5 rounded-xl">
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        {placeholder}
      </Button>
    </div>
  );
}

function LessonEditor({ lesson, onChange, onRemove, onMoveUp, onMoveDown }: {
  lesson: AcademyLessonRow;
  onChange: (updates: Partial<AcademyLessonRow>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const hasQuizContent = lesson.kind === "quiz" && !!getQuizForLessonAny(lesson.id);
  const hasAssignmentContent = lesson.kind === "assignment" && !!getAssignmentForLessonAny(lesson.id);
  const hasProjectContent = lesson.kind === "project" && !!getProjectForLessonAny(lesson.id);
  const hasContent = hasQuizContent || hasAssignmentContent || hasProjectContent;

  return (
    <div className="p-4 rounded-2xl bg-background border border-border space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <Input value={lesson.title} onChange={(e) => onChange({ title: e.target.value })} className="rounded-xl flex-1" aria-label="عنوان الدرس" />
        <Select value={lesson.kind} onValueChange={(v) => onChange({ kind: v as AcademyLessonKind })}>
          <SelectTrigger className="w-44 rounded-xl shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(LESSON_KIND_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onMoveUp} aria-label="نقل لأعلى"><ChevronUp className="w-4 h-4" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onMoveDown} aria-label="نقل لأسفل"><ChevronDown className="w-4 h-4" /></Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={onRemove} aria-label="حذف الدرس"><Trash2 className="w-4 h-4" /></Button>
      </div>

      {lesson.kind === "video" && (
        <Input value={lesson.video_url ?? ""} onChange={(e) => onChange({ video_url: e.target.value || null })} placeholder="رابط الفيديو (استضافة الفيديو غير مفعّلة بعد — أدخل رابطاً مباشراً)" className="rounded-xl text-sm" />
      )}
      {lesson.kind === "youtube" && (
        <Input value={lesson.youtube_video_id ?? ""} onChange={(e) => onChange({ youtube_video_id: e.target.value || null })} placeholder="معرّف فيديو يوتيوب" className="rounded-xl text-sm" />
      )}
      {(lesson.kind === "text" || lesson.kind === "exercise") && (
        <Textarea value={lesson.body_markdown ?? ""} onChange={(e) => onChange({ body_markdown: e.target.value || null })} placeholder="المحتوى (Markdown مدعوم)" className="rounded-xl text-sm min-h-24" />
      )}
      {(lesson.kind === "pdf" || lesson.kind === "presentation" || lesson.kind === "audio") && (
        <Input value={lesson.file_url ?? ""} onChange={(e) => onChange({ file_url: e.target.value || null })} placeholder="رابط الملف المستضاف" className="rounded-xl text-sm" />
      )}
      {lesson.kind === "external_link" && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={lesson.external_links[0]?.label ?? ""}
            onChange={(e) => onChange({ external_links: [{ label: e.target.value, url: lesson.external_links[0]?.url ?? "" }] })}
            placeholder="عنوان الرابط" className="rounded-xl text-sm"
          />
          <Input
            value={lesson.external_links[0]?.url ?? ""}
            onChange={(e) => onChange({ external_links: [{ label: lesson.external_links[0]?.label ?? "", url: e.target.value }] })}
            placeholder="https://..." className="rounded-xl text-sm"
          />
        </div>
      )}
      {lesson.kind === "code_example" && (
        <div className="grid grid-cols-1 gap-2">
          <Input
            value={lesson.code_snippets[0]?.language ?? ""}
            onChange={(e) => onChange({ code_snippets: [{ language: e.target.value, code: lesson.code_snippets[0]?.code ?? "" }] })}
            placeholder="اللغة البرمجية (مثال: python)" className="rounded-xl text-sm"
          />
          <Textarea
            value={lesson.code_snippets[0]?.code ?? ""}
            onChange={(e) => onChange({ code_snippets: [{ language: lesson.code_snippets[0]?.language ?? "", code: e.target.value }] })}
            placeholder="الكود..." dir="ltr" className="rounded-xl text-sm min-h-20 font-mono"
          />
        </div>
      )}
      {lesson.kind === "live_session" && (
        <>
          <Input
            type="datetime-local"
            value={lesson.live_session_scheduled_at ?? ""}
            onChange={(e) => onChange({ live_session_scheduled_at: e.target.value || null })}
            className="rounded-xl text-sm"
          />
          <p className="text-xs text-muted-foreground">تحضير فقط — البث المباشر الفعلي غير مفعّل بعد.</p>
        </>
      )}
      {(lesson.kind === "quiz" || lesson.kind === "assignment" || lesson.kind === "project") && (
        <div className="flex items-center gap-2 ps-6">
          <Button type="button" variant={hasContent ? "outline" : "default"} size="sm" onClick={() => setBuilderOpen(true)} className="gap-1.5 rounded-xl">
            {lesson.kind === "quiz" && <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />}
            {lesson.kind === "assignment" && <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />}
            {lesson.kind === "project" && <Rocket className="w-3.5 h-3.5" aria-hidden="true" />}
            {hasContent
              ? (lesson.kind === "quiz" ? "تعديل الاختبار" : lesson.kind === "assignment" ? "تعديل الواجب" : "تعديل المشروع")
              : (lesson.kind === "quiz" ? "إعداد الاختبار" : lesson.kind === "assignment" ? "إعداد الواجب" : "إعداد المشروع")}
          </Button>
          {hasContent && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />تم الإعداد</span>}

          <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" aria-hidden="true" />
                  {lesson.kind === "quiz" && "إعداد الاختبار"}
                  {lesson.kind === "assignment" && "إعداد الواجب"}
                  {lesson.kind === "project" && "إعداد المشروع"}
                </DialogTitle>
              </DialogHeader>

              {lesson.kind === "quiz" && (() => {
                const existing = getQuizForLessonAny(lesson.id);
                return (
                  <QuizBuilder
                    initialQuiz={existing?.quiz}
                    initialQuestions={existing?.questions}
                    onSave={(quizData: Partial<AcademyQuizRow>, questions: AcademyQuizQuestionRow[]) => {
                      saveQuizForLesson(lesson.id, quizData, questions);
                      setBuilderOpen(false);
                    }}
                  />
                );
              })()}

              {lesson.kind === "assignment" && (() => {
                const existing = getAssignmentForLessonAny(lesson.id) ?? undefined;
                return (
                  <AssignmentBuilder
                    initial={existing}
                    onSave={(data: Partial<AcademyAssignmentRow>) => {
                      saveAssignmentForLesson(lesson.id, data);
                      setBuilderOpen(false);
                    }}
                  />
                );
              })()}

              {lesson.kind === "project" && (() => {
                const existing = getProjectForLessonAny(lesson.id) ?? undefined;
                return (
                  <ProjectBuilder
                    initial={existing}
                    onSave={(data: Partial<AcademyProjectRow>) => {
                      saveProjectForLesson(lesson.id, data);
                      setBuilderOpen(false);
                    }}
                  />
                );
              })()}
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Input
        type="number" min={0}
        value={lesson.duration_seconds}
        onChange={(e) => onChange({ duration_seconds: Number(e.target.value) })}
        placeholder="المدة بالثواني"
        className="rounded-xl text-sm w-40"
        aria-label="مدة الدرس بالثواني"
      />
    </div>
  );
}

export default function AcademyCourseEditor() {
  const { courseId: routeCourseId } = useParams<{ courseId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const instructor = user ? getOrCreateMyInstructorProfile(user.id) : null;
  const [courseId, setCourseId] = useState<string | null>(routeCourseId ?? null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<AcademyCourseDifficulty>("beginner");
  const [language, setLanguage] = useState("العربية");
  const [tags, setTags] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [modules, setModules] = useState<AcademyCourseModuleRow[]>([]);
  const [lessons, setLessons] = useState<AcademyLessonRow[]>([]);
  const [saved, setSaved] = useState(false);

  // Create the draft course record once, on first mount of the "new" route.
  useEffect(() => {
    if (routeCourseId || !instructor) return;
    const created = createCourseLocal(instructor.id, {});
    setCourseId(created.id);
    navigate(`/academy/instructor/courses/${created.id}/edit`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructor?.id]);

  useEffect(() => {
    if (!courseId) return;
    const course = getCourseByIdAny(courseId);
    if (!course) return;
    setTitle(course.title === "دورة جديدة بدون عنوان" ? "" : course.title);
    setDescription(course.description);
    setCategory(course.category);
    setDifficulty(course.difficulty);
    setLanguage(course.language);
    setTags(course.tags);
    setOutcomes(course.learning_outcomes);
    setRequirements(course.requirements);
    setModules(getModulesForCourseAny(courseId));
    setLessons(getLessonsForCourseAny(courseId));
  }, [courseId]);

  const lessonsByModule = useMemo(() => {
    const map: Record<string, AcademyLessonRow[]> = {};
    lessons.forEach((l) => { (map[l.module_id] ??= []).push(l); });
    Object.values(map).forEach((list) => list.sort((a, b) => a.order_index - b.order_index));
    return map;
  }, [lessons]);

  const persist = useCallback((status?: "draft" | "published") => {
    if (!courseId) return;
    updateCourseLocal(courseId, {
      title: title.trim() || "دورة جديدة بدون عنوان",
      description, category, difficulty, language, tags,
      learning_outcomes: outcomes.filter((o) => o.trim()), requirements: requirements.filter((r) => r.trim()),
    });
    saveModulesForCourse(courseId, modules);
    saveLessonsForCourse(courseId, lessons);
    if (status) setCourseStatusLocal(courseId, status);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [courseId, title, description, category, difficulty, language, tags, outcomes, requirements, modules, lessons]);

  const addModule = () => {
    if (!courseId) return;
    setModules((prev) => [...prev, { id: `local-mod-${crypto.randomUUID()}`, course_id: courseId, title: "وحدة جديدة", order_index: prev.length + 1, content_url: null }]);
  };
  const removeModule = (moduleId: string) => {
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
    setLessons((prev) => prev.filter((l) => l.module_id !== moduleId));
  };
  const moveModule = (moduleId: string, dir: -1 | 1) => {
    setModules((prev) => {
      const idx = prev.findIndex((m) => m.id === moduleId);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((m, i) => ({ ...m, order_index: i + 1 }));
    });
  };

  const addLesson = (moduleId: string) => {
    if (!courseId) return;
    const count = (lessonsByModule[moduleId] ?? []).length;
    setLessons((prev) => [...prev, blankLesson(moduleId, courseId, count + 1)]);
  };
  const updateLesson = (lessonId: string, updates: Partial<AcademyLessonRow>) => {
    setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, ...updates } : l)));
  };
  const removeLesson = (lessonId: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== lessonId));
  };
  const moveLesson = (moduleId: string, lessonId: string, dir: -1 | 1) => {
    const moduleLessons = [...(lessonsByModule[moduleId] ?? [])];
    const idx = moduleLessons.findIndex((l) => l.id === lessonId);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= moduleLessons.length) return;
    [moduleLessons[idx], moduleLessons[swapIdx]] = [moduleLessons[swapIdx], moduleLessons[idx]];
    const reordered = moduleLessons.map((l, i) => ({ ...l, order_index: i + 1 }));
    setLessons((prev) => [...prev.filter((l) => l.module_id !== moduleId), ...reordered]);
  };

  if (!user || !instructor) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب أن تكون مدرّساً معتمداً لإنشاء الدورات.</p>
          <Button asChild className="rounded-xl"><Link to="/academy/instructor/apply">التقديم كمدرّس</Link></Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 font-sans text-start">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="ghost" size="sm" asChild className="gap-1 rounded-xl">
            <Link to="/academy/instructor/dashboard?section=courses"><ArrowLeft className="w-4 h-4" aria-hidden="true" />دوراتي</Link>
          </Button>
          <div className="flex items-center gap-2">
            {courseId && (
              <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-xl">
                <Link to={`/academy/courses/${courseId}`}><Eye className="w-3.5 h-3.5" aria-hidden="true" />معاينة</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => persist("draft")} className="gap-1.5 rounded-xl">
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              {saved ? "تم الحفظ ✓" : "حفظ كمسودة"}
            </Button>
            <Button size="sm" onClick={() => persist("published")} className="gap-1.5 rounded-xl">
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              نشر الدورة
            </Button>
          </div>
        </div>

        {/* Course meta */}
        <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm space-y-5">
          <AcademySectionHeader icon={BookOpen} title="تفاصيل الدورة" headingId="course-meta-heading" />
          <div>
            <label htmlFor="course-title" className="text-sm font-bold text-foreground">عنوان الدورة</label>
            <Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl mt-1.5" />
          </div>
          <div>
            <label htmlFor="course-desc" className="text-sm font-bold text-foreground">الوصف</label>
            <Textarea id="course-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl mt-1.5 min-h-24" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="course-category" className="text-sm font-bold text-foreground">الفئة</label>
              <Input id="course-category" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-bold text-foreground">المستوى</label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as AcademyCourseDifficulty)}>
                <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">مبتدئ</SelectItem>
                  <SelectItem value="intermediate">متوسط</SelectItem>
                  <SelectItem value="advanced">متقدّم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="course-lang" className="text-sm font-bold text-foreground">اللغة</label>
              <Input id="course-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-xl mt-1.5" />
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-foreground">الوسوم</label>
            <div className="mt-1.5"><TagInput values={tags} onChange={setTags} placeholder="أضف وسماً" /></div>
          </div>
          <div>
            <label className="text-sm font-bold text-foreground">مخرجات التعلّم</label>
            <div className="mt-1.5"><EditableList items={outcomes} onChange={setOutcomes} placeholder="إضافة مخرج تعلّم" /></div>
          </div>
          <div>
            <label className="text-sm font-bold text-foreground">المتطلبات</label>
            <div className="mt-1.5"><EditableList items={requirements} onChange={setRequirements} placeholder="إضافة متطلب" /></div>
          </div>
        </div>

        {/* Curriculum builder */}
        <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm space-y-4">
          <AcademySectionHeader
            icon={BookOpen}
            title="منهج الدورة"
            description="الوحدات والدروس"
            headingId="curriculum-builder-heading"
            action={<Button size="sm" onClick={addModule} className="gap-1.5 rounded-xl"><Plus className="w-3.5 h-3.5" aria-hidden="true" />وحدة جديدة</Button>}
          />

          {modules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed border-border rounded-2xl">لا توجد وحدات بعد. أضف وحدتك الأولى.</p>
          ) : (
            <div className="space-y-4">
              {modules.map((module) => (
                <div key={module.id} className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={module.title}
                      onChange={(e) => setModules((prev) => prev.map((m) => (m.id === module.id ? { ...m, title: e.target.value } : m)))}
                      className="rounded-xl flex-1 font-bold"
                      aria-label="عنوان الوحدة"
                    />
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => moveModule(module.id, -1)} aria-label="نقل الوحدة لأعلى"><ChevronUp className="w-4 h-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => moveModule(module.id, 1)} aria-label="نقل الوحدة لأسفل"><ChevronDown className="w-4 h-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeModule(module.id)} aria-label="حذف الوحدة"><Trash2 className="w-4 h-4" /></Button>
                  </div>

                  <div className="space-y-2 ps-2">
                    {(lessonsByModule[module.id] ?? []).map((lesson) => (
                      <LessonEditor
                        key={lesson.id}
                        lesson={lesson}
                        onChange={(updates) => updateLesson(lesson.id, updates)}
                        onRemove={() => removeLesson(lesson.id)}
                        onMoveUp={() => moveLesson(module.id, lesson.id, -1)}
                        onMoveDown={() => moveLesson(module.id, lesson.id, 1)}
                      />
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => addLesson(module.id)} className="gap-1.5 rounded-xl">
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      إضافة درس
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
