import { Users, Check, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Community } from "./types";

interface CommunityCardProps {
  community: Community;
  onOpen: (id: string) => void;
  onToggleJoin: (id: string) => void;
}

export function CommunityCard({ community, onOpen, onToggleJoin }: CommunityCardProps) {
  const { t } = useLanguage();
  const Icon = community.icon;

  return (
    <div className="net-glass flex flex-col gap-3 rounded-2xl p-5">
      <button type="button" onClick={() => onOpen(community.id)} className="flex flex-1 flex-col items-start gap-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: community.color }}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-bold">{community.name}</p>
          <p className="text-xs text-muted-foreground">{community.description}</p>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {community.memberCount.toLocaleString()} {t("communityUI.members")}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onToggleJoin(community.id)}
        aria-pressed={community.isJoined}
        className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          community.isJoined ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
        }`}
      >
        {community.isJoined ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
        {t(community.isJoined ? "communityUI.joined" : "communityUI.join")}
      </button>
    </div>
  );
}
