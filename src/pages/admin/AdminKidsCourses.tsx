import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

type DraftCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  difficulty: string;
  age_range: string;
  lesson_count: number;
  created_at: string;
  subject_id: string | null;
};
type Unit = { id: string; title: string; description: string | null; order_index: number };
type Lesson = { id: string; unit_id: string; title: string; description: string | null; content: string | null; estimated_minutes: number; order_index: number };
type Subject = { id: string; slug: string; name: string };

const AGE_RANGES = ["3-5", "6-8", "9-12"];

export default function AdminKidsCourses() {
  const { t, lang } = useLanguage();
  const [drafts, setDrafts] = useState<DraftCourse[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [subjectSlug, setSubjectSlug] = useState("");
  const [ageRange, setAgeRange] = useState("6-8");
  const [topic, setTopic] = useState("");

  useDocumentHead({ title: t("admin.kidsCourses.title"), description: t("admin.kidsCourses.subtitle"), canonicalPath: "/admin/kids-courses" });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: courseRows }, { data: subjectRows }] = await Promise.all([
      supabase.from("kids_courses").select("id, slug, title, subtitle, description, difficulty, age_range, lesson_count, created_at, subject_id").eq("status", "draft").order("created_at", { ascending: false }),
      supabase.from("kids_subjects").select("id, slug, name").eq("is_active", true).order("display_order"),
    ]);
    setDrafts(courseRows ?? []);
    setSubjects(subjectRows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Opening a draft is what loads its lessons — and reading them is what
   *  unlocks publishing. A publish button on the list would let a whole course
   *  reach children on one click from a title alone. */
  const openDraft = async (course: DraftCourse) => {
    if (openId === course.id) { setOpenId(null); return; }
    setOpenId(course.id);
    setDetailLoading(true);
    const [{ data: unitRows }, { data: lessonRows }] = await Promise.all([
      supabase.from("kids_units").select("id, title, description, order_index").eq("course_id", course.id).order("order_index"),
      supabase.from("kids_lessons").select("id, unit_id, title, description, content, estimated_minutes, order_index").eq("course_id", course.id).order("order_index"),
    ]);
    setUnits(unitRows ?? []);
    setLessons(lessonRows ?? []);
    setDetailLoading(false);
  };

  const publish = async (course: DraftCourse) => {
    setBusyId(course.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("kids_courses").update({ status: "published", published_at: now }).eq("id", course.id);
    if (error) { toast.error(error.message); setBusyId(null); return; }
    await supabase.from("kids_lessons").update({ status: "published" }).eq("course_id", course.id);
    toast.success(t("admin.kidsCourses.published").replace("{title}", course.title));
    setBusyId(null);
    setOpenId(null);
    load();
  };

  const discard = async (course: DraftCourse) => {
    setBusyId(course.id);
    const { error } = await supabase.from("kids_courses").delete().eq("id", course.id);
    if (error) toast.error(error.message);
    else toast.success(t("admin.kidsCourses.discarded").replace("{title}", course.title));
    setBusyId(null);
    setOpenId(null);
    load();
  };

  const generate = async () => {
    if (!subjectSlug) return;
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("kids-course-generate", {
      body: { subjectSlug, ageRange, language: lang, topic: topic.trim() || undefined },
    });
    setGenerating(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { title?: string; provider?: string } | null;
    toast.success(t("admin.kidsCourses.generated").replace("{title}", result?.title ?? "").replace("{provider}", result?.provider ?? ""));
    setTopic("");
    load();
  };

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin" aria-label={t("admin.kidsCourses.backToAdmin")}><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Link>
          </Button>
          <h1 className="text-3xl font-bold">{t("admin.kidsCourses.title")}</h1>
          {drafts.length > 0 && <Badge className="bg-yellow-500">{t("admin.kidsCourses.draftBadge").replace("{count}", String(drafts.length))}</Badge>}
        </div>
        <p className="mb-8 text-muted-foreground">{t("admin.kidsCourses.subtitle")}</p>

        <Card className="mb-8">
          <CardContent className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5" aria-hidden="true" />{t("admin.kidsCourses.generateTitle")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="kc-subject">{t("admin.kidsCourses.subject")}</Label>
                <Select value={subjectSlug} onValueChange={setSubjectSlug}>
                  <SelectTrigger id="kc-subject" className="mt-1"><SelectValue placeholder={t("admin.kidsCourses.chooseSubject")} /></SelectTrigger>
                  <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="kc-age">{t("admin.kidsCourses.ageRange")}</Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger id="kc-age" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{AGE_RANGES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="kc-topic">{t("admin.kidsCourses.topicOptional")}</Label>
                <Input id="kc-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} className="mt-1" />
              </div>
            </div>
            <Button className="mt-4" onClick={generate} disabled={!subjectSlug || generating}>
              {generating ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="me-2 h-4 w-4" aria-hidden="true" />}
              {generating ? t("admin.kidsCourses.generating") : t("admin.kidsCourses.generateAction")}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">{t("admin.kidsCourses.generateNote")}</p>
          </CardContent>
        </Card>

        <h2 className="mb-4 text-xl font-bold">{t("admin.kidsCourses.pendingTitle")}</h2>
        <p role="status" aria-live="polite" className="sr-only">
          {loading ? t("admin.kidsCourses.loading") : t("admin.kidsCourses.draftBadge").replace("{count}", String(drafts.length))}
        </p>

        {loading ? (
          <div className="space-y-3" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : drafts.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">{t("admin.kidsCourses.noDrafts")}</p>
        ) : (
          <ul className="space-y-3">
            {drafts.map((course) => {
              const isOpen = openId === course.id;
              return (
                <li key={course.id} className="rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{course.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {course.age_range} · {course.difficulty} · {t("admin.kidsCourses.lessonCount").replace("{count}", String(course.lesson_count))}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => openDraft(course)} aria-expanded={isOpen} aria-controls={`draft-${course.id}`}>
                      {isOpen ? t("admin.kidsCourses.close") : t("admin.kidsCourses.review")}
                    </Button>
                  </div>

                  {isOpen && (
                    <div id={`draft-${course.id}`} className="border-t border-border p-4">
                      {course.description && <p className="mb-4 text-sm text-muted-foreground">{course.description}</p>}
                      {detailLoading ? (
                        <p className="text-sm text-muted-foreground">{t("admin.kidsCourses.loading")}</p>
                      ) : (
                        <>
                          {units.map((unit) => (
                            <div key={unit.id} className="mb-5">
                              <h3 className="font-bold">{unit.title}</h3>
                              {unit.description && <p className="text-sm text-muted-foreground">{unit.description}</p>}
                              <ul className="mt-2 space-y-3">
                                {lessons.filter((l) => l.unit_id === unit.id).map((lesson) => (
                                  <li key={lesson.id} className="rounded-lg bg-muted/40 p-3">
                                    <p className="font-semibold">{lesson.title} <span className="text-xs font-normal text-muted-foreground">· {lesson.estimated_minutes} min</span></p>
                                    {lesson.description && <p className="text-sm text-muted-foreground">{lesson.description}</p>}
                                    {lesson.content && <p className="mt-2 whitespace-pre-wrap text-sm">{lesson.content}</p>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                            <Button onClick={() => publish(course)} disabled={busyId === course.id}>
                              <Check className="me-2 h-4 w-4" aria-hidden="true" />{t("admin.kidsCourses.publish")}
                            </Button>
                            <Button variant="destructive" onClick={() => discard(course)} disabled={busyId === course.id}>
                              <Trash2 className="me-2 h-4 w-4" aria-hidden="true" />{t("admin.kidsCourses.discard")}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Layout>
  );
}
