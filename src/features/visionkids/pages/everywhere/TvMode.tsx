import { useEffect, useState } from "react";
import { Tv, ArrowUpDown, Volume2, Type } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { usePreferences, useSavePreferences } from "@/features/visionkids/hooks/everywhere/useEverywhere";
import { setTvMode, getTvMode, getLowData } from "@/features/visionkids/everywhere/modes";
import { EverywhereHeader } from "@/features/visionkids/components/everywhere/EverywhereShell";

const FEATURES = [
  { icon: Type, key: "largeText" },
  { icon: ArrowUpDown, key: "remoteNav" },
  { icon: Tv, key: "focus" },
  { icon: Volume2, key: "audioFeedback" },
];

export default function TvMode() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: prefs } = usePreferences();
  const save = useSavePreferences();
  const [tv, setTv] = useState(getTvMode());
  const [audioGuidance, setAudioGuidance] = useState(false);

  useEffect(() => {
    if (prefs) { setTv(prefs.tv_mode); setAudioGuidance(prefs.audio_guidance); setTvMode(prefs.tv_mode); }
  }, [prefs]);

  useDocumentHead({ title: `${t("kids.everywhere.nav.tv")} — VisionKids`, description: t("kids.everywhere.tv.subtitle"), canonicalPath: "/kids/everywhere/tv" });

  function persist(nextTv: boolean, nextAudio: boolean) {
    setTvMode(nextTv);
    if (user) save.mutate({ low_data: getLowData(), wifi_only: prefs?.wifi_only ?? true, auto_download: prefs?.auto_download ?? false, tv_mode: nextTv, audio_guidance: nextAudio });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <EverywhereHeader emoji="📺" title={t("kids.everywhere.nav.tv")} subtitle={t("kids.everywhere.tv.subtitle")} />

      <div className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
        <Tv className="h-8 w-8 shrink-0 text-kids-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Label htmlFor="tv-mode" className="font-heading text-lg font-bold">{t("kids.everywhere.tv.enable")}</Label>
          <p className="text-xs text-muted-foreground">{t("kids.everywhere.tv.enableDesc")}</p>
        </div>
        <Switch id="tv-mode" checked={tv} onCheckedChange={(v) => { setTv(v); persist(v, audioGuidance); }} />
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
        <Volume2 className="h-6 w-6 shrink-0 text-kids-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Label htmlFor="audio-guidance" className="font-heading font-bold">{t("kids.everywhere.tv.audioGuidance")}</Label>
          <p className="text-xs text-muted-foreground">{t("kids.everywhere.tv.audioGuidanceDesc")}</p>
        </div>
        <Switch id="audio-guidance" checked={audioGuidance} onCheckedChange={(v) => { setAudioGuidance(v); persist(tv, v); }} />
      </div>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-bold">{t("kids.everywhere.tv.features")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, key }) => (
            <div key={key} className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-primary" aria-hidden="true" />
              <div>
                <p className="font-heading text-sm font-bold">{t(`kids.everywhere.tv.feature.${key}.title`)}</p>
                <p className="text-sm text-muted-foreground">{t(`kids.everywhere.tv.feature.${key}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
