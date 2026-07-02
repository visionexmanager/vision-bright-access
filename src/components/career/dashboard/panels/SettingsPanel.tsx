import type { ReactNode } from "react";
import { Globe, Bell, Shield, Eye, Volume2, Type, Zap, Hand, Mic } from "lucide-react";
import { useLanguage, supportedLangs } from "@/contexts/LanguageContext";
import { useCareerDashboard } from "@/contexts/CareerDashboardContext";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GeneralSettings } from "../types";

const TIMEZONES = ["UTC", "Asia/Amman", "Europe/London", "America/New_York", "Asia/Dubai", "Asia/Tokyo"];
const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "JOD"];

function SettingsRow({ icon: Icon, title, desc, control }: { icon: typeof Globe; title: string; desc: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {control}
    </div>
  );
}

export function SettingsPanel() {
  const { t, lang, setLang } = useLanguage();
  const { generalSettings, updateGeneralSettings, accessibility, updateAccessibility } = useCareerDashboard();

  const updateGeneral = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) =>
    updateGeneralSettings({ [key]: value } as Partial<GeneralSettings>);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("careerDash.nav.settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("careerDash.settings.subtitle")}</p>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-6" aria-labelledby="settings-general-heading">
        <h2 id="settings-general-heading" className="mb-2 font-bold">{t("careerDash.settings.general")}</h2>
        <div className="divide-y divide-border">
          <SettingsRow
            icon={Globe}
            title={t("careerDash.settings.language")}
            desc={t("careerDash.settings.languageDesc")}
            control={
              <Select value={lang} onValueChange={(v) => setLang(v as typeof lang)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {supportedLangs.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            }
          />
          <SettingsRow
            icon={Globe}
            title={t("careerDash.settings.timezone")}
            desc={t("careerDash.settings.timezoneDesc")}
            control={
              <Select value={generalSettings.timezone} onValueChange={(v) => updateGeneral("timezone", v)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            }
          />
          <SettingsRow
            icon={Globe}
            title={t("careerDash.settings.currency")}
            desc={t("careerDash.settings.currencyDesc")}
            control={
              <Select value={generalSettings.currency} onValueChange={(v) => updateGeneral("currency", v)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            }
          />
          <SettingsRow
            icon={Bell}
            title={t("careerDash.settings.emailNotifications")}
            desc={t("careerDash.settings.emailNotificationsDesc")}
            control={<Switch checked={generalSettings.emailNotifications} onCheckedChange={(v) => updateGeneral("emailNotifications", v)} aria-label={t("careerDash.settings.emailNotifications")} />}
          />
          <SettingsRow
            icon={Bell}
            title={t("careerDash.settings.pushNotifications")}
            desc={t("careerDash.settings.pushNotificationsDesc")}
            control={<Switch checked={generalSettings.pushNotifications} onCheckedChange={(v) => updateGeneral("pushNotifications", v)} aria-label={t("careerDash.settings.pushNotifications")} />}
          />
          <SettingsRow
            icon={Shield}
            title={t("careerDash.settings.privacy")}
            desc={t("careerDash.settings.privacyDesc")}
            control={
              <Select value={generalSettings.profileVisibility} onValueChange={(v) => updateGeneral("profileVisibility", v as GeneralSettings["profileVisibility"])}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">{t("careerDash.settings.visibility.public")}</SelectItem>
                  <SelectItem value="employersOnly">{t("careerDash.settings.visibility.employersOnly")}</SelectItem>
                  <SelectItem value="private">{t("careerDash.settings.visibility.private")}</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6" aria-labelledby="settings-a11y-heading">
        <h2 id="settings-a11y-heading" className="mb-1 font-bold">{t("careerDash.settings.accessibility")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("careerDash.settings.accessibilityDesc")}</p>
        <div className="divide-y divide-border/60">
          <SettingsRow
            icon={Volume2}
            title={t("careerDash.settings.screenReaderMode")}
            desc={t("careerDash.settings.screenReaderModeDesc")}
            control={<Switch checked={accessibility.screenReaderMode} onCheckedChange={(v) => updateAccessibility({ screenReaderMode: v })} aria-label={t("careerDash.settings.screenReaderMode")} />}
          />
          <SettingsRow
            icon={Eye}
            title={t("careerDash.settings.highContrast")}
            desc={t("careerDash.settings.highContrastDesc")}
            control={<Switch checked={accessibility.highContrast} onCheckedChange={(v) => updateAccessibility({ highContrast: v })} aria-label={t("careerDash.settings.highContrast")} />}
          />
          <SettingsRow
            icon={Type}
            title={t("careerDash.settings.largeText")}
            desc={t("careerDash.settings.largeTextDesc")}
            control={<Switch checked={accessibility.largeText} onCheckedChange={(v) => updateAccessibility({ largeText: v })} aria-label={t("careerDash.settings.largeText")} />}
          />
          <SettingsRow
            icon={Zap}
            title={t("careerDash.settings.reducedMotion")}
            desc={t("careerDash.settings.reducedMotionDesc")}
            control={<Switch checked={accessibility.reducedMotion} onCheckedChange={(v) => updateAccessibility({ reducedMotion: v })} aria-label={t("careerDash.settings.reducedMotion")} />}
          />
          <SettingsRow
            icon={Hand}
            title={t("careerDash.settings.brailleReady")}
            desc={t("careerDash.settings.brailleReadyDesc")}
            control={<Switch checked={accessibility.brailleDisplayReady} onCheckedChange={(v) => updateAccessibility({ brailleDisplayReady: v })} aria-label={t("careerDash.settings.brailleReady")} />}
          />
          <SettingsRow
            icon={Mic}
            title={t("careerDash.settings.voiceNav")}
            desc={t("careerDash.settings.voiceNavDesc")}
            control={<Switch checked={accessibility.voiceNavigation} onCheckedChange={(v) => updateAccessibility({ voiceNavigation: v })} aria-label={t("careerDash.settings.voiceNav")} />}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">{t("careerDash.settings.keyboardAlwaysOn")}</p>
      </section>
    </div>
  );
}
