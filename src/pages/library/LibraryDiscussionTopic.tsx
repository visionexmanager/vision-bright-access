import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MessageSquare, Pin, Lock, Eye, Heart, ImagePlus, Quote, Trash2, BarChart3, Sparkles, Loader2, Languages } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { ReportContentDialog } from "@/components/library/ReportContentDialog";
import { useDiscussionThread } from "@/hooks/library/useDiscussions";
import { useDiscussionSummary, useCommentTranslation } from "@/hooks/library/useCommunityAi";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { cn } from "@/lib/utils";
import type { LibraryDiscussionReplyRow } from "@/services/library/discussions";

function ReplyComposer({ onSubmit, quoted, onCancelQuote, uploadImage }: {
  onSubmit: (body: string, imageUrls: string[]) => Promise<void>;
  quoted?: LibraryDiscussionReplyRow | null;
  onCancelQuote?: () => void;
  uploadImage: (file: File) => Promise<string>;
}) {
  const { t } = useLanguage();
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const url = await uploadImage(file);
    setImages((prev) => [...prev, url]);
  };

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setIsSubmitting(true);
    await onSubmit(body, images);
    setIsSubmitting(false);
    setBody("");
    setImages([]);
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      {quoted && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-muted/50 p-2 text-xs">
          <p className="line-clamp-2"><span className="font-medium">{quoted.authorName}:</span> {quoted.body}</p>
          {onCancelQuote && (
            <button type="button" onClick={onCancelQuote} aria-label={t("library.discussions.cancelQuote")} className="shrink-0 text-muted-foreground hover:text-foreground">✕</button>
          )}
        </div>
      )}
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={t("library.discussions.replyPlaceholder")} />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => <img key={url} src={url} alt="" className="h-14 w-14 rounded object-cover" />)}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }} />
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.discussions.addImage")}
          </Button>
        </div>
        <Button size="sm" disabled={isSubmitting || !body.trim()} onClick={() => void handleSubmit()}>{t("library.discussions.post")}</Button>
      </div>
    </div>
  );
}

function ReplyItem({ reply, onLike, onReply, onQuote, onDelete, canDelete, onTranslate, translated, isTranslating }: {
  reply: LibraryDiscussionReplyRow;
  onLike: () => void;
  onReply: () => void;
  onQuote: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  onTranslate: () => void;
  translated?: string;
  isTranslating: boolean;
}) {
  const { t } = useLanguage();
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex gap-2.5">
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={reply.authorAvatarUrl ?? undefined} alt="" />
        <AvatarFallback>{reply.authorName.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">{reply.authorName}</span>
          <span className="text-muted-foreground">{new Date(reply.created_at).toLocaleString()}</span>
        </div>
        {reply.is_spoiler && !revealed ? (
          <button type="button" onClick={() => setRevealed(true)} className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
            <Eye className="h-3 w-3" aria-hidden="true" /> {t("library.reviews.showSpoiler")}
          </button>
        ) : (
          <>
            <p className="text-sm">{reply.body}</p>
            {translated && <p className="mt-1 rounded-md bg-muted/50 p-1.5 text-sm italic text-muted-foreground">{translated}</p>}
          </>
        )}
        {reply.image_urls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {reply.image_urls.map((url) => <img key={url} src={url} alt="" className="h-16 w-16 rounded object-cover" />)}
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className={cn("h-6 gap-1 px-1.5 text-xs", reply.likedByMe && "text-primary")} onClick={onLike} aria-pressed={reply.likedByMe}>
            <Heart className={cn("h-3 w-3", reply.likedByMe && "fill-current")} aria-hidden="true" /> {reply.likes_count}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={onReply}>{t("library.discussions.reply")}</Button>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={onQuote}><Quote className="h-3 w-3" aria-hidden="true" /> {t("library.discussions.quote")}</Button>
          {!translated && (
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={onTranslate} disabled={isTranslating}>
              {isTranslating ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Languages className="h-3 w-3" aria-hidden="true" />} {t("library.discussions.translate")}
            </Button>
          )}
          {canDelete && onDelete && (
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" aria-hidden="true" /></Button>
          )}
          <ReportContentDialog contentType="library_discussion_reply" contentId={reply.id} iconOnly />
        </div>
      </div>
    </div>
  );
}

export default function LibraryDiscussionTopic() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { topicId } = useParams<{ topicId: string }>();
  const { topic, replies, poll, isLoading, reply, removeReply, toggleLike, uploadImage, vote } = useDiscussionThread(topicId);
  const { summary, isSummarizing, summarize } = useDiscussionSummary(topicId);
  const { translations, translatingId, translate } = useCommentTranslation();
  const [replyTarget, setReplyTarget] = useState<{ parentReplyId?: string; quotedReplyId?: string; quoted?: LibraryDiscussionReplyRow } | null>(null);
  const [topicRevealed, setTopicRevealed] = useState(false);

  useDocumentHead({ title: topic ? `${topic.title} — ${t("library.discussions.title")}` : t("library.discussions.title") });

  const topLevelReplies = replies.filter((r) => !r.parent_reply_id);
  const childReplies = (parentId: string) => replies.filter((r) => r.parent_reply_id === parentId);

  return (
    <Layout>
      <LibraryLayout title={topic?.title ?? t("library.discussions.title")} breadcrumb={topic ? [{ label: topic.title }] : []}>
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !topic ? (
          <EmptyState icon={<MessageSquare className="h-10 w-10" />} title={t("library.discussions.notFound")} />
        ) : (
          <div className="space-y-6">
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-1.5">
                {topic.is_pinned && <Badge variant="secondary" className="gap-1"><Pin className="h-3 w-3" aria-hidden="true" /> {t("library.discussions.pin")}</Badge>}
                {topic.is_locked && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" aria-hidden="true" /> {t("library.discussions.lockTopic")}</Badge>}
              </div>
              <h2 className="text-lg font-bold">{topic.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{topic.authorName} · {new Date(topic.created_at).toLocaleString()}</p>
              {topic.body && (
                topic.is_spoiler && !topicRevealed ? (
                  <button type="button" onClick={() => setTopicRevealed(true)} className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.reviews.showSpoiler")}
                  </button>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{topic.body}</p>
                )
              )}
            </Card>

            {poll && (
              <Card className="space-y-2 p-4">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold"><BarChart3 className="h-4 w-4" aria-hidden="true" /> {poll.poll.question}</h2>
                <div className="space-y-1.5">
                  {poll.poll.options.map((opt) => {
                    const count = poll.votesByOption[opt.id] ?? 0;
                    const total = Object.values(poll.votesByOption).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => void vote(opt.id)}
                        className={cn("relative w-full overflow-hidden rounded-md border p-2 text-start text-sm", poll.myVote === opt.id && "border-primary")}
                      >
                        <div className="absolute inset-y-0 start-0 bg-primary/10" style={{ width: `${pct}%` }} />
                        <span className="relative flex justify-between"><span>{opt.label}</span><span className="text-muted-foreground">{pct}%</span></span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}

            {replies.length >= 3 && (
              <Card className="p-4">
                {summary ? (
                  <div className="space-y-2">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4" aria-hidden="true" /> {t("library.discussions.summaryHeading")}</h2>
                    <p className="text-sm">{summary.summary}</p>
                    {summary.keyPoints.length > 0 && (
                      <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                        {summary.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void summarize()} disabled={isSummarizing}>
                    {isSummarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                    {t("library.discussions.summarize")}
                  </Button>
                )}
              </Card>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold">{t("library.discussions.repliesHeading")} ({replies.length})</h2>
              {!topic.is_locked && user && (
                <div className="mb-4">
                  <ReplyComposer
                    quoted={replyTarget?.quoted}
                    onCancelQuote={() => setReplyTarget(null)}
                    uploadImage={uploadImage}
                    onSubmit={async (body, imageUrls) => {
                      await reply(body, { parentReplyId: replyTarget?.parentReplyId, quotedReplyId: replyTarget?.quotedReplyId, imageUrls });
                      setReplyTarget(null);
                    }}
                  />
                </div>
              )}
              {topic.is_locked && <p className="mb-4 text-sm text-muted-foreground">{t("library.discussions.locked")}</p>}

              {topLevelReplies.length === 0 ? (
                <EmptyState icon={<MessageSquare className="h-8 w-8" />} title={t("library.discussions.noReplies")} className="py-8" />
              ) : (
                <div className="space-y-4">
                  {topLevelReplies.map((r) => (
                    <div key={r.id} className="space-y-3">
                      <ReplyItem
                        reply={r}
                        onLike={() => void toggleLike(r.id, r.likedByMe)}
                        onReply={() => setReplyTarget({ parentReplyId: r.id })}
                        onQuote={() => setReplyTarget({ quotedReplyId: r.id, quoted: r })}
                        onDelete={user?.id === r.author_id ? () => void removeReply(r.id) : undefined}
                        canDelete={user?.id === r.author_id}
                        onTranslate={() => void translate(r.id, r.body, lang)}
                        translated={translations[r.id]}
                        isTranslating={translatingId === r.id}
                      />
                      {childReplies(r.id).length > 0 && (
                        <div className="ms-9 space-y-3 border-s ps-3">
                          {childReplies(r.id).map((child) => (
                            <ReplyItem
                              key={child.id}
                              reply={child}
                              onLike={() => void toggleLike(child.id, child.likedByMe)}
                              onReply={() => setReplyTarget({ parentReplyId: r.id })}
                              onQuote={() => setReplyTarget({ quotedReplyId: child.id, quoted: child })}
                              onDelete={user?.id === child.author_id ? () => void removeReply(child.id) : undefined}
                              canDelete={user?.id === child.author_id}
                              onTranslate={() => void translate(child.id, child.body, lang)}
                              translated={translations[child.id]}
                              isTranslating={translatingId === child.id}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
