import { useState } from "react";
import { UserPlus, UserCheck, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { MOCK_FOLLOWERS, MOCK_FOLLOWING, MOCK_SUGGESTED } from "../mock/mockConnections";
import type { NetworkPerson, SuggestedPerson } from "../types";

function PersonRow({ person, onToggleFollow, reason }: { person: NetworkPerson; onToggleFollow: (id: string) => void; reason?: string }) {
  const { t } = useLanguage();
  return (
    <li className="net-glass flex items-center gap-3 rounded-2xl p-4">
      <CompanyAvatar name={person.name} color={person.avatarColor} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{person.name}</p>
        <p className="truncate text-xs text-muted-foreground">{person.headline}</p>
        {reason && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-primary"><Sparkles className="h-3 w-3" aria-hidden="true" />{reason}</p>}
      </div>
      <Button size="sm" variant={person.isFollowing ? "outline" : "default"} onClick={() => onToggleFollow(person.id)}>
        {person.isFollowing ? <UserCheck className="me-1.5 h-3.5 w-3.5" aria-hidden="true" /> : <UserPlus className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />}
        {t(person.isFollowing ? "networkUI.connections.following" : "networkUI.connections.follow")}
      </Button>
    </li>
  );
}

export function ConnectionsPanel() {
  const { t } = useLanguage();
  const [followers, setFollowers] = useState<NetworkPerson[]>(MOCK_FOLLOWERS);
  const [following, setFollowing] = useState<NetworkPerson[]>(MOCK_FOLLOWING);
  const [suggested, setSuggested] = useState<SuggestedPerson[]>(MOCK_SUGGESTED);

  function toggle<T extends NetworkPerson>(list: T[], setList: (v: T[]) => void, id: string) {
    setList(list.map((p) => (p.id === id ? { ...p, isFollowing: !p.isFollowing } : p)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("networkUI.nav.connections")}</h1>
        <p className="text-sm text-muted-foreground">{t("networkUI.connections.subtitle")}</p>
      </div>

      <Tabs defaultValue="followers">
        <TabsList>
          <TabsTrigger value="followers">{t("networkUI.connections.followers")}</TabsTrigger>
          <TabsTrigger value="following">{t("networkUI.connections.followingTab")}</TabsTrigger>
          <TabsTrigger value="discover">{t("networkUI.connections.discover")}</TabsTrigger>
        </TabsList>
        <TabsContent value="followers" className="mt-4">
          <ul className="flex flex-col gap-2">
            {followers.map((p) => <PersonRow key={p.id} person={p} onToggleFollow={(id) => toggle(followers, setFollowers, id)} />)}
          </ul>
        </TabsContent>
        <TabsContent value="following" className="mt-4">
          <ul className="flex flex-col gap-2">
            {following.map((p) => <PersonRow key={p.id} person={p} onToggleFollow={(id) => toggle(following, setFollowing, id)} />)}
          </ul>
        </TabsContent>
        <TabsContent value="discover" className="mt-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />{t("networkUI.connections.aiSuggested")}</p>
          <ul className="flex flex-col gap-2">
            {suggested.map((p) => <PersonRow key={p.id} person={p} reason={p.reason} onToggleFollow={(id) => toggle(suggested, setSuggested, id)} />)}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
