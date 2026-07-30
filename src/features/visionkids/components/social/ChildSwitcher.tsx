import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { KidsFriendProfile } from "@/features/visionkids/types/social.types";

interface ChildSwitcherProps {
  childUserIds: string[];
  profiles: KidsFriendProfile[];
  selectedChildId: string | undefined;
  onSelect: (childId: string) => void;
}

export function ChildSwitcher({ childUserIds, profiles, selectedChildId, onSelect }: ChildSwitcherProps) {
  const { t } = useLanguage();
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  if (childUserIds.length === 0) return null;

  return (
    <Select value={selectedChildId} onValueChange={onSelect}>
      <SelectTrigger className="w-56"><SelectValue placeholder={t("kids.social.parents.chooseChild")} /></SelectTrigger>
      <SelectContent>
        {childUserIds.map((id) => (
          <SelectItem key={id} value={id}>{profileMap.get(id)?.display_name || t("kids.social.friends.unknownUser")}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
