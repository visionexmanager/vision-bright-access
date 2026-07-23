import { useMemo } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Clock, Users, PlayCircle, ArrowLeft, Paperclip,
  CheckCircle2, ListChecks, MessagesSquare, Sparkles,
} from "lucide-react";
import { DifficultyBadge } from "@/components/academy/lms/DifficultyBadge";
import { CourseSourceBadge } from "@/components/academy/lms/CourseSourceBadge";
import { StarRating } from "@/components/academy/lms/StarRating";
import { InstructorMiniCard } from "@/components/academy/lms/InstructorMiniCard";
import { CourseCurriculumList } from "@/components/academy/lms/CourseCurriculumList";
import { CourseReviewsSection } from "@/components/academy/lms/CourseReviewsSection";
import { CourseReviewForm } from "@/components/academy/lms/CourseReviewForm";
import { CourseFAQSection } from "@/components/academy/lms/CourseFAQSection";
import { CourseCard } from "@/components/academy/lms/CourseCard";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { useCourseDetail } from "@/hooks/academy/useCourseDetail";
import { useEnrollment } from "@/hooks/academy/useEnrollment";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AcademyErrorState } from "@/components/academy/ui/AcademyErrorState";

export default function AcademyCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { course, instructor, modules, lessons, reviews, similarCourses, isLoading, error, retry } = useCourseDetail(courseId);
  const { user } = useAuth();
  const { isEnrolled, isLoading: enrollmentLoading, enroll, isEnrolling } = useEnrollment(courseId);
  const hasReviewed = reviews.some((r) => r.user_id === user?.id);

  const lessonsByModule = useMemo(() => {
    const map: Record<string, typeof lessons> = {};
    modules.forEach((m) => { map[m.id] = lessons.filter((l) => l.module_id === m.id); });
    return map;
  }, [modules, lessons]);

  const attachments = useMemo(
    () => Object.values(lessonsByModule).flat().flatMap((l) => l.attachments),
    [lessonsByModule]
  );

  const firstLesson = Object.values(lessonsByModule).flat()[0];

  if (!courseId) return <Navigate to="/academy/courses" replace />;

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8 max-w-3xl mx-auto text-center text-muted-foreground">جارِ التحميل...</div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        {error ? (
          <AcademyErrorState
            className="mx-auto min-h-[45vh] max-w-xl justify-center"
            message="تعذر تحميل الدورة. تحقق من الاتصال ثم أعد المحاولة."
            onRetry={retry}
          />
        ) : (
        <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
          <p className="text-lg text-muted-foreground">لم يتم العثور على هذه الدورة.</p>
          <Button asChild className="rounded-xl">
            <Link to="/academy/courses">تصفح الدورات</Link>
          </Button>
        </div>
        )}
      </Layout>
    );
  }

  const hours = Math.round((course.duration_minutes / 60) * 10) / 10;

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-10 font-sans text-start">
        <Button variant="ghost" size="sm" asChild className="gap-1 rounded-xl -mb-2">
          <Link to="/academy/courses">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            كل الدورات
          </Link>
        </Button>

        {/* Header / trailer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-5">
            <div className="flex flex-wrap gap-2">
              <CourseSourceBadge source={course.source} />
              <DifficultyBadge difficulty={course.difficulty} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">{course.title}</h1>
            <p className="text-muted-foreground">{course.description}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <StarRating rating={course.rating_avg} count={course.rating_count} />
              <span className="flex items-center gap-1"><Users className="w-4 h-4" aria-hidden="true" />{course.students_count.toLocaleString()} طالب</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" aria-hidden="true" />{hours > 0 ? `${hours} ساعة` : "قيد الإعداد"}</span>
              <span>{course.language}</span>
            </div>

            {instructor && <InstructorMiniCard instructor={instructor} />}
          </div>

          <div className="space-y-4">
            <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-border" aria-hidden="true">
              <BookOpen className="w-12 h-12 text-primary/40" />
            </div>
            {firstLesson ? (
              <Button
                size="lg"
                className="w-full gap-2 rounded-xl py-6 font-bold"
                disabled={enrollmentLoading || isEnrolling}
                onClick={async () => {
                  if (user && !isEnrolled) {
                    try {
                      await enroll();
                    } catch (enrollmentError) {
                      toast.error(
                        enrollmentError instanceof Error
                          ? enrollmentError.message
                          : "تعذر التسجيل في الدورة."
                      );
                      return;
                    }
                  }
                  navigate(`/academy/courses/${course.id}/learn/${firstLesson.id}`);
                }}
              >
                <PlayCircle className="w-5 h-5" aria-hidden="true" />
                {course.is_free ? "ابدأ التعلّم مجاناً" : "ابدأ التعلّم"}
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-3 border-2 border-dashed border-border rounded-xl">
                المحتوى قيد الإنشاء
              </p>
            )}
            {!course.is_free && (
              <p className="text-center text-sm font-bold text-primary">{course.price_vx?.toLocaleString()} VX</p>
            )}
          </div>
        </div>

        {/* Outcomes & requirements */}
        {(course.learning_outcomes.length > 0 || course.requirements.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {course.learning_outcomes.length > 0 && (
              <div className="bg-card p-6 rounded-3xl border border-border">
                <AcademySectionHeader icon={CheckCircle2} title="ماذا ستتعلّم" headingId="outcomes-heading" />
                <ul className="space-y-2">
                  {course.learning_outcomes.map((o) => (
                    <li key={o} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {course.requirements.length > 0 && (
              <div className="bg-card p-6 rounded-3xl border border-border">
                <AcademySectionHeader icon={ListChecks} title="المتطلبات" headingId="requirements-heading" />
                <ul className="space-y-2">
                  {course.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" aria-hidden="true" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Curriculum */}
        <div className="bg-card p-6 md:p-8 rounded-3xl border border-border">
          <AcademySectionHeader icon={PlayCircle} title="منهج الدورة" description={`${modules.length} وحدات`} headingId="curriculum-heading" />
          <CourseCurriculumList
            courseId={course.id}
            modules={modules}
            lessonsByModule={lessonsByModule}
            isFreeCourse={course.is_free}
          />
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="bg-card p-6 rounded-3xl border border-border">
            <AcademySectionHeader icon={Paperclip} title="مرفقات الدورة" headingId="attachments-heading" />
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {attachments.map((a) => (
                <li key={a.id}>
                  <a href={a.file_url} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground hover:border-primary transition-colors">
                    <Paperclip className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                    {a.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reviews */}
        <div className="bg-card p-6 md:p-8 rounded-3xl border border-border space-y-5">
          <AcademySectionHeader icon={MessagesSquare} title="آراء الطلاب" headingId="reviews-heading" />
          {isEnrolled && !hasReviewed && <CourseReviewForm courseId={course.id} />}
          <CourseReviewsSection reviews={reviews} ratingAvg={course.rating_avg} ratingCount={course.rating_count} />
        </div>

        {/* FAQ */}
        <div className="bg-card p-6 md:p-8 rounded-3xl border border-border">
          <AcademySectionHeader icon={Sparkles} title="الأسئلة الشائعة" headingId="faq-heading" />
          <CourseFAQSection isFreeCourse={course.is_free} />
        </div>

        {/* Similar courses */}
        {similarCourses.length > 0 && (
          <div>
            <AcademySectionHeader icon={BookOpen} title="دورات مشابهة" headingId="similar-heading" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {similarCourses.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
