import { useEffect, useState } from "react";
import { Gauge, Wifi, DownloadCloud } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { usePreferences, useSavePreferences } from "@/features/visionkids/hooks/everywhere/useEverywhere";
import { setLowData, getLowData, getTvMode } from "@/features/visionkids/everywhere/modes";
import { EverywhereHeader } from "@/features/visionkids/components/everywhere/EverywhereShell";

export default function ConnectionSettings() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: prefs } = usePreferences();
  const save = useSavePreferences();

  const [lowData, setLow] = useState(getLowData());
  const [wifiOnly, setWifiOnly] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);

  useEffect(() => {
    if (prefs) { setLow(prefs.low_data); setWifiOnly(prefs.wifi_only); setAutoDownload(prefs.auto_download); setLowData(prefs.low_data); }
  }, [prefs]);

  useDocumentHead({ title: `${t("kids.everywhere.nav.connection")} — VisionKids`, description: t("kids.everywhere.connection.subtitle"), canonicalPath: "/kids/everywhere/connection" });

  function persist(next: { lowData: boolean; wifiOnly: boolean; autoDownload: boolean }) {
    setLowData(next.lowData);
    if (user) save.mutate({ low_data: next.lowData, wifi_only: next.wifiOnly, auto_download: next.autoDownload, tv_mode: getTvMode(), audio_guidance: prefs?.audio_guidance ?? false });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <EverywhereHeader emoji="📶" title={t("kids.everywhere.nav.connection")} subtitle={t("kids.everywhere.connection.subtitle")} />
      <div className="mt-6 flex flex-col gap-4">
        <Row icon={Gauge} labelKey="kids.everywhere.connection.lowData" descKey="kids.everywhere.connection.lowDataDesc"
          checked={lowData} onChange={(v) => { setLow(v); persist({ lowData: v, wifiOnly, autoDownload }); }} />
        <Row icon={Wifi} labelKey="kids.everywhere.connection.wifiOnly" descKey="kids.everywhere.connection.wifiOnlyDesc"
          checked={wifiOnly} onChange={(v) => { setWifiOnly(v); persist({ lowData, wifiOnly: v, autoDownload }); }} />
        <Row icon={DownloadCloud} labelKey="kids.everywhere.connection.autoDownload" descKey="kids.everywhere.connection.autoDownloadDesc"
          checked={autoDownload} onChange={(v) => { setAutoDownload(v); persist({ lowData, wifiOnly, autoDownload: v }); }} />
      </div>
      {lowData && <p className="mt-4 rounded-xl border-2 border-kids-accent/40 bg-kids-accent/10 p-3 text-sm font-medium text-kids-accent">⚡ {t("kids.everywhere.connection.lowDataActive")}</p>}
      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.everywhere.connection.localOnly")}</p>}
    </div>
  );
}

function Row({ icon: Icon, labelKey, descKey, checked, onChange }: { icon: typeof Gauge; labelKey: string; descKey: string; checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const id = labelKey;
  return (
    <section className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
      <Icon className="h-6 w-6 shrink-0 text-kids-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="font-heading font-bold">{t(labelKey)}</Label>
        <p className="text-xs text-muted-foreground">{t(descKey)}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </section>
  );
}
