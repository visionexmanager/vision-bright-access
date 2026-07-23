import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReaderBottomToolbarProps {
  currentChapterNumber: number;
  totalChapters: number;
  percentComplete: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  simplified?: boolean;
}

/** In pdf-iframe mode (`simplified`), only the prev/next chapter nav and a
 *  manual progress bar are shown — there's no reliable cross-frame page
 *  signal from a native PDF viewer, so precise auto-tracked position isn't
 *  available for that mode (see the Phase 6 plan's scope boundaries). */
export function ReaderBottomToolbar({
  currentChapterNumber, totalChapters, percentComplete, onPrev, onNext, canPrev, canNext, simplified,
}: ReaderBottomToolbarProps) {
  const { t, dir } = useLanguage();
  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <footer role="toolbar" aria-label={t("library.reader.bottomToolbar")} className="border-t bg-background px-2 py-2 sm:px-4">
      {!simplified && <Progress value={percentComplete} className="mb-2" aria-label={`${percentComplete}%`} />}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onPrev} disabled={!canPrev} aria-label={t("library.reader.prevChapter")}>
          <PrevIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {t("library.pagination.pageOf").replace("{page}", String(currentChapterNumber)).replace("{total}", String(totalChapters))}
        </span>
        <Button variant="ghost" size="icon" onClick={onNext} disabled={!canNext} aria-label={t("library.reader.nextChapter")}>
          <NextIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </footer>
  );
}
