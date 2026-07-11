import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Bookmark, StickyNote, GraduationCap, Landmark, Trash2, PlayCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { useMyLessonWork } from "@/hooks/academy/useMyCourses";
import { fetchLessonById, fetchCourseById, removeLessonNote, removeLessonBookmark } from "@/services/academy/lms";
import { queryKeys } from "@/lib/api/queryKeys";
import type { AcademyLessonRow } from "@/lib/types/academy-lms";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";
import { getSavedScholarshipIds, getScholarshipByIdLocal, toggleSavedScholarshipLocal } from "@/lib/academy/scholarshipLocalStore";
import { getFavoriteUniversityIds, getUniversityByIdLocal, toggleFavoriteUniversityLocal } from "@/lib/academy/universityLocalStore";

type Tab = "notes" | "bookmarks" | "scholarships" | "universities";

function formatTimestamp(seconds: number | null): string {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AcademySaved() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("notes");
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);
  const queryClient = useQueryClient();

  const { notes, bookmarks } = useMyLessonWork();
  const [lessonsById, setLessonsById] = useState<Record<string, AcademyLessonRow>>({});
  const [coursesById, setCoursesById] = useState<Record<string, AcademyCourseRow>>({});

  useEffect(() => {
    const lessonIds = Array.from(new Set([...notes.map((n) => n.lesson_id), ...bookmarks.map((b) => b.lesson_id)]));
    if (lessonIds.length === 0) return;
    Promise.all(lessonIds.map((id) => fetchLessonById(id))).then((results) => {
      const map: Record<string, AcademyLessonRow> = {};
      results.forEach((l) => { if (l) map[l.id] = l; });
      setLessonsById(map);
      const courseIds = Array.from(new Set(Object.values(map).map((l) => l.course_id)));
      Promise.all(courseIds.map((id) => fetchCourseById(id))).then((courses) => {
        const cmap: Record<string, AcademyCourseRow> = {};
        courses.forEach((c) => { if (c) cmap[c.id] = c; });
        setCoursesById(cmap);
      });
    });
  }, [notes, bookmarks]);

  const handleRemoveNote = async (noteId: string) => {
    await removeLessonNote(noteId);
    queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.allNotes(user?.id ?? "") });
  };
  const handleRemoveBookmark = async (bookmarkId: string) => {
    await removeLessonBookmark(bookmarkId);
    queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.allBookmarks(user?.id ?? "") });
  };

  const savedScholarships = useMemo(
    () => (user ? getSavedScholarshipIds(user.id).map(getScholarshipByIdLocal).filter((s): s is NonNullable<typeof s> => s !== null) : []),
    [user, refreshKey]
  );
  const favoriteUniversities = useMemo(
    () => (user ? getFavoriteUniversityIds(user.id).map(getUniversityByIdLocal).filter((u): u is NonNullable<typeof u> => u !== null) : []),
    [user, refreshKey]
  );

  if (!user) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <p className="text-muted-foreground">يجب تسجيل الدخول لعرض محفوظاتك.</p>
          <Button asChild className="rounded-xl"><Link to="/login?returnTo=/academy/saved">تسجيل الدخول</Link></Button>
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
            icon={Bookmark}
            title="محفوظاتي"
            description="ملاحظاتك، إشاراتك المرجعية، والمنح والجامعات المحفوظة — كلها في مكان واحد"
            headingId="saved-heading"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="notes" className="gap-1.5"><StickyNote className="w-3.5 h-3.5" aria-hidden="true" />ملاحظاتي ({notes.length})</TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-1.5"><Bookmark className="w-3.5 h-3.5" aria-hidden="true" />الإشارات المرجعية ({bookmarks.length})</TabsTrigger>
            <TabsTrigger value="scholarships" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />المنح المحفوظة ({savedScholarships.length})</TabsTrigger>
            <TabsTrigger value="universities" className="gap-1.5"><Landmark className="w-3.5 h-3.5" aria-hidden="true" />الجامعات المفضّلة ({favoriteUniversities.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "notes" && (
          notes.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">لم تُضِف أي ملاحظات بعد — أضفها أثناء مشاهدة الدروس.</p>
          ) : (
            <ul className="space-y-2" aria-label="ملاحظاتي">
              {notes.map((note) => {
                const lesson = lessonsById[note.lesson_id];
                const course = lesson ? coursesById[lesson.course_id] : null;
                return (
                  <li key={note.id} className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-border bg-card">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {lesson ? (
                          <Link to={`/academy/courses/${lesson.course_id}/learn/${lesson.id}`} className="text-primary hover:underline">
                            {course?.title ?? "دورة"} — {lesson.title}
                          </Link>
                        ) : "درس محذوف"}
                        {note.timestamp_seconds != null && ` · ${formatTimestamp(note.timestamp_seconds)}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive shrink-0" aria-label="حذف الملاحظة" onClick={() => handleRemoveNote(note.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {tab === "bookmarks" && (
          bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">لم تُضِف أي إشارات مرجعية بعد — أضفها أثناء مشاهدة دروس الفيديو.</p>
          ) : (
            <ul className="space-y-2" aria-label="الإشارات المرجعية">
              {bookmarks.map((bookmark) => {
                const lesson = lessonsById[bookmark.lesson_id];
                const course = lesson ? coursesById[lesson.course_id] : null;
                return (
                  <li key={bookmark.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card">
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{bookmark.label || formatTimestamp(bookmark.timestamp_seconds)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lesson ? (
                            <Link to={`/academy/courses/${lesson.course_id}/learn/${lesson.id}`} className="text-primary hover:underline">
                              {course?.title ?? "دورة"} — {lesson.title}
                            </Link>
                          ) : "درس محذوف"}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive shrink-0" aria-label="حذف الإشارة المرجعية" onClick={() => handleRemoveBookmark(bookmark.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {tab === "scholarships" && (
          savedScholarships.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">
              لم تحفظ أي منحة بعد — تصفّح <Link to="/academy/scholarships" className="text-primary hover:underline">مركز المنح</Link> واحفظ ما يهمّك.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="المنح المحفوظة">
              {savedScholarships.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card">
                  <div className="min-w-0 flex-1">
                    <Link to={`/academy/scholarships/${s.id}`} className="text-sm font-bold text-foreground hover:underline">{s.title}</Link>
                    <p className="text-xs text-muted-foreground mt-1">{s.provider} — {s.country}</p>
                  </div>
                  {s.deadline && <Badge variant="secondary" className="shrink-0 text-[10px]">الموعد: {new Date(s.deadline).toLocaleDateString("ar")}</Badge>}
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive shrink-0" aria-label="إلغاء الحفظ" onClick={() => { toggleSavedScholarshipLocal(user.id, s.id); bump(); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "universities" && (
          favoriteUniversities.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed border-border rounded-3xl">
              لم تُضِف أي جامعة مفضّلة بعد — تصفّح <Link to="/academy/universities" className="text-primary hover:underline">دليل الجامعات</Link> وأضِف ما يهمّك.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="الجامعات المفضّلة">
              {favoriteUniversities.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card">
                  <div className="min-w-0 flex-1">
                    <Link to={`/academy/universities/${u.id}`} className="text-sm font-bold text-foreground hover:underline">{u.name}</Link>
                    <p className="text-xs text-muted-foreground mt-1">{u.country}{u.city ? ` — ${u.city}` : ""}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive shrink-0" aria-label="إلغاء التفضيل" onClick={() => { toggleFavoriteUniversityLocal(user.id, u.id); bump(); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </Layout>
  );
}
