import { Bookmark, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AcademyLessonBookmarkRow } from "@/lib/types/academy-lms";

interface LessonBookmarksPanelProps {
  bookmarks: AcademyLessonBookmarkRow[];
  canBookmarkCurrentTime: boolean;
  onAddBookmark: () => void;
  onRemoveBookmark: (bookmarkId: string) => void;
}

function formatTimestamp(seconds: number | null) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LessonBookmarksPanel({
  bookmarks,
  canBookmarkCurrentTime,
  onAddBookmark,
  onRemoveBookmark,
}: LessonBookmarksPanelProps) {
  return (
    <div className="space-y-4">
      {canBookmarkCurrentTime && (
        <Button onClick={onAddBookmark} size="sm" variant="outline" className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" aria-hidden="true" />
          إضافة إشارة مرجعية عند اللحظة الحالية
        </Button>
      )}

      {bookmarks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">لا توجد إشارات مرجعية على هذا الدرس بعد.</p>
      ) : (
        <ul className="space-y-2">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">
              <Bookmark className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span className="flex-1 text-sm text-foreground">
                {bookmark.label ?? (formatTimestamp(bookmark.timestamp_seconds) ?? "بداية الدرس")}
              </span>
              <button
                onClick={() => onRemoveBookmark(bookmark.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="حذف الإشارة المرجعية"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
