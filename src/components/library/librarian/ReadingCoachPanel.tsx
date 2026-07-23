import { Link } from "react-router-dom";
import { Compass, Sparkles, Loader2, Clock, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/library/EmptyState";
import { useContinueReading } from "@/hooks/library/useContinueReading";
import { useReadingCoach } from "@/hooks/library/useReadingCoach";
import { useLibrarianPreferences } from "@/hooks/library/useLibrarianPreferences";
import { useLanguage } from "@/contexts/LanguageContext";

const TIME_WINDOWS: Record<string, [number, number]> = {
  morning: [5, 12],
  afternoon: [12, 17],
  evening: [17, 21],
  night: [21, 24],
};

export function ReadingCoachPanel() {
  const { t } = useLanguage();
  const { items, isLoading: isLoadingContinue } = useContinueReading();
  const currentBook = items[0];
  const { stats, tips, isLoadingTips, generateTips } = useReadingCoach(currentBook?.book.id);
  const { preferredReadingTime } = useLibrarianPreferences();

  const hour = new Date().getHours();
  const isPreferredTimeNow = preferredReadingTime && preferredReadingTime !== "any"
    ? hour >= TIME_WINDOWS[preferredReadingTime][0] && hour < TIME_WINDOWS[preferredReadingTime][1]
    : false;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Compass className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.coach.title")}
      </h2>

      {isPreferredTimeNow && (
        <Card className="mb-3 flex items-center gap-2 border-primary/30 bg-primary/5 p-3">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm">{t("library.librarian.coach.preferredTimeNow")}</p>
        </Card>
      )}

      {isLoadingContinue ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      ) : !currentBook ? (
        <EmptyState icon={<Compass className="h-8 w-8" />} title={t("library.librarian.coach.noActiveBook")} className="py-6" />
      ) : (
        <Card className="space-y-3 p-4">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <Link to={`/library/books/${currentBook.book.slug}`} className="text-sm font-medium hover:underline">{currentBook.book.title}</Link>
              <span className="text-xs text-muted-foreground">{Math.round(currentBook.percent_complete)}%</span>
            </div>
            <Progress value={currentBook.percent_complete} className="h-1.5" />
          </div>

          {stats && (
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {stats.pages_per_day != null && (
                <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> {t("library.librarian.coach.pagesPerDay").replace("{count}", String(stats.pages_per_day))}</div>
              )}
              {stats.estimated_days_left != null && (
                <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> {t("library.librarian.coach.estimatedDaysLeft").replace("{count}", String(stats.estimated_days_left))}</div>
              )}
            </div>
          )}

          <div className="border-t pt-3">
            {tips && tips.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {tips.map((tip, i) => <li key={i} className="flex items-start gap-1.5"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />{tip}</li>)}
              </ul>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5" disabled={isLoadingTips} onClick={() => void generateTips()}>
                {isLoadingTips ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                {t("library.librarian.coach.getTips")}
              </Button>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
