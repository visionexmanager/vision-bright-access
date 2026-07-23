import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowUp, ArrowDown, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchChaptersForEdit, createChapter, deleteChapter, reorderChapters, updateChapterMeta } from "@/services/library/chapters";
import { cn } from "@/lib/utils";

interface ChapterManagerSidebarProps {
  bookId: string;
  activeChapterId: string | undefined;
}

/**
 * Chapter list + reordering. Reordering uses explicit Up/Down buttons
 * rather than drag-and-drop — a deliberate accessibility choice: DnD alone
 * fails WCAG 2.2 AA's keyboard-operable criterion, and these buttons are
 * the keyboard-operable equivalent, not a secondary fallback bolted onto a
 * drag implementation.
 */
export function ChapterManagerSidebar({ bookId, activeChapterId }: ChapterManagerSidebarProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: queryKeys.library.chapters(bookId),
    queryFn: () => fetchChaptersForEdit(bookId),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.chapters(bookId) });

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      await createChapter(bookId, newTitle.trim());
      setNewTitle("");
      invalidate();
    } finally {
      setIsCreating(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    const reordered = [...chapters];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await reorderChapters(reordered.map((c) => c.id));
    invalidate();
  };

  const toggleFreePreview = async (chapterId: string, current: boolean) => {
    await updateChapterMeta(chapterId, { is_free_preview: !current });
    invalidate();
  };

  const remove = async (chapterId: string) => {
    if (!window.confirm(t("library.studio.editor.confirmDeleteChapter"))) return;
    await deleteChapter(chapterId);
    invalidate();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("library.studio.editor.chapters")}</h3>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : (
        <ol className="space-y-1">
          {chapters.map((chapter, index) => (
            <li key={chapter.id} className={cn("flex items-center gap-1 rounded-md border p-1.5 text-sm", chapter.id === activeChapterId && "border-primary bg-primary/5")}>
              <Link to={`/library/studio/books/${bookId}/edit/${chapter.id}`} className="flex-1 truncate hover:underline">
                {chapter.chapter_number}. {chapter.title || t("library.studio.editor.untitledChapter")}
              </Link>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void move(index, -1)} disabled={index === 0} aria-label={t("library.studio.editor.moveChapterUp")}>
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void move(index, 1)} disabled={index === chapters.length - 1} aria-label={t("library.studio.editor.moveChapterDown")}>
                <ArrowDown className="h-3 w-3" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => void toggleFreePreview(chapter.id, chapter.is_free_preview)}
                aria-pressed={chapter.is_free_preview}
                aria-label={chapter.is_free_preview ? t("library.studio.editor.freePreviewOn") : t("library.studio.editor.freePreviewOff")}
              >
                {chapter.is_free_preview ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => void remove(chapter.id)} aria-label={t("library.common.delete")}>
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className="flex gap-1.5">
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("library.studio.editor.newChapterTitle")} onKeyDown={(e) => e.key === "Enter" && void handleCreate()} />
        <Button size="icon" onClick={() => void handleCreate()} disabled={isCreating || !newTitle.trim()} aria-label={t("library.studio.editor.addChapter")}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
