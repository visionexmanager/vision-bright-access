import { Link } from "react-router-dom";
import { Settings as SettingsIcon, VolumeX, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyMutedUserIds, useUnmuteUser, useProfiles, useMyFriendships, useRemoveFriendship } from "@/features/visionkids/hooks/social/useFriends";
import { useChildSettings } from "@/features/visionkids/hooks/social/useChildSettings";

export default function SocialSettings() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: mutedIds = [] } = useMyMutedUserIds();
  const unmuteUser = useUnmuteUser();
  const { data: friendships = [] } = useMyFriendships();
  const removeFriendship = useRemoveFriendship();
  const { data: settings } = useChildSettings(user?.id);

  const blocked = friendships.filter((f) => f.status === "blocked");
  const { data: profiles = [] } = useProfiles([...mutedIds, ...blocked.map((f) => (f.requester_id === user?.id ? f.addressee_id : f.requester_id))]);
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  useDocumentHead({ title: `${t("kids.social.settings.title")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/settings" });

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold"><SettingsIcon className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.social.settings.title")}</h1>

      {settings && (
        <div className="mt-4 rounded-2xl border-2 border-border bg-card p-4 text-sm text-muted-foreground">
          {t("kids.social.settings.limitsManagedByParent")} {settings.daily_limit_minutes} {t("kids.social.settings.minutesPerDay")}
        </div>
      )}

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><VolumeX className="h-5 w-5" aria-hidden="true" /> {t("kids.social.settings.mutedUsers")}</h2>
      <div className="mt-2 flex flex-col gap-2">
        {mutedIds.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t("kids.social.settings.noMuted")}</p>}
        {mutedIds.map((id) => (
          <div key={id} className="flex items-center justify-between rounded-xl border-2 border-border bg-card p-3">
            <span className="text-sm font-semibold">{profileMap.get(id)?.display_name || t("kids.social.friends.unknownUser")}</span>
            <Button variant="outline" size="sm" onClick={() => unmuteUser.mutate(id)}>{t("kids.social.settings.unmute")}</Button>
          </div>
        ))}
      </div>

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><UserX className="h-5 w-5" aria-hidden="true" /> {t("kids.social.settings.blockedUsers")}</h2>
      <div className="mt-2 flex flex-col gap-2">
        {blocked.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t("kids.social.settings.noBlocked")}</p>}
        {blocked.map((f) => {
          const otherId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
          return (
            <div key={f.id} className="flex items-center justify-between rounded-xl border-2 border-border bg-card p-3">
              <span className="text-sm font-semibold">{profileMap.get(otherId)?.display_name || t("kids.social.friends.unknownUser")}</span>
              <Button variant="outline" size="sm" onClick={() => removeFriendship.mutate(f.id)}>{t("kids.social.settings.unblock")}</Button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/kids/settings" className="hover:underline">{t("kids.social.settings.accessibilityLink")}</Link>
      </p>
    </div>
  );
}
