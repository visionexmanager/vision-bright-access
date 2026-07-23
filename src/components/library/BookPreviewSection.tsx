import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryChapterRow } from "@/lib/types/library-book";

interface BookPreviewSectionProps {
  bookId: string;
  chapters: LibraryChapterRow[];
}

/** Free-preview pages, if any — RLS already only ever returns
 *  is_free_preview chapters (or all of them, if the viewer can access the
 *  full book) to callers who can't otherwise read the book, so this simply
 *  renders whichever free-preview chapters came back. */
export function BookPreviewSection({ bookId, chapters }: BookPreviewSectionProps) {
  const { t } = useLanguage();
  const previewChapters = chapters.filter((c) => c.is_free_preview && c.content_text);

  if (previewChapters.length === 0) return null;

  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-lg font-semibold">{t("library.bookDetails.preview")}</h2>
      <div className="max-h-96 space-y-4 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
        {previewChapters.map((chapter) => (
          <div key={chapter.id}>
            {chapter.title && <h3 className="mb-1 font-medium text-foreground">{chapter.title}</h3>}
            <p className="whitespace-pre-line">{chapter.content_text}</p>
          </div>
        ))}
      </div>
      <Button asChild>
        <Link to={`/library/read/${bookId}`}>{t("library.bookDetails.continueReading")}</Link>
      </Button>
    </Card>
  );
}
