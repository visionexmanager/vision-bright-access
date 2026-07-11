import { useState } from "react";
import { ArrowLeft, Users, BookOpen, CalendarClock, ShieldCheck, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { FeedPost } from "@/components/career/network/FeedPost";
import type { FeedPostData, PostComment, ReactionType } from "@/components/career/network/types";
import type { Community } from "./types";

interface CommunityDetailProps {
  community: Community;
  onBack: () => void;
  onToggleJoin: (id: string) => void;
}

export function CommunityDetail({ community, onBack, onToggleJoin }: CommunityDetailProps) {
  const { t } = useLanguage();
  const Icon = community.icon;
  const [posts, setPosts] = useState<FeedPostData[]>(community.posts);

  const react = (id: string, reaction: ReactionType) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const reactions = { ...p.reactions };
      if (p.userReaction) reactions[p.userReaction] = Math.max(0, reactions[p.userReaction] - 1);
      const next = p.userReaction === reaction ? null : reaction;
      if (next) reactions[next] += 1;
      return { ...p, reactions, userReaction: next };
    }));
  };
  const toggleBookmark = (id: string) => setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, bookmarked: !p.bookmarked } : p)));
  const addComment = (id: string, comment: PostComment) => setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, comments: [...p.comments, comment] } : p)));
  const votePoll = (id: string, optionId: string) =>
    setPosts((prev) => prev.map((p) => (p.id === id && p.pollOptions ? { ...p, pollOptions: p.pollOptions.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)) } : p)));
  const share = (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, shares: p.shares + 1 } : p)));
    toast.success(t("networkUI.feed.sharedToast"));
  };

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 self-start text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("communityUI.backToAll")}
      </button>

      <div className="net-glass flex flex-wrap items-center gap-4 rounded-2xl p-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: community.color }}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{community.name}</h1>
          <p className="text-sm text-muted-foreground">{community.description}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" aria-hidden="true" />{community.memberCount.toLocaleString()} {t("communityUI.members")}</p>
        </div>
        <Button variant={community.isJoined ? "outline" : "default"} onClick={() => onToggleJoin(community.id)}>
          {community.isJoined ? <Check className="me-1.5 h-4 w-4" aria-hidden="true" /> : <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />}
          {t(community.isJoined ? "communityUI.joined" : "communityUI.join")}
        </Button>
      </div>

      <Tabs defaultValue="feed">
        <TabsList className="flex-wrap">
          <TabsTrigger value="feed">{t("communityUI.tab.feed")}</TabsTrigger>
          <TabsTrigger value="members">{t("communityUI.tab.members")}</TabsTrigger>
          <TabsTrigger value="resources">{t("communityUI.tab.resources")}</TabsTrigger>
          <TabsTrigger value="events">{t("communityUI.tab.events")}</TabsTrigger>
          <TabsTrigger value="rules">{t("communityUI.tab.rules")}</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-4 flex flex-col gap-4">
          {posts.map((post) => (
            <FeedPost key={post.id} post={post} onReact={react} onToggleBookmark={toggleBookmark} onAddComment={addComment} onVotePoll={votePoll} onShare={share} />
          ))}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {community.members.map((m) => (
              <li key={m.id} className="net-glass flex items-center gap-3 rounded-xl p-3">
                <CompanyAvatar name={m.name} color={m.avatarColor} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.headline}</p>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          <ul className="flex flex-col gap-2">
            {community.resources.map((r) => (
              <li key={r.id} className="net-glass flex items-center gap-3 rounded-xl p-3 text-sm">
                <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex-1">{r.title}</span>
                <span className="text-xs text-muted-foreground">{t(`communityUI.resourceType.${r.type}`)}</span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <ul className="flex flex-col gap-2">
            {community.events.map((e) => (
              <li key={e.id} className="net-glass flex items-center gap-3 rounded-xl p-3 text-sm">
                <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex-1">{e.title}</span>
                <span className="text-xs text-muted-foreground">{e.date}</span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="rules" className="mt-4 flex flex-col gap-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />{t("communityUI.moderators")}</p>
            <ul className="flex flex-col gap-2">
              {community.moderators.map((mod) => (
                <li key={mod.id} className="flex items-center gap-3 text-sm">
                  <CompanyAvatar name={mod.name} color={mod.avatarColor} size="sm" />
                  <span className="font-medium">{mod.name}</span>
                  <span className="text-xs text-muted-foreground">{t(`communityUI.role.${mod.role}`)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold">{t("communityUI.rules")}</p>
            <ol className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {community.rules.map((rule, i) => <li key={rule}>{i + 1}. {rule}</li>)}
            </ol>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
