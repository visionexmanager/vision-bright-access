import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReadingProgressProps {
  percentComplete: number;
  className?: string;
}

export function ReadingProgress({ percentComplete, className }: ReadingProgressProps) {
  const { t } = useLanguage();
  const pct = Math.max(0, Math.min(100, Math.round(percentComplete)));

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("library.readingProgress.label")}</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} aria-label={`${t("library.readingProgress.label")}: ${pct}%`} />
    </div>
  );
}
