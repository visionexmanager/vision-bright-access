import { useState } from "react";
import { Bookmark, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBookmarks } from "@/hooks/library/useBookmarks";

interface BookmarksPanelProps {
  bookId: string;
  onJumpToBookmark: (pageNumber: number | null, position: Record<string, unknown>) => void;
}

export function BookmarksPanel({ bookId, onJumpToBookmark }: BookmarksPanelProps) {
  const { t } = useLanguage();
  const { bookmarks, isLoading, rename, remove } = useBookmarks(bookId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (isLoading) return <SkeletonLoader variant="list" count={3} />;
  if (bookmarks.length === 0) return <EmptyState icon={<Bookmark className="h-8 w-8" />} title={t("library.reader.noBookmarks")} className="py-8" />;

  return (
    <ul className="space-y-1">
      {bookmarks.map((b) => (
        <li key={b.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
          {editingId === b.id ? (
            <form
              className="flex flex-1 gap-1.5"
              onSubmit={(e) => { e.preventDefault(); void rename(b.id, editValue); setEditingId(null); }}
            >
              <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus className="h-8 text-sm" />
              <Button type="submit" size="sm">{t("library.reviews.update")}</Button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onJumpToBookmark(b.page_number, b.position)}
                className="flex-1 truncate text-start text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {b.label || (b.page_number != null ? `${t("library.bookDetails.pages")} ${b.page_number}` : t("library.nav.bookDetails"))}
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setEditingId(b.id); setEditValue(b.label ?? ""); }} aria-label={t("library.reviews.edit")}>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => void remove(b.id)} aria-label={t("library.reviews.delete")}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
