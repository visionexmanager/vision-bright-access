import { Link } from "react-router-dom";
// Aliased: the unaliased `Map` shadows the global Map constructor, and this
// file builds a real Map below.
import { Map as MapIcon, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyEnrolledCourses, useCourseProgress } from "@/features/visionkids/hooks/academy/useAcademyProgress";
import { useCourseLessons } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { useMyAchievements } from "@/features/visionkids/hooks/stories/useStoryEngagement";
import { LearningPathTree } from "@/features/visionkids/components/academy/LearningPathTree";
import { AchievementBadge } from "@/features/visionkids/components/games/AchievementBadge";
import type { CourseEnrollment } from "@/features/visionkids/types/academy.types";

function EnrolledCoursePath({ enrollment }: { enrollment: CourseEnrollment }) {
  const { t } = useLanguage();
  const { data: lessons = [] } = useCourseLessons(enrollment.course_id);
  const { data: progress = [] } = useCourseProgress(enrollment.course_id);
  const progressMap = new Map(progress.map((p) => [p.lesson_id, p]));
  const completed = progress.filter((p) => p.status === "completed").length;

  if (!enrollment.course) return null;

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link to={`/kids/academy/course/${enrollment.course.slug}`} className="font-heading font-bold hover:underline">{enrollment.course.title}</Link>
        <span className="text-xs text-muted-foreground">{completed}/{lessons.length} {t("kids.academy.lessons")}</span>
      </div>
      {lessons.length === 0 ? <p className="text-sm text-muted-foreground">{t("kids.academy.noLessonsYet")}</p> : (
        <LearningPathTree courseSlug={enrollment.course.slug} lessons={lessons} progressByLessonId={progressMap} />
      )}
    </div>
  );
}

export default function LearningPath() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: enrollments = [], isLoading } = useMyEnrolledCourses();
  const { data: achievements = [] } = useMyAchievements();

  useDocumentHead({ title: t("kids.academy.learningPathTitle"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy/learning-path" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <MapIcon className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <MapIcon className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.academy.learningPathTitle")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.academy.learningPathSubtitle")}</p>

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-3" aria-busy="true">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : enrollments.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-muted-foreground">{t("kids.academy.notEnrolledYet")}</p>
          <Link to="/kids/academy/subjects" className="mt-2 inline-block text-kids-primary hover:underline">{t("kids.academy.exploreSubjects")}</Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {enrollments.map((e) => <EnrolledCoursePath key={e.course_id} enrollment={e} />)}
        </div>
      )}

      {achievements.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-1.5 font-heading text-lg font-bold"><Award className="h-5 w-5 text-kids-accent" aria-hidden="true" /> {t("kids.academy.milestones")}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {achievements.slice(0, 8).map((a) => a.achievement && <AchievementBadge key={a.achievement_id} achievement={a.achievement} earned earnedAt={a.earned_at} />)}
          </div>
        </div>
      )}
    </div>
  );
}
