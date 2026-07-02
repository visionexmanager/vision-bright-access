import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MOCK_POSTS } from "../mock/mockPosts";
import { PostComposer } from "../PostComposer";
import { FeedPost } from "../FeedPost";
import { TrendingSidebar } from "../TrendingSidebar";
import type { FeedPostData, PostComment, ReactionType } from "../types";

const PAGE_SIZE = 4;

export function Feed() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<FeedPostData[]>(MOCK_POSTS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const addPost = (post: FeedPostData) => setPosts((prev) => [post, ...prev]);

  const react = (id: string, reaction: ReactionType) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const reactions = { ...p.reactions };
        if (p.userReaction) reactions[p.userReaction] = Math.max(0, reactions[p.userReaction] - 1);
        const nextReaction = p.userReaction === reaction ? null : reaction;
        if (nextReaction) reactions[nextReaction] += 1;
        return { ...p, reactions, userReaction: nextReaction };
      })
    );
  };

  const toggleBookmark = (id: string) => setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, bookmarked: !p.bookmarked } : p)));

  const addComment = (id: string, comment: PostComment) =>
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, comments: [...p.comments, comment] } : p)));

  const votePoll = (id: string, optionId: string) =>
    setPosts((prev) =>
      prev.map((p) => (p.id === id && p.pollOptions ? { ...p, pollOptions: p.pollOptions.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)) } : p))
    );

  const share = (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, shares: p.shares + 1 } : p)));
    toast.success(t("networkUI.feed.sharedToast"));
  };

  const visiblePosts = posts.slice(0, visibleCount);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-4">
        <PostComposer onPublish={addPost} />
        {visiblePosts.map((post) => (
          <FeedPost key={post.id} post={post} onReact={react} onToggleBookmark={toggleBookmark} onAddComment={addComment} onVotePoll={votePoll} onShare={share} />
        ))}
        {visibleCount < posts.length && (
          <Button variant="outline" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} className="self-center">
            {t("networkUI.feed.loadMore")}
          </Button>
        )}
      </div>
      <div className="hidden lg:block">
        <TrendingSidebar />
      </div>
    </div>
  );
}
