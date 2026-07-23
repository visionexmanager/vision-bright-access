import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReadingProgress } from "@/components/library/ReadingProgress";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAudiobookProgress } from "@/hooks/library/useAudiobookProgress";

interface ReadingProgressCardProps {
  bookId: string;
}

/** Named for the reading-progress fields it shows; the underlying hook also
 *  carries the audiobook position — see useAudiobookProgress's header note
 *  on why both cards share one row. */
export function ReadingProgressCard({ bookId }: ReadingProgressCardProps) {
  const { t } = useLanguage();
  const { progress, hasStarted, isLoading } = useAudiobookProgress(bookId);

  if (isLoading) return <SkeletonLoader variant="detail" />;
  if (!hasStarted) return null;

  return (
    <Card className="space-y-3 p-5">
      <h2 className="text-lg font-semibold">{t("library.readingProgress.label")}</h2>
      <ReadingProgress percentComplete={progress.percent_complete} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="space-y-0.5">
          {progress.current_page != null && <p>{t("library.bookDetails.lastPage")}: {progress.current_page}</p>}
          {progress.last_read_at && <p>{t("library.bookDetails.lastReadAt")}: {new Date(progress.last_read_at).toLocaleDateString()}</p>}
        </div>
        <Button asChild size="sm">
          <Link to={`/library/read/${bookId}`}>{t("library.actions.continueReading")}</Link>
        </Button>
      </div>
    </Card>
  );
}
