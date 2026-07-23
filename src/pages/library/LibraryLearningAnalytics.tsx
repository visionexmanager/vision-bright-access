import { Link } from "react-router-dom";
import { Gauge, Brain, Clock, PieChart, Layers, ClipboardCheck, Flame, Trophy } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { StatTile } from "@/components/library/StatTile";
import { Button } from "@/components/ui/button";
import { AchievementsPanel } from "@/components/library/marketplace/AchievementsPanel";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLearningAnalytics } from "@/hooks/library/useLearningAnalytics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryLearningAnalytics() {
  const { t } = useLanguage();
  const { analytics, isLoading } = useLearningAnalytics();

  useDocumentHead({ title: t("library.analytics.title") });

  return (
    <Layout>
      <LibraryLayout title={t("library.analytics.title")} breadcrumb={[{ label: t("library.analytics.title") }]}>
        {isLoading || !analytics ? (
          <SkeletonLoader variant="grid" />
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile icon={Gauge} value={analytics.reading_speed_wpm} label={t("library.analytics.readingSpeed")} />
              <StatTile icon={Brain} value={analytics.avg_quiz_score_percent ?? 0} label={t("library.analytics.comprehension")} />
              <StatTile icon={Clock} value={Math.round(analytics.study_time_minutes)} label={t("library.analytics.studyTime")} />
              <StatTile icon={PieChart} value={analytics.knowledge_retention_percent ?? 0} label={t("library.analytics.retention")} />
              <StatTile icon={Layers} value={analytics.flashcards_due} label={t("library.analytics.flashcardsDue")} />
              <StatTile icon={ClipboardCheck} value={analytics.quizzes_taken} label={t("library.analytics.quizzesTaken")} />
              <StatTile icon={Flame} value={analytics.current_streak} label={t("library.analytics.streak")} />
            </div>

            <Button asChild variant="outline">
              <Link to="/library/study-assistant">{t("library.analytics.viewStudyAssistant")}</Link>
            </Button>

            <div>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Trophy className="h-5 w-5 text-primary" aria-hidden="true" /> {t("library.analytics.achievements")}</h2>
              <AchievementsPanel />
            </div>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
