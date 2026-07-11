import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Maximize, PictureInPicture2,
  Paperclip, FileText, ExternalLink, Award, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { YouTubeEmbed } from "@/components/academy/lms/YouTubeEmbed";
import { LearningPlayerSidebar } from "@/components/academy/lms/LearningPlayerSidebar";
import { LessonNotesPanel } from "@/components/academy/lms/LessonNotesPanel";
import { LessonBookmarksPanel } from "@/components/academy/lms/LessonBookmarksPanel";
import { QuizPlayer } from "@/components/academy/assessment/QuizPlayer";
import { AssignmentSubmissionForm } from "@/components/academy/assessment/AssignmentSubmissionForm";
import { ProjectSubmissionForm } from "@/components/academy/assessment/ProjectSubmissionForm";
import { useCourseDetail } from "@/hooks/academy/useCourseDetail";
import { useEnrollment } from "@/hooks/academy/useEnrollment";
import { useCourseProgress, useMarkLessonProgress, useLessonNotes, useLessonBookmarks } from "@/hooks/academy/useLessonProgress";
import { fetchCourseProgress } from "@/services/academy/lms";
import { getQuizForLessonAny, getAssignmentForLessonAny, getProjectForLessonAny } from "@/lib/academy/assessmentLocalStore";
import { checkCertificateEligibility, issueCertificateLocal, getCertificateForCourse } from "@/lib/academy/certificateLocalStore";
import { runGamificationTick, type GamificationTickResult } from "@/lib/academy/gamificationLocalStore";
import { useAcademyProfile } from "@/hooks/academy/useAcademyProfile";
import { awardAcademyXP } from "@/services/academy/academyService";
import { CelebrationBanner } from "@/components/academy/gamification/CelebrationBanner";
import { notifyAcademySelf } from "@/lib/academy/notify";
import type { AcademyCertificateRow } from "@/lib/types/academy-modules";
import type { AcademyXPReason } from "@/lib/types";
import type { AcademyQuizAttemptRow, AcademyQuizScope } from "@/lib/types/academy-lms";

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

export default function AcademyLearningPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile: academyProfile } = useAcademyProfile();

  const { course, lessons: flatLessons, modulesWithLessons, isLoading: isCourseLoading } = useCourseDetail(courseId);
  const lesson = flatLessons.find((l) => l.id === lessonId) ?? null;
  const { enroll } = useEnrollment(courseId);

  const modules = useMemo(() => modulesWithLessons.map((m) => m.module), [modulesWithLessons]);
  const lessonsByModule = useMemo(() => {
    const map: Record<string, typeof flatLessons> = {};
    modulesWithLessons.forEach(({ module, lessons }) => { map[module.id] = lessons; });
    return map;
  }, [modulesWithLessons, flatLessons]);
  const currentIndex = flatLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

  const { progress: progressRows } = useCourseProgress(courseId);
  const completedLessonIds = useMemo(
    () => new Set(progressRows.filter((r) => r.completed).map((r) => r.lesson_id)),
    [progressRows]
  );
  const { markProgress } = useMarkLessonProgress(courseId);
  const { notes, addNote, deleteNote } = useLessonNotes(lessonId);
  const { bookmarks, addBookmark, deleteBookmark } = useLessonBookmarks(lessonId);

  const [justIssuedCertificate, setJustIssuedCertificate] = useState<AcademyCertificateRow | null>(null);
  const [celebration, setCelebration] = useState<GamificationTickResult | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Safety net: make sure an enrollment row exists even if the student reached
  // this URL without going through the CourseDetail "start learning" CTA.
  useEffect(() => {
    if (user && courseId) enroll().catch(() => {});
  }, [user, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset per-lesson state + resume position + move focus for a11y when lesson changes
  useEffect(() => {
    if (!lessonId) return;
    setPlaybackRate(1);
    headingRef.current?.focus();

    const row = progressRows.find((p) => p.lesson_id === lessonId);
    const video = videoRef.current;
    if (video && row?.last_position_seconds) {
      const resume = () => { video.currentTime = row.last_position_seconds; };
      video.addEventListener("loadedmetadata", resume, { once: true });
      return () => video.removeEventListener("loadedmetadata", resume);
    }
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts: N / P for next/previous lesson
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable;
      if (isTyping) return;

      if (e.key.toLowerCase() === "n" && nextLesson) {
        navigate(`/academy/courses/${courseId}/learn/${nextLesson.id}`);
      } else if (e.key.toLowerCase() === "p" && prevLesson) {
        navigate(`/academy/courses/${courseId}/learn/${prevLesson.id}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nextLesson, prevLesson, courseId, navigate]);

  const lastSavedAt = useRef(0);
  const handleTimeUpdate = () => {
    if (!user || !lessonId || !courseId || !videoRef.current) return;
    const now = Date.now();
    if (now - lastSavedAt.current < 5000) return;
    lastSavedAt.current = now;
    markProgress({ lessonId, update: { last_position_seconds: Math.floor(videoRef.current.currentTime) } }).catch(console.warn);
  };

  const markComplete = async () => {
    if (!user || !lessonId || !courseId || !lesson) return;
    const wasAlreadyComplete = completedLessonIds.has(lessonId);
    await markProgress({ lessonId, update: { completed: true } });

    // ── VX: award via the EXISTING academy XP bridge only — never a new wallet ──
    if (!wasAlreadyComplete) {
      const awards: Promise<boolean>[] = [awardAcademyXP(user.id, "academy_lesson_completed")];

      const freshProgress = await fetchCourseProgress(user.id, courseId);
      const completedNow = new Set(freshProgress.filter((p) => p.completed).map((p) => p.lesson_id));
      completedNow.add(lessonId); // include this tick even if the write above hasn't round-tripped through the progress query cache yet

      const moduleLessons = lessonsByModule[lesson.module_id] ?? [];
      if (moduleLessons.length > 0 && moduleLessons.every((l) => completedNow.has(l.id))) {
        awards.push(awardAcademyXP(user.id, "academy_module_completed"));
      }
      if (flatLessons.length > 0 && flatLessons.every((l) => completedNow.has(l.id))) {
        awards.push(awardAcademyXP(user.id, "academy_course_completed"));
      }
      await Promise.all(awards);
    }

    // Course finished + all assessments passed/submitted? Issue the certificate automatically.
    if (!getCertificateForCourse(user.id, courseId)) {
      const eligibility = checkCertificateEligibility(user.id, courseId);
      if (eligibility.eligible) {
        const studentName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || "الطالب";
        const issued = issueCertificateLocal(user.id, courseId, studentName);
        if (issued) {
          setJustIssuedCertificate(issued);
          await awardAcademyXP(user.id, "academy_certificate_earned");
          await notifyAcademySelf("🎓 شهادة جديدة!", `حصلت على شهادة إتمام دورة "${course?.title ?? ""}"`, "success");
        }
      }
    }

    // Achievements / learning cards / streak / missions — never award VX themselves except
    // for missions, which route through the same existing bridge via their xp_reason.
    const tick = runGamificationTick(user.id, academyProfile?.xp_total ?? 0);
    if (tick.missionXPReasonsToAward.length > 0) {
      await Promise.all(tick.missionXPReasonsToAward.map((reason) => awardAcademyXP(user.id, reason as AcademyXPReason)));
    }
    if (tick.streakMilestone !== null) {
      await awardAcademyXP(user.id, "academy_streak_milestone");
    }
    if (tick.newAchievements.length > 0) {
      const summary = tick.newAchievements.length === 1
        ? `فتحت إنجاز "${tick.newAchievements[0].title}"`
        : `فتحت ${tick.newAchievements.length} إنجازات جديدة`;
      await notifyAcademySelf("🏆 إنجاز جديد", summary, "success");
    }
    if (tick.newAchievements.length > 0 || tick.newLearningCards.length > 0 || tick.streakMilestone !== null) {
      setCelebration(tick);
    }
  };

  const handleQuizPassed = async (attempt: AcademyQuizAttemptRow, scope: AcademyQuizScope) => {
    if (!user) return;
    if (scope === "final_exam") {
      await awardAcademyXP(user.id, "academy_final_exam_passed");
    } else {
      await awardAcademyXP(user.id, "academy_quiz_passed");
    }
    if (attempt.score_percent === 100) {
      await awardAcademyXP(user.id, "academy_perfect_quiz");
    }
    await markComplete();
  };

  const handlePiP = async () => {
    try {
      if (videoRef.current) await videoRef.current.requestPictureInPicture();
    } catch {
      // PiP unsupported in this browser — silently ignore, button remains harmless.
    }
  };

  const handleFullscreen = () => {
    mediaContainerRef.current?.requestFullscreen?.().catch(() => {});
  };

  const handleAddNote = (content: string) => {
    if (!user || !lessonId) return;
    addNote({ content, timestampSeconds: videoRef.current?.currentTime ?? null }).catch(console.warn);
  };

  const handleRemoveNote = (noteId: string) => {
    deleteNote(noteId).catch(console.warn);
  };

  const handleAddBookmark = () => {
    if (!user || !lessonId) return;
    addBookmark({ timestampSeconds: videoRef.current ? Math.floor(videoRef.current.currentTime) : null }).catch(console.warn);
  };

  const handleRemoveBookmark = (bookmarkId: string) => {
    deleteBookmark(bookmarkId).catch(console.warn);
  };

  if (!courseId || !lessonId) return <Navigate to="/academy/courses" replace />;

  if (isCourseLoading) {
    return (
      <Layout>
        <div className="p-8 max-w-3xl mx-auto text-center text-muted-foreground">جارِ التحميل...</div>
      </Layout>
    );
  }

  if (!course || !lesson) {
    return (
      <Layout>
        <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
          <p className="text-lg text-muted-foreground">لم يتم العثور على هذا الدرس.</p>
          <Button asChild className="rounded-xl"><Link to="/academy/courses">تصفح الدورات</Link></Button>
        </div>
      </Layout>
    );
  }

  const progressPercent = flatLessons.length > 0
    ? Math.round((completedLessonIds.size / flatLessons.length) * 100)
    : 0;

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans text-start">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Button variant="ghost" size="sm" asChild className="gap-1 rounded-xl">
            <Link to={`/academy/courses/${courseId}`}>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              صفحة الدورة
            </Link>
          </Button>
          <div className="flex items-center gap-2 flex-1 max-w-xs" aria-label={`تقدّمك في الدورة: ${progressPercent}%`}>
            <Progress value={progressPercent} className="h-2" />
            <span className="text-xs font-bold text-muted-foreground shrink-0">{progressPercent}%</span>
          </div>
        </div>

        {justIssuedCertificate && (
          <div role="status" className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 flex-wrap">
            <span className="flex items-center gap-2 font-bold text-foreground">
              <Award className="w-5 h-5 text-primary" aria-hidden="true" />
              🎉 مبروك! أكملت الدورة وحصلت على شهادتك.
            </span>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" className="rounded-xl">
                <Link to={`/academy/verify/${justIssuedCertificate.certificate_number}`}>عرض الشهادة</Link>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setJustIssuedCertificate(null)} aria-label="إغلاق">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <CelebrationBanner
          achievements={celebration?.newAchievements ?? []}
          learningCards={celebration?.newLearningCards ?? []}
          streakMilestone={celebration?.streakMilestone ?? null}
          onDismiss={() => setCelebration(null)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main content */}
          <div className="lg:col-span-8 space-y-6">
            <h1 ref={headingRef} tabIndex={-1} className="text-xl font-black text-foreground focus:outline-none">
              {lesson.title}
            </h1>

            {lesson.kind === "video" && (
              <div ref={mediaContainerRef} className="space-y-2">
                {lesson.video_url ? (
                  <>
                    <video
                      ref={videoRef}
                      src={lesson.video_url}
                      controls
                      className="w-full rounded-2xl bg-black aspect-video"
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={markComplete}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <label htmlFor="playback-rate" className="text-xs text-muted-foreground">سرعة التشغيل</label>
                      <select
                        id="playback-rate"
                        value={playbackRate}
                        onChange={(e) => {
                          const rate = Number(e.target.value);
                          setPlaybackRate(rate);
                          if (videoRef.current) videoRef.current.playbackRate = rate;
                        }}
                        className="text-xs rounded-lg border border-border bg-background px-2 py-1"
                      >
                        {PLAYBACK_RATES.map((r) => <option key={r} value={r}>{r}x</option>)}
                      </select>
                      <Button variant="outline" size="sm" onClick={handlePiP} className="gap-1.5 rounded-xl text-xs h-8">
                        <PictureInPicture2 className="w-3.5 h-3.5" aria-hidden="true" />
                        صورة داخل صورة
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleFullscreen} className="gap-1.5 rounded-xl text-xs h-8">
                        <Maximize className="w-3.5 h-3.5" aria-hidden="true" />
                        ملء الشاشة
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="aspect-video w-full rounded-2xl bg-muted border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
                    فيديو تجريبي — سيُستبدل بمحتوى حقيقي عند رفعه
                  </div>
                )}
              </div>
            )}

            {lesson.kind === "youtube" && lesson.youtube_video_id && (
              <div ref={mediaContainerRef}>
                <YouTubeEmbed videoId={lesson.youtube_video_id} title={lesson.title} />
              </div>
            )}

            {lesson.kind === "text" && (
              <div className="bg-card p-6 rounded-2xl border border-border">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{lesson.body_markdown ?? ""}</ReactMarkdown>
                </div>
                {lesson.code_snippets.map((snippet, i) => (
                  <pre key={i} className="mt-4 p-4 rounded-xl bg-foreground text-background text-xs overflow-x-auto" dir="ltr">
                    <code>{snippet.code}</code>
                  </pre>
                ))}
              </div>
            )}

            {lesson.kind === "quiz" && user && (() => {
              const detail = getQuizForLessonAny(lesson.id);
              return detail ? (
                <QuizPlayer quiz={detail.quiz} questions={detail.questions} userId={user.id} onPassed={(attempt) => handleQuizPassed(attempt, detail.quiz.scope)} />
              ) : (
                <div className="bg-card p-8 rounded-2xl border-2 border-dashed border-border text-center">
                  <p className="text-sm text-muted-foreground">لم يُضِف المدرّس محتوى هذا الاختبار بعد.</p>
                </div>
              );
            })()}

            {lesson.kind === "assignment" && user && (() => {
              const assignment = getAssignmentForLessonAny(lesson.id);
              return assignment ? (
                <AssignmentSubmissionForm assignment={assignment} userId={user.id} />
              ) : (
                <div className="bg-card p-8 rounded-2xl border-2 border-dashed border-border text-center">
                  <p className="text-sm text-muted-foreground">لم يُضِف المدرّس تفاصيل هذا الواجب بعد.</p>
                </div>
              );
            })()}

            {lesson.kind === "project" && user && (() => {
              const project = getProjectForLessonAny(lesson.id);
              return project ? (
                <ProjectSubmissionForm project={project} userId={user.id} />
              ) : (
                <div className="bg-card p-8 rounded-2xl border-2 border-dashed border-border text-center">
                  <p className="text-sm text-muted-foreground">لم يُضِف المدرّس تفاصيل هذا المشروع بعد.</p>
                </div>
              );
            })()}

            {/* Prev/Next + complete */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
              <Button
                variant="outline"
                disabled={!prevLesson}
                onClick={() => prevLesson && navigate(`/academy/courses/${courseId}/learn/${prevLesson.id}`)}
                className="gap-2 rounded-xl"
              >
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
                السابق
              </Button>

              <Button onClick={markComplete} variant={completedLessonIds.has(lesson.id) ? "default" : "outline"} className="gap-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                {completedLessonIds.has(lesson.id) ? "مكتمل" : "تحديد كمكتمل"}
              </Button>

              <Button
                disabled={!nextLesson}
                onClick={() => nextLesson && navigate(`/academy/courses/${courseId}/learn/${nextLesson.id}`)}
                className="gap-2 rounded-xl"
              >
                التالي
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">اختصارات لوحة المفاتيح: N للدرس التالي، P للدرس السابق</p>

            {/* Tabs: notes / bookmarks / attachments / transcript */}
            <Tabs defaultValue="notes" className="bg-card rounded-2xl border border-border p-4">
              <TabsList className="grid grid-cols-4 rounded-xl">
                <TabsTrigger value="notes">ملاحظات</TabsTrigger>
                <TabsTrigger value="bookmarks">إشارات مرجعية</TabsTrigger>
                <TabsTrigger value="attachments">مرفقات</TabsTrigger>
                <TabsTrigger value="transcript">النص المكتوب</TabsTrigger>
              </TabsList>
              <TabsContent value="notes" className="pt-4">
                <LessonNotesPanel notes={notes} onAddNote={handleAddNote} onRemoveNote={handleRemoveNote} />
              </TabsContent>
              <TabsContent value="bookmarks" className="pt-4">
                <LessonBookmarksPanel
                  bookmarks={bookmarks}
                  canBookmarkCurrentTime={lesson.kind === "video"}
                  onAddBookmark={handleAddBookmark}
                  onRemoveBookmark={handleRemoveBookmark}
                />
              </TabsContent>
              <TabsContent value="attachments" className="pt-4">
                {lesson.attachments.length === 0 && lesson.external_links.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">لا توجد مرفقات لهذا الدرس.</p>
                ) : (
                  <ul className="space-y-2">
                    {lesson.attachments.map((a) => (
                      <li key={a.id}>
                        <a href={a.file_url} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border text-sm hover:border-primary transition-colors">
                          <Paperclip className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                          {a.label}
                        </a>
                      </li>
                    ))}
                    {lesson.external_links.map((link) => (
                      <li key={link.url}>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border text-sm hover:border-primary transition-colors">
                          <ExternalLink className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="transcript" className="pt-4">
                <p className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2">
                  <FileText className="w-6 h-6" aria-hidden="true" />
                  النص المكتوب للدرس قيد التطوير وسيتوفر قريباً.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <LearningPlayerSidebar
              courseId={courseId}
              courseTitle={course.title}
              modules={modules}
              lessonsByModule={lessonsByModule}
              currentLessonId={lesson.id}
              completedLessonIds={completedLessonIds}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
