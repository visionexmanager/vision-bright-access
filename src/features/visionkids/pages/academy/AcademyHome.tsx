import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn, slideUp, staggerContainer } from "@/features/visionkids/utils/animations";
import { useSubjects, useFeaturedCourses } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { useRecentLessonProgress } from "@/features/visionkids/hooks/academy/useAcademyProgress";
import { useLearningRecommendations } from "@/features/visionkids/hooks/academy/useAcademyAnalytics";
import { SubjectCard } from "@/features/visionkids/components/academy/SubjectCard";
import { partitionSubjects } from "@/features/visionkids/utils/subjectAvailability";
import { CourseRail } from "@/features/visionkids/components/academy/CourseRail";

export default function AcademyHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  useDocumentHead({ title: t("kids.academy.meta.title"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy" });

  const { data: subjects = [] } = useSubjects();
  const { available, preparingCount } = partitionSubjects(subjects);
  const { data: featured = [] } = useFeaturedCourses(10);
  const { data: recentProgress = [] } = useRecentLessonProgress(10);
  const { data: recommendations = [] } = useLearningRecommendations(3);

  const continueLessons = recentProgress.filter((p) => p.status !== "completed" && p.lesson).map((p) => p.lesson!);

  return (
    <div>
      <section className="kids-hero-gradient px-4 py-12 text-center sm:py-16">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          <motion.h1 variants={slideUp(reduced)} className="font-heading text-3xl font-extrabold sm:text-4xl">
            🎓 {t("kids.academy.heroTitle")}
          </motion.h1>
          <motion.p variants={fadeIn(reduced)} className="text-muted-foreground">{t("kids.academy.heroSubtitle")}</motion.p>
          <motion.div variants={slideUp(reduced)} className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-kids-primary to-kids-purple text-white hover:opacity-90">
              <Link to="/kids/academy/subjects"><Search className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.exploreSubjects")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/kids/academy/learning-path"><TrendingUp className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.myLearningPath")}</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {user && recommendations.length > 0 && (
        <section className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold">
              <Sparkles className="h-5 w-5 text-kids-purple" aria-hidden="true" /> {t("kids.academy.recommendedForYou")}
            </h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {recommendations.map((rec) => (
                <Link
                  key={rec.lesson.id}
                  to={`/kids/academy/course/${rec.lesson.course_id}`}
                  className="rounded-xl border-2 border-border bg-card p-3 transition-colors hover:border-kids-purple/50"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-kids-purple">{t(`kids.academy.recKind.${rec.kind}`)}</p>
                  <p className="mt-1 font-semibold">{rec.lesson.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{rec.reason}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {user && continueLessons.length > 0 && (
        <section className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-3 font-heading text-xl font-bold">{t("kids.academy.continueLearning")}</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {continueLessons.map((lesson) => (
                <Link key={lesson.id} to={`/kids/academy/course/${lesson.course_id}`} className="w-56 shrink-0 rounded-xl border-2 border-border bg-card p-3 hover:border-kids-primary/50">
                  <p className="font-semibold">{lesson.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{lesson.estimated_minutes}m</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <h2 className="mx-auto mb-4 max-w-6xl font-heading text-xl font-bold sm:text-2xl">{t("kids.academy.subjectsTitle")}</h2>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {available.map((subject) => <SubjectCard key={subject.id} subject={subject} />)}
        </div>
        {preparingCount > 0 && (
          <p className="mx-auto mt-4 max-w-6xl text-sm text-muted-foreground">
            {t("kids.academy.subjectsPreparing").replace("{count}", String(preparingCount))}
          </p>
        )}
      </section>

      <CourseRail title={t("kids.academy.featuredCourses")} courses={featured} />
    </div>
  );
}
