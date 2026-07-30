import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, FileText, Rocket, Award, Sparkles, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import {
  useCourseBySlug, useCourseLessons, useCourseWorksheets, useCourseProjects,
} from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { useMyEnrollment, useEnrollInCourse, useCourseProgress } from "@/features/visionkids/hooks/academy/useAcademyProgress";
import { useQuizByCourse } from "@/features/visionkids/hooks/stories/useStoryQuiz";
import { useMyCertificates, useIssueCourseCertificate } from "@/features/visionkids/hooks/academy/useAcademyCertificates";
import { LearningPathTree } from "@/features/visionkids/components/academy/LearningPathTree";

export default function CourseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  const { data: course, isLoading } = useCourseBySlug(slug);
  const { data: lessons = [] } = useCourseLessons(course?.id);
  const { data: worksheets = [] } = useCourseWorksheets(course?.id);
  const { data: projects = [] } = useCourseProjects(course?.id);
  const { data: enrollment } = useMyEnrollment(course?.id);
  const enroll = useEnrollInCourse();
  const { data: courseProgress = [] } = useCourseProgress(course?.id);
  const { data: finalExam } = useQuizByCourse(course?.id);
  const { data: certificates = [] } = useMyCertificates();
  const issueCertificate = useIssueCourseCertificate();

  useDocumentHead({ title: course ? `${course.title} — VisionKids` : t("kids.academy.meta.title"), description: course?.description ?? "", canonicalPath: `/kids/academy/course/${slug}` });

  const progressMap = useMemo(() => new Map(courseProgress.map((p) => [p.lesson_id, p])), [courseProgress]);
  const completedCount = courseProgress.filter((p) => p.status === "completed").length;
  const allLessonsDone = lessons.length > 0 && completedCount >= lessons.length;
  const existingCertificate = certificates.find((c) => c.certificate_type === "course" && c.reference_id === course?.id);

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!course) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.academy.courseNotFound")}</p>
        <Link to="/kids/academy" className="mt-2 inline-block text-kids-primary hover:underline">{t("kids.section.backHome")}</Link>
      </div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <motion.div variants={slideUp(reduced)} className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-kids-primary/30 to-kids-purple/30">
          {course.thumbnail_url ? <img src={course.thumbnail_url} alt="" className="h-full w-full rounded-2xl object-cover" /> : <GraduationCap className="h-10 w-10 text-foreground/40" aria-hidden="true" />}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{course.age_range}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold capitalize">{course.difficulty}</span>
            {course.subject && <span className="rounded-full bg-kids-primary/10 px-2 py-0.5 text-xs font-semibold text-kids-primary">{course.subject.name}</span>}
          </div>
          <h1 className="mt-2 font-heading text-2xl font-extrabold">{course.title}</h1>
          {course.subtitle && <p className="mt-1 text-muted-foreground">{course.subtitle}</p>}
          <div className="mt-3 flex items-center gap-4 text-sm font-semibold">
            <span className="flex items-center gap-1 text-kids-accent"><Sparkles className="h-4 w-4" aria-hidden="true" /> {course.xp_reward} XP</span>
            <span className="flex items-center gap-1 text-kids-secondary"><Coins className="h-4 w-4" aria-hidden="true" /> {course.coins_reward}</span>
          </div>
          {!enrollment && user && (
            <Button onClick={() => enroll.mutate(course.id)} className="mt-4 bg-kids-primary text-white hover:bg-kids-primary/90">{t("kids.academy.enroll")}</Button>
          )}
        </div>
      </motion.div>

      {course.description && <motion.p variants={fadeIn(reduced)} className="mt-6 leading-relaxed">{course.description}</motion.p>}

      <motion.section variants={fadeIn(reduced)} className="mt-8">
        <h2 className="mb-3 font-heading text-lg font-bold">{t("kids.academy.lessonsTitle")} ({completedCount}/{lessons.length})</h2>
        {lessons.length === 0 ? (
          <p className="text-muted-foreground">{t("kids.academy.noLessonsYet")}</p>
        ) : (
          <LearningPathTree courseSlug={course.slug} lessons={lessons} progressByLessonId={progressMap} />
        )}
      </motion.section>

      {worksheets.length > 0 && (
        <motion.section variants={fadeIn(reduced)} className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 font-heading text-lg font-bold"><FileText className="h-5 w-5 text-kids-secondary" aria-hidden="true" /> {t("kids.academy.worksheets")}</h2>
          <ul className="flex flex-col gap-2">
            {worksheets.map((w) => (
              <li key={w.id}><a href={w.file_url} target="_blank" rel="noopener noreferrer" className="text-kids-primary hover:underline">{w.title}</a></li>
            ))}
          </ul>
        </motion.section>
      )}

      {projects.length > 0 && (
        <motion.section variants={fadeIn(reduced)} className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 font-heading text-lg font-bold"><Rocket className="h-5 w-5 text-kids-purple" aria-hidden="true" /> {t("kids.academy.projectsTitle")}</h2>
          <ul className="flex flex-col gap-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/kids/academy/projects/${p.id}`} className="block rounded-xl border-2 border-border p-3 hover:border-kids-purple/50">
                  <p className="font-semibold">{p.title}</p>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {finalExam && (
        <motion.div variants={fadeIn(reduced)} className="mt-8 flex items-center justify-between rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-4">
          <div>
            <p className="font-heading font-bold">{finalExam.title}</p>
            <p className="text-sm text-muted-foreground">{allLessonsDone ? t("kids.academy.examReady") : t("kids.academy.completeLessonsFirst")}</p>
          </div>
          <Button asChild disabled={!allLessonsDone} className="bg-kids-accent text-white hover:bg-kids-accent/90">
            <Link to={`/kids/academy/course/${course.slug}/exam`}>{t("kids.academy.takeExam")}</Link>
          </Button>
        </motion.div>
      )}

      {allLessonsDone && (
        <motion.div variants={fadeIn(reduced)} className="mt-8 flex items-center justify-between rounded-2xl border-2 border-kids-green/40 bg-kids-green/10 p-4">
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-kids-green" aria-hidden="true" />
            <p className="font-heading font-bold">{existingCertificate ? t("kids.academy.certificateEarned") : t("kids.academy.readyForCertificate")}</p>
          </div>
          {existingCertificate ? (
            <Button asChild variant="outline"><Link to="/kids/academy/certificates">{t("kids.academy.viewCertificate")}</Link></Button>
          ) : (
            <Button onClick={() => issueCertificate.mutate(course.id)} disabled={issueCertificate.isPending} className="bg-kids-green text-white hover:bg-kids-green/90">
              {t("kids.academy.claimCertificate")}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
