import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBookComments } from "@/hooks/library/useBookComments";
import { cn } from "@/lib/utils";

interface CommentsPanelProps {
  bookId: string;
  chapterId?: string;
}

export function CommentsPanel({ bookId, chapterId }: CommentsPanelProps) {
  const { t } = useLanguage();
  const { comments, isLoading, postComment, resolve } = useBookComments(bookId, chapterId);
  const [draft, setDraft] = useState("");

  const handlePost = async () => {
    if (!draft.trim()) return;
    await postComment(draft);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("library.studio.comments.title")}</h3>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("library.studio.comments.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((comment) => (
            <li key={comment.id} className={cn("rounded-md border p-2 text-sm", comment.status === "resolved" && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <p>{comment.body}</p>
                {comment.status === "open" && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => void resolve(comment.id)} aria-label={t("library.studio.comments.resolve")}>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder={t("library.studio.comments.placeholder")} />
        <Button size="icon" onClick={() => void handlePost()} disabled={!draft.trim()} aria-label={t("library.studio.comments.post")}>
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
