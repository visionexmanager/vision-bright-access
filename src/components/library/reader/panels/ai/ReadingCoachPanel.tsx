import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/library/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useReadingCoach } from "@/hooks/library/useReadingCoach";

interface ReadingCoachPanelProps {
  bookId: string;
}

export function ReadingCoachPanel({ bookId }: ReadingCoachPanelProps) {
  const { t } = useLanguage();
  const { stats, isLoading, tips, isLoadingTips, generateTips } = useReadingCoach(bookId);

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />;
  if (!stats) return <EmptyState title={t("library.ai.coach.noData")} className="py-6" />;

  return (
    <div className="space-y-4">
      {stats.total_pages != null && stats.current_page != null && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{t("library.readingProgress.label")}</span>
            <span>{Math.round(stats.percent_complete ?? 0)}%</span>
          </div>
          <Progress value={stats.percent_complete ?? 0} />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t("library.ai.coach.pace")}</dt>
          <dd className="font-medium">{stats.pages_per_day != null ? `${stats.pages_per_day} ${t("library.ai.coach.pagesPerDay")}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("library.ai.coach.estimatedFinish")}</dt>
          <dd className="font-medium">{stats.estimated_days_left != null ? `${stats.estimated_days_left} ${t("library.ai.coach.days")}` : "—"}</dd>
        </div>
      </dl>

      {stats.active_goals.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("library.ai.coach.goals")}</p>
          {stats.active_goals.map((g, i) => (
            <div key={i} className="rounded-lg border p-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span>{g.title}</span>
                <span className="text-xs text-muted-foreground">{g.current_value}/{g.goal_target}</span>
              </div>
              <Progress value={Math.min(100, (g.current_value / g.goal_target) * 100)} className="mt-1.5 h-1.5" />
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={() => void generateTips()} disabled={isLoadingTips} className="w-full gap-1.5">
        {isLoadingTips ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        {t("library.ai.coach.getTips")}
      </Button>

      {tips && tips.length > 0 && (
        <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted p-3 text-sm">
          {tips.map((tip, i) => <li key={i}>{tip}</li>)}
        </ul>
      )}
    </div>
  );
}
