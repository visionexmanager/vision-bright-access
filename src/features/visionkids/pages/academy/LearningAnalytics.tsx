import { Link } from "react-router-dom";
import { BarChart3, Clock, CheckCircle2, TrendingUp, TrendingDown, CalendarCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyAnalytics, useLearningRecommendations } from "@/features/visionkids/hooks/academy/useAcademyAnalytics";
import { SubjectPerformanceChart } from "@/features/visionkids/components/academy/SubjectPerformanceChart";

export default function LearningAnalytics() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: analytics, isLoading } = useMyAnalytics();
  const { data: recommendations = [] } = useLearningRecommendations(5);

  useDocumentHead({ title: t("kids.academy.analyticsTitle"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy/analytics" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  if (isLoading || !analytics) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  const stats = [
    { icon: CheckCircle2, label: t("kids.academy.lessonsCompleted"), value: analytics.totalLessonsCompleted, color: "text-kids-green" },
    { icon: Clock, label: t("kids.academy.timePlayed"), value: `${analytics.totalMinutes}m`, color: "text-kids-secondary" },
    { icon: BarChart3, label: t("kids.academy.completionRate"), value: `${analytics.completionRate}%`, color: "text-kids-primary" },
    { icon: CalendarCheck, label: t("kids.academy.activeDays"), value: analytics.activeDaysLast30, color: "text-kids-purple" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <BarChart3 className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.academy.analyticsTitle")}
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <s.icon className={`mx-auto h-6 w-6 ${s.color}`} aria-hidden="true" />
            <p className="mt-2 font-heading text-xl font-extrabold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border-2 border-border bg-card p-4">
        <h2 className="mb-2 font-heading text-lg font-bold">{t("kids.academy.performanceBySubject")}</h2>
        <SubjectPerformanceChart data={[...analytics.strongSubjects, ...analytics.weakSubjects]} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-kids-green/40 bg-kids-green/10 p-4">
          <h2 className="mb-2 flex items-center gap-1.5 font-heading text-sm font-bold text-kids-green"><TrendingUp className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.strongPoints")}</h2>
          {analytics.strongSubjects.length === 0 ? <p className="text-sm text-muted-foreground">{t("kids.academy.noDataYet")}</p> : (
            <ul className="flex flex-col gap-1 text-sm">{analytics.strongSubjects.map((s) => <li key={s.subjectId}>{s.subjectName} — {s.averageScore}%</li>)}</ul>
          )}
        </div>
        <div className="rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-4">
          <h2 className="mb-2 flex items-center gap-1.5 font-heading text-sm font-bold text-kids-accent"><TrendingDown className="h-4 w-4" aria-hidden="true" /> {t("kids.academy.weakPoints")}</h2>
          {analytics.weakSubjects.length === 0 ? <p className="text-sm text-muted-foreground">{t("kids.academy.noDataYet")}</p> : (
            <ul className="flex flex-col gap-1 text-sm">{analytics.weakSubjects.map((s) => <li key={s.subjectId}>{s.subjectName} — {s.averageScore}%</li>)}</ul>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-heading text-lg font-bold">{t("kids.academy.recommendedForYou")}</h2>
          <div className="flex flex-col gap-2">
            {recommendations.map((rec) => (
              <Link key={rec.lesson.id} to={`/kids/academy/course/${rec.lesson.course_id}`} className="rounded-xl border-2 border-border bg-card p-3 hover:border-kids-primary/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-kids-purple">{t(`kids.academy.recKind.${rec.kind}`)}</p>
                <p className="font-semibold">{rec.lesson.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
