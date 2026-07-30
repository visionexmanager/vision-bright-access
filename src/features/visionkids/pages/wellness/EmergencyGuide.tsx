import { useEffect, useState } from "react";
import { Phone, Shield, Ambulance, Flame } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useEmergencyNumbers } from "@/features/visionkids/hooks/wellness/useWellnessCatalog";
import { useWellnessSettings, useUpsertWellnessSettings } from "@/features/visionkids/hooks/wellness/useWellnessEngagement";
import { WellnessHeader } from "@/features/visionkids/components/wellness/WellnessHeader";
import type { EmergencyNumbers } from "@/features/visionkids/types/wellness.types";

const SERVICES = [
  { key: "general" as const, icon: Phone, color: "text-kids-primary" },
  { key: "police" as const, icon: Shield, color: "text-kids-secondary" },
  { key: "ambulance" as const, icon: Ambulance, color: "text-kids-pink" },
  { key: "fire" as const, icon: Flame, color: "text-kids-accent" },
];

export default function EmergencyGuide() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: countries = [], isLoading } = useEmergencyNumbers();
  const { data: settings } = useWellnessSettings();
  const saveSettings = useUpsertWellnessSettings();

  const [selected, setSelected] = useState<string>("INTL");

  useDocumentHead({
    title: `${t("kids.wellness.nav.emergency")} — VisionKids`,
    description: t("kids.wellness.emergency.subtitle"),
    canonicalPath: "/kids/health/emergency",
  });

  // Default to the user's saved country once settings + list arrive.
  useEffect(() => {
    if (settings?.country_code && countries.some((c) => c.country_code === settings.country_code)) {
      setSelected(settings.country_code);
    }
  }, [settings?.country_code, countries]);

  const active: EmergencyNumbers | undefined =
    countries.find((c) => c.country_code === selected) ?? countries[0];

  function onSelect(code: string) {
    setSelected(code);
    if (user) saveSettings.mutate({ country_code: code });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <WellnessHeader emoji="🆘" title={t("kids.wellness.nav.emergency")} subtitle={t("kids.wellness.emergency.subtitle")} showSubNav activeId="emergency" />

      <p className="mt-4 rounded-2xl border-2 border-kids-accent/40 bg-kids-accent/10 p-3 text-sm font-medium" role="note">
        ⚠️ {t("kids.wellness.emergency.disclaimer")}
      </p>

      {/* Country selector */}
      <label className="mt-6 block text-sm font-semibold">
        {t("kids.wellness.emergency.countryLabel")}
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          disabled={isLoading}
          className="mt-1 block w-full rounded-xl border-2 border-border bg-background px-3 py-2 font-sans"
        >
          {countries.map((c) => (
            <option key={c.country_code} value={c.country_code}>{c.country_name}</option>
          ))}
        </select>
      </label>

      {/* Numbers */}
      {active && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SERVICES.map(({ key, icon: Icon, color }) => {
            const value = active[key];
            if (!value) return null;
            return (
              <div key={key} className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-4 text-center">
                <Icon className={`h-7 w-7 ${color}`} aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`kids.wellness.emergency.service.${key}`)}</span>
                <span className="font-heading text-2xl font-extrabold">{value}</span>
              </div>
            );
          })}
        </div>
      )}

      {active?.note && (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-card p-3 text-sm text-muted-foreground" role="note">
          ℹ️ {active.note}
        </p>
      )}

      {/* Safety steps */}
      <section className="mt-8 rounded-2xl border-2 border-border bg-card p-5">
        <h2 className="font-heading text-lg font-bold">{t("kids.wellness.emergency.stepsTitle")}</h2>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm">
          <li>{t("kids.wellness.emergency.step1")}</li>
          <li>{t("kids.wellness.emergency.step2")}</li>
          <li>{t("kids.wellness.emergency.step3")}</li>
          <li>{t("kids.wellness.emergency.step4")}</li>
        </ol>
      </section>

      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.wellness.emergency.signInHint")}</p>}
    </div>
  );
}
