import { Star, MessageCircle, UserX, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import type { KidsFriendProfile } from "@/features/visionkids/types/social.types";

interface FriendCardProps {
  profile: KidsFriendProfile | undefined;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onMessage?: () => void;
  onRemove?: () => void;
  pendingIncoming?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
}

export function FriendCard({ profile, isFavorite, onToggleFavorite, onMessage, onRemove, pendingIncoming, onAccept, onDecline }: FriendCardProps) {
  const { t } = useLanguage();
  const name = profile?.display_name || t("kids.social.friends.unknownUser");

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <p className="flex-1 truncate font-semibold">{name}</p>

      {pendingIncoming ? (
        <div className="flex gap-1">
          <Button size="icon" variant="outline" className="h-8 w-8 text-kids-green" onClick={onAccept} aria-label={t("kids.social.friends.accept")}>
            <Check className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" onClick={onDecline} aria-label={t("kids.social.friends.decline")}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-1">
          {onToggleFavorite && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onToggleFavorite} aria-pressed={isFavorite} aria-label={t("kids.social.friends.favorite")}>
              <Star className={isFavorite ? "h-4 w-4 fill-kids-accent text-kids-accent" : "h-4 w-4"} aria-hidden="true" />
            </Button>
          )}
          {onMessage && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onMessage} aria-label={t("kids.social.chat.send")}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          {onRemove && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={t("kids.social.friends.remove")}>
              <UserX className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
