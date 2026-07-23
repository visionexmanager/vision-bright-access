import { CheckCircle2, Circle, CircleDot, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { SectionError } from "@/components/library/SectionError";
import { EmptyState } from "@/components/library/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChapters } from "@/hooks/library/useChapters";
import { cn } from "@/lib/utils";

interface ChaptersListProps {
  bookId: string;
  currentPage: number | null;
  canAccessContent: boolean;
  /** When provided, each unlocked chapter becomes clickable — used by the
   *  Reader Engine's TOC panel to jump directly to a chapter. Omit for the
   *  read-only Book Details usage. */
  onSelectChapter?: (chapterId: string) => void;
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function ChaptersList({ bookId, currentPage, canAccessContent, onSelectChapter }: ChaptersListProps) {
  const { t } = useLanguage();
  const { chapters, isLoading, error, refetch } = useChapters(bookId, currentPage);

  if (isLoading) return <SkeletonLoader variant="list" count={4} />;
  if (error) return <SectionError message={error} onRetry={refetch} />;
  if (chapters.length === 0) return <EmptyState title={t("library.bookDetails.noChapters")} className="py-8" />;

  return (
    <ol className="divide-y rounded-xl border" aria-label={t("library.bookDetails.chapters")}>
      {chapters.map((chapter) => {
        const locked = !chapter.is_free_preview && !canAccessContent;
        const duration = formatDuration(chapter.duration_seconds);
        const clickable = !!onSelectChapter && !locked;
        return (
          <li
            key={chapter.id}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onSelectChapter(chapter.id) : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectChapter(chapter.id); } } : undefined}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm",
              chapter.isLastRead && "bg-primary/5",
              clickable && "cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            )}
          >
            {locked ? (
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : chapter.status === "read" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : chapter.status === "in-progress" ? (
              <CircleDot className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden="true" />
            )}

            <span className="w-6 shrink-0 text-muted-foreground">{chapter.chapter_number}.</span>
            <span className="flex-1 truncate">{chapter.title || `${t("library.bookDetails.chapter")} ${chapter.chapter_number}`}</span>

            {chapter.isLastRead && <Badge variant="outline" className="shrink-0 text-xs">{t("library.bookDetails.lastRead")}</Badge>}
            {duration && <span className="shrink-0 text-xs text-muted-foreground">{duration}</span>}
            {chapter.page_start != null && chapter.page_end != null && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("library.bookDetails.pageRange").replace("{start}", String(chapter.page_start)).replace("{end}", String(chapter.page_end))}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
