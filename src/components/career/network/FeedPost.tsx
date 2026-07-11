import { useState } from "react";
import { ThumbsUp, PartyPopper, Lightbulb, Heart, MessageCircle, Bookmark, Share2, Image, Video, FileText, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { useAiSimulation } from "@/components/career/ai/useAiSimulation";
import { AIThinkingIndicator } from "@/components/career/ai/AIThinkingIndicator";
import { PostContent } from "./PostContent";
import type { FeedPostData, PostComment, ReactionType } from "./types";

const REACTIONS: { type: ReactionType; icon: typeof ThumbsUp }[] = [
  { type: "like", icon: ThumbsUp },
  { type: "celebrate", icon: PartyPopper },
  { type: "insightful", icon: Lightbulb },
  { type: "support", icon: Heart },
];

const MEDIA_ICON = { image: Image, video: Video, document: FileText } as const;

function summarize(content: string): string {
  const sentences = content.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, 2).join(" ");
}

interface FeedPostProps {
  post: FeedPostData;
  onReact: (id: string, reaction: ReactionType) => void;
  onToggleBookmark: (id: string) => void;
  onAddComment: (id: string, comment: PostComment) => void;
  onVotePoll: (id: string, optionId: string) => void;
  onShare: (id: string) => void;
}

export function FeedPost({ post, onReact, onToggleBookmark, onAddComment, onVotePoll, onShare }: FeedPostProps) {
  const { t } = useLanguage();
  const { playSound } = useSound();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [votedOption, setVotedOption] = useState<string | null>(null);
  const summary = useAiSimulation(() => summarize(post.content), 1000);

  const totalReactions = Object.values(post.reactions).reduce((a, b) => a + b, 0);
  const totalPollVotes = post.pollOptions?.reduce((a, o) => a + o.votes, 0) ?? 0;
  const isLongArticle = post.type === "article" && post.content.length > 300;

  const submitComment = () => {
    if (!commentText.trim()) return;
    playSound("send");
    onAddComment(post.id, { id: `c-${Date.now()}`, authorName: t("networkUI.feed.you"), authorColor: "#6366f1", text: commentText.trim(), date: new Date().toISOString().slice(0, 10) });
    setCommentText("");
  };

  const vote = (optionId: string) => {
    if (votedOption) return;
    setVotedOption(optionId);
    onVotePoll(post.id, optionId);
  };

  return (
    <article className="net-glass flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <CompanyAvatar name={post.authorName} color={post.authorColor} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{post.authorName}</p>
          <p className="truncate text-xs text-muted-foreground">{post.authorHeadline}</p>
          <p className="text-[11px] text-muted-foreground">{post.date}</p>
        </div>
      </div>

      <PostContent content={post.content} clamp={isLongArticle && !summary.result} />

      {isLongArticle && (
        <div>
          {!summary.result && !summary.loading && (
            <Button variant="outline" size="sm" onClick={summary.run}>
              <Sparkles className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("networkUI.feed.aiSummarize")}
            </Button>
          )}
          {summary.loading && <AIThinkingIndicator label={t("networkUI.feed.summarizing")} />}
          {summary.result && (
            <div className="rounded-xl bg-primary/5 p-3 text-sm">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary"><Sparkles className="h-3 w-3" aria-hidden="true" />{t("networkUI.feed.aiSummary")}</p>
              {summary.result}
            </div>
          )}
        </div>
      )}

      {post.mediaLabel && post.type !== "poll" && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {(() => {
            const Icon = MEDIA_ICON[post.type as keyof typeof MEDIA_ICON] ?? FileText;
            return <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />;
          })()}
          {post.mediaLabel}
        </div>
      )}

      {post.pollOptions && (
        <div className="flex flex-col gap-2">
          {post.pollOptions.map((opt) => {
            const percent = totalPollVotes ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => vote(opt.id)}
                disabled={Boolean(votedOption)}
                className="relative overflow-hidden rounded-lg border border-border p-2.5 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {votedOption && <span className="absolute inset-y-0 start-0 bg-primary/10" style={{ width: `${percent}%` }} aria-hidden="true" />}
                <span className="relative flex items-center justify-between">
                  <span>{opt.label}</span>
                  {votedOption && <span className="font-semibold text-primary">{percent}%</span>}
                </span>
              </button>
            );
          })}
          <p className="text-xs text-muted-foreground">{totalPollVotes} {t("networkUI.feed.votes")}</p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <span>{totalReactions} {t("networkUI.feed.reactions")}</span>
        <span>{post.comments.length} {t("networkUI.feed.comments")} · {post.shares} {t("networkUI.feed.shares")}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-border/50 pt-2">
        {REACTIONS.map(({ type, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => onReact(post.id, type)}
            aria-pressed={post.userReaction === type}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              post.userReaction === type ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t(`networkUI.feed.reaction.${type}`)}
          </button>
        ))}
        <button type="button" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {t("networkUI.feed.comment")}
        </button>
        <button type="button" onClick={() => onShare(post.id)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t("networkUI.feed.share")}
        </button>
        <button
          type="button"
          onClick={() => onToggleBookmark(post.id)}
          aria-pressed={post.bookmarked}
          className={`ms-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${post.bookmarked ? "text-primary" : "text-muted-foreground hover:bg-muted"}`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${post.bookmarked ? "fill-primary" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {showComments && (
        <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
          {post.comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <CompanyAvatar name={c.authorName} color={c.authorColor} size="sm" />
              <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm">
                <p className="font-semibold">{c.authorName}</p>
                <p className="text-muted-foreground">{c.text}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={1} className="resize-none" placeholder={t("networkUI.feed.commentPlaceholder")} />
            <Button size="sm" onClick={submitComment} disabled={!commentText.trim()}>{t("networkUI.feed.post")}</Button>
          </div>
        </div>
      )}
    </article>
  );
}
