import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, Settings as SettingsIcon, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyChildren } from "@/features/visionkids/hooks/academy/useAcademyParent";
import { useProfiles } from "@/features/visionkids/hooks/social/useFriends";
import { useChildSettings, useUpdateChildSettings } from "@/features/visionkids/hooks/social/useChildSettings";
import { ChildSwitcher } from "@/features/visionkids/components/social/ChildSwitcher";
import { ContentControlToggleGrid } from "@/features/visionkids/components/social/ContentControlToggleGrid";
import type { KidsChildSettings } from "@/features/visionkids/types/social.types";

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      <Input type="time" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default function ParentSettings() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const selectedChildId = params.get("child") ?? undefined;

  const { data: children = [] } = useMyChildren();
  const childIds = children.map((c) => c.child_user_id);
  const { data: profiles = [] } = useProfiles(childIds);
  const { data: settings } = useChildSettings(selectedChildId);
  const updateSettings = useUpdateChildSettings(selectedChildId);

  const [draft, setDraft] = useState<Partial<KidsChildSettings>>({});

  useEffect(() => { setDraft({}); }, [selectedChildId]);

  useDocumentHead({ title: `${t("kids.social.parents.settingsTitle")} — VisionKids`, description: t("kids.social.meta.description"), canonicalPath: "/kids/social/parents/settings" });

  if (!settings) {
    return <div className="mx-auto max-w-xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;
  }

  const current = { ...settings, ...draft };
  const setField = <K extends keyof KidsChildSettings>(key: K, value: KidsChildSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/kids/social/parents/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.social.parents.dashboardTitle")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold"><SettingsIcon className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.social.parents.settingsTitle")}</h1>
        <ChildSwitcher childUserIds={childIds} profiles={profiles} selectedChildId={selectedChildId} onSelect={(id) => setParams({ child: id })} />
      </div>

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Clock className="h-5 w-5" aria-hidden="true" /> {t("kids.social.parents.timeManagement")}</h2>
      <div className="mt-3 grid gap-4 rounded-2xl border-2 border-border bg-card p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold">{t("kids.social.parents.dailyLimit")}</span>
          <Input type="number" min={0} value={current.daily_limit_minutes} onChange={(e) => setField("daily_limit_minutes", Number(e.target.value))} />
        </label>
        <TimeField label={t("kids.social.parents.bedtimeStart")} value={current.bedtime_start?.slice(0, 5) ?? ""} onChange={(v) => setField("bedtime_start", v)} />
        <TimeField label={t("kids.social.parents.bedtimeEnd")} value={current.bedtime_end?.slice(0, 5) ?? ""} onChange={(v) => setField("bedtime_end", v)} />
        <TimeField label={t("kids.social.parents.studyStart")} value={current.study_time_start?.slice(0, 5) ?? ""} onChange={(v) => setField("study_time_start", v)} />
        <TimeField label={t("kids.social.parents.studyEnd")} value={current.study_time_end?.slice(0, 5) ?? ""} onChange={(v) => setField("study_time_end", v)} />
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold">{t("kids.social.parents.breakInterval")}</span>
          <Input type="number" min={5} value={current.break_interval_minutes} onChange={(e) => setField("break_interval_minutes", Number(e.target.value))} />
        </label>
      </div>

      <h2 className="mt-6 flex items-center gap-2 font-heading text-lg font-bold"><Shield className="h-5 w-5" aria-hidden="true" /> {t("kids.social.parents.contentControls")}</h2>
      <div className="mt-3">
        <ContentControlToggleGrid settings={current as KidsChildSettings} onChange={(key, value) => setField(key, value)} />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border-2 border-border bg-card px-4 py-3">
        <span className="text-sm font-semibold">{t("kids.social.parents.recordingConsent")}</span>
        <Button variant={current.recording_consent ? "default" : "outline"} size="sm" onClick={() => setField("recording_consent", !current.recording_consent)}>
          {current.recording_consent ? t("kids.social.parents.consentGranted") : t("kids.social.parents.consentDenied")}
        </Button>
      </div>

      <Button
        className="mt-6 w-full bg-kids-primary text-white hover:bg-kids-primary/90"
        onClick={() => updateSettings.mutate(draft, { onSuccess: () => setDraft({}) })}
        disabled={Object.keys(draft).length === 0 || updateSettings.isPending}
      >
        {t("kids.social.parents.saveSettings")}
      </Button>
    </div>
  );
}
