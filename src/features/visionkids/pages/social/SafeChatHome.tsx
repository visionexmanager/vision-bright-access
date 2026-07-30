import { Link } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyConversations } from "@/features/visionkids/hooks/social/useChat";
import { useProfiles } from "@/features/visionkids/hooks/social/useFriends";

export default function SafeChatHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: conversations = [], isLoading } = useMyConversations();

  const otherIds = conversations.map((c) => (c.user_a === user?.id ? c.user_b : c.user_a));
  const { data: profiles = [] } = useProfiles(otherIds);
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  useDocumentHead({ title: `${t("kids.social.nav.safeChat")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/chat" });

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <MessagesSquare className="h-7 w-7 text-kids-green" aria-hidden="true" /> {t("kids.social.nav.safeChat")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.social.chat.subtitle")}</p>

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : conversations.length === 0 ? (
        <div className="mt-8 text-center text-muted-foreground">
          <p>{t("kids.social.chat.noConversations")}</p>
          <Link to="/kids/social/friends" className="mt-2 inline-block text-kids-primary hover:underline">{t("kids.social.nav.friends")}</Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {conversations.map((c) => {
            const otherId = c.user_a === user?.id ? c.user_b : c.user_a;
            const profile = profileMap.get(otherId);
            return (
              <Link key={c.id} to={`/kids/social/chat/${c.id}`} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 hover:border-kids-primary/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kids-primary/10 font-bold text-kids-primary">
                  {(profile?.display_name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{profile?.display_name || t("kids.social.friends.unknownUser")}</p>
                  {c.last_message_text && <p className="truncate text-sm text-muted-foreground">{c.last_message_text}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
