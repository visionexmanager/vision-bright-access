import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  useMyFriendships, useProfiles, useSendFriendRequest, useRespondFriendRequest,
  useRemoveFriendship, useFavoriteFriendIds, useToggleFavoriteFriend,
} from "@/features/visionkids/hooks/social/useFriends";
import { useStartConversation } from "@/features/visionkids/hooks/social/useChat";
import { FriendCard } from "@/features/visionkids/components/social/FriendCard";

export default function Friends() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [addUserId, setAddUserId] = useState("");

  const { data: friendships = [] } = useMyFriendships();
  const { data: favoriteIds = [] } = useFavoriteFriendIds();
  const sendRequest = useSendFriendRequest();
  const respond = useRespondFriendRequest();
  const remove = useRemoveFriendship();
  const toggleFavorite = useToggleFavoriteFriend();
  const startConversation = useStartConversation();

  const myId = user?.id;
  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === myId);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === myId);
  const favorites = accepted.filter((f) => favoriteIds.includes(f.requester_id === myId ? f.addressee_id : f.requester_id));

  const allOtherIds = useMemo(
    () => [...new Set(friendships.map((f) => (f.requester_id === myId ? f.addressee_id : f.requester_id)))],
    [friendships, myId],
  );
  const { data: profiles = [] } = useProfiles(allOtherIds);
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  useDocumentHead({ title: `${t("kids.social.nav.friends")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/friends" });

  const visible = tab === "all" ? accepted : tab === "favorites" ? favorites : tab === "requests" ? incoming : outgoing;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <UserPlus className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.social.nav.friends")}
      </h1>

      <div className="mt-4 flex gap-2">
        <Input value={addUserId} onChange={(e) => setAddUserId(e.target.value)} placeholder={t("kids.social.friends.addByIdPlaceholder")} />
        <Button onClick={() => { if (addUserId.trim()) { sendRequest.mutate(addUserId.trim()); setAddUserId(""); } }} disabled={sendRequest.isPending}>
          {t("kids.social.friends.sendRequest")}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">{t("kids.social.friends.tabAll")}</TabsTrigger>
          <TabsTrigger value="favorites">{t("kids.social.friends.tabFavorites")}</TabsTrigger>
          <TabsTrigger value="requests">{t("kids.social.friends.tabRequests")}{incoming.length > 0 ? ` (${incoming.length})` : ""}</TabsTrigger>
          <TabsTrigger value="sent">{t("kids.social.friends.tabSent")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-col gap-2">
        {visible.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("kids.social.friends.empty")}</p>}
        {visible.map((f) => {
          const otherId = f.requester_id === myId ? f.addressee_id : f.requester_id;
          return (
            <FriendCard
              key={f.id}
              profile={profileMap.get(otherId)}
              isFavorite={favoriteIds.includes(otherId)}
              pendingIncoming={tab === "requests"}
              onAccept={() => respond.mutate({ friendshipId: f.id, accept: true })}
              onDecline={() => respond.mutate({ friendshipId: f.id, accept: false })}
              onToggleFavorite={tab !== "requests" && tab !== "sent" ? () => toggleFavorite.mutate({ friendUserId: otherId, isFavorite: !favoriteIds.includes(otherId) }) : undefined}
              onMessage={tab === "all" || tab === "favorites" ? () => startConversation.mutate(otherId, { onSuccess: (c) => navigate(`/kids/social/chat/${c.id}`) }) : undefined}
              onRemove={tab !== "requests" ? () => remove.mutate(f.id) : undefined}
            />
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/kids/social/settings" className="hover:underline">{t("kids.social.friends.manageMutedBlocked")}</Link>
      </p>
    </div>
  );
}
