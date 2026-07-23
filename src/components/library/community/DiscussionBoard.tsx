import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Pin, Lock, Plus, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useDiscussionTopics } from "@/hooks/library/useDiscussions";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryDiscussionContext, LibrarySimilarTopic } from "@/services/library/discussions";

interface DiscussionBoardProps {
  contextType: LibraryDiscussionContext;
  contextId: string;
  canModerate?: boolean;
}

export function DiscussionBoard({ contextType, contextId, canModerate }: DiscussionBoardProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { topics, isLoading, query, setQuery, create, checkDuplicates, pin, lock } = useDiscussionTopics(contextType, contextId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [similar, setSimilar] = useState<LibrarySimilarTopic[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleTitleChange = async (value: string) => {
    setTitle(value);
    setSimilar(value.trim().length >= 4 ? await checkDuplicates(value) : []);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    const topic = await create(title, body, isSpoiler);
    setIsCreating(false);
    if (topic) {
      setOpen(false);
      setTitle("");
      setBody("");
      setIsSpoiler(false);
      setSimilar([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("library.discussions.searchPlaceholder")} className="ps-9" />
        </div>
        {user && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.discussions.newTopic")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.discussions.newTopic")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="topic-title">{t("library.discussions.titleLabel")}</Label>
                  <Input id="topic-title" value={title} onChange={(e) => void handleTitleChange(e.target.value)} />
                </div>
                {similar.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
                    <p className="mb-1 font-medium">{t("library.discussions.similarFound")}</p>
                    <ul className="space-y-0.5">
                      {similar.map((s) => <li key={s.id}>• {s.title}</li>)}
                    </ul>
                  </div>
                )}
                <div>
                  <Label htmlFor="topic-body">{t("library.discussions.bodyLabel")}</Label>
                  <Textarea id="topic-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="topic-spoiler" checked={isSpoiler} onCheckedChange={(v) => setIsSpoiler(v === true)} />
                  <Label htmlFor="topic-spoiler" className="text-sm font-normal">{t("library.reviews.spoilerWarning")}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => void handleCreate()} disabled={isCreating || !title.trim()}>{t("library.discussions.post")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <SkeletonLoader variant="list" count={3} />
      ) : topics.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-8 w-8" />} title={t("library.discussions.empty")} className="py-8" />
      ) : (
        <ul className="space-y-2">
          {topics.map((topic) => (
            <li key={topic.id}>
              <Card className="p-3 transition-shadow hover:shadow-sm">
                <Link to={`/library/discussions/${topic.id}`} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {topic.is_pinned && <Pin className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />}
                      {topic.is_locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      {topic.is_spoiler && <Badge variant="outline" className="gap-1 text-[10px]"><Eye className="h-2.5 w-2.5" aria-hidden="true" /> {t("library.reviews.spoilerWarning")}</Badge>}
                      <p className="truncate font-medium">{topic.title}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{topic.authorName} · {new Date(topic.last_activity_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> {topic.reply_count}</span>
                  </div>
                </Link>
                {canModerate && (
                  <div className="mt-2 flex gap-2 border-t pt-2">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void pin(topic.id, !topic.is_pinned)}>
                      {topic.is_pinned ? t("library.discussions.unpin") : t("library.discussions.pin")}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void lock(topic.id, !topic.is_locked)}>
                      {topic.is_locked ? t("library.discussions.unlock") : t("library.discussions.lockTopic")}
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
