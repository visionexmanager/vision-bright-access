import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import type { KidsChildSettings } from "@/features/visionkids/types/social.types";

const TOGGLES: { key: keyof KidsChildSettings; labelKey: string }[] = [
  { key: "allow_games", labelKey: "kids.social.control.games" },
  { key: "allow_videos", labelKey: "kids.social.control.videos" },
  { key: "allow_chat", labelKey: "kids.social.control.chat" },
  { key: "allow_voice_rooms", labelKey: "kids.social.control.voiceRooms" },
  { key: "allow_ai", labelKey: "kids.social.control.ai" },
  { key: "allow_downloads", labelKey: "kids.social.control.downloads" },
  { key: "allow_sharing", labelKey: "kids.social.control.sharing" },
];

interface ContentControlToggleGridProps {
  settings: KidsChildSettings;
  onChange: (key: keyof KidsChildSettings, value: boolean) => void;
}

export function ContentControlToggleGrid({ settings, onChange }: ContentControlToggleGridProps) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TOGGLES.map((toggle) => (
        <div key={toggle.key} className="flex items-center justify-between rounded-xl border-2 border-border bg-card px-4 py-3">
          <span className="text-sm font-semibold">{t(toggle.labelKey)}</span>
          <Switch checked={!!settings[toggle.key]} onCheckedChange={(v) => onChange(toggle.key, v)} />
        </div>
      ))}
    </div>
  );
}
