import { useState, type ReactNode } from "react";
import { Building2, Palette, Sparkles, Bell, Eye, Type, Zap, Table2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEmployerDashboard } from "@/contexts/EmployerDashboardContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MOCK_COMPANY_PROFILE } from "../mock/mockCompany";
import type { CompanyProfile } from "../types";

function SettingsRow({ icon: Icon, title, desc, control }: { icon: typeof Building2; title: string; desc: string; control: ReactNode }) {
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
  const { t } = useLanguage();
  const { accessibility, updateAccessibility } = useEmployerDashboard();
  const [profile, setProfile] = useState<CompanyProfile>(MOCK_COMPANY_PROFILE);
  const [aiScreeningEnabled, setAiScreeningEnabled] = useState(true);
  const [aiBiasDetection, setAiBiasDetection] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [applicationAlerts, setApplicationAlerts] = useState(true);

  const updateProfile = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => setProfile((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("employerDash.nav.settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("employerDash.settings.subtitle")}</p>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-6" aria-labelledby="emp-settings-company">
        <h2 id="emp-settings-company" className="mb-4 flex items-center gap-2 font-bold"><Building2 className="h-4 w-4 text-primary" aria-hidden="true" />{t("employerDash.settings.companyProfile")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cp-name" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.settings.companyName")}</Label>
            <Input id="cp-name" value={profile.name} onChange={(e) => updateProfile("name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cp-industry" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.settings.industry")}</Label>
            <Input id="cp-industry" value={profile.industry} onChange={(e) => updateProfile("industry", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cp-size" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.settings.companySize")}</Label>
            <Input id="cp-size" value={profile.size} onChange={(e) => updateProfile("size", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cp-website" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.settings.website")}</Label>
            <Input id="cp-website" value={profile.website} onChange={(e) => updateProfile("website", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cp-desc" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.settings.description")}</Label>
            <Textarea id="cp-desc" rows={3} value={profile.description} onChange={(e) => updateProfile("description", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6" aria-labelledby="emp-settings-branding">
        <h2 id="emp-settings-branding" className="mb-4 flex items-center gap-2 font-bold"><Palette className="h-4 w-4 text-primary" aria-hidden="true" />{t("employerDash.settings.branding")}</h2>
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ backgroundColor: profile.logoColor }} aria-hidden="true">
            {profile.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("employerDash.settings.brandColor")}>
            {["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#a855f7"].map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateProfile("logoColor", color)}
                aria-label={color}
                aria-pressed={profile.logoColor === color}
                className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-all ${profile.logoColor === color ? "ring-2 ring-primary" : ""}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6" aria-labelledby="emp-settings-ai">
        <h2 id="emp-settings-ai" className="mb-1 flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />{t("employerDash.settings.aiSettings")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("employerDash.settings.aiSettingsDesc")}</p>
        <div className="divide-y divide-border/60">
          <SettingsRow icon={Sparkles} title={t("employerDash.settings.aiScreening")} desc={t("employerDash.settings.aiScreeningDesc")} control={<Switch checked={aiScreeningEnabled} onCheckedChange={setAiScreeningEnabled} aria-label={t("employerDash.settings.aiScreening")} />} />
          <SettingsRow icon={Sparkles} title={t("employerDash.settings.biasDetection")} desc={t("employerDash.settings.biasDetectionDesc")} control={<Switch checked={aiBiasDetection} onCheckedChange={setAiBiasDetection} aria-label={t("employerDash.settings.biasDetection")} />} />
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6" aria-labelledby="emp-settings-a11y">
        <h2 id="emp-settings-a11y" className="mb-1 flex items-center gap-2 font-bold">{t("employerDash.settings.accessibility")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("employerDash.settings.accessibilityDesc")}</p>
        <div className="divide-y divide-border/60">
          <SettingsRow icon={Eye} title={t("careerDash.settings.highContrast")} desc={t("careerDash.settings.highContrastDesc")} control={<Switch checked={accessibility.highContrast} onCheckedChange={(v) => updateAccessibility({ highContrast: v })} aria-label={t("careerDash.settings.highContrast")} />} />
          <SettingsRow icon={Type} title={t("careerDash.settings.largeText")} desc={t("careerDash.settings.largeTextDesc")} control={<Switch checked={accessibility.largeText} onCheckedChange={(v) => updateAccessibility({ largeText: v })} aria-label={t("careerDash.settings.largeText")} />} />
          <SettingsRow icon={Zap} title={t("careerDash.settings.reducedMotion")} desc={t("careerDash.settings.reducedMotionDesc")} control={<Switch checked={accessibility.reducedMotion} onCheckedChange={(v) => updateAccessibility({ reducedMotion: v })} aria-label={t("careerDash.settings.reducedMotion")} />} />
          <SettingsRow icon={Table2} title={t("employerDash.settings.a11yTables")} desc={t("employerDash.settings.a11yTablesDesc")} control={<Switch checked={accessibility.screenReaderOptimizedTables} onCheckedChange={(v) => updateAccessibility({ screenReaderOptimizedTables: v })} aria-label={t("employerDash.settings.a11yTables")} />} />
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6" aria-labelledby="emp-settings-notifications">
        <h2 id="emp-settings-notifications" className="mb-1 flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-primary" aria-hidden="true" />{t("employerDash.settings.notifications")}</h2>
        <div className="divide-y divide-border/60">
          <SettingsRow icon={Bell} title={t("careerDash.settings.emailNotifications")} desc={t("careerDash.settings.emailNotificationsDesc")} control={<Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} aria-label={t("careerDash.settings.emailNotifications")} />} />
          <SettingsRow icon={Bell} title={t("employerDash.settings.applicationAlerts")} desc={t("employerDash.settings.applicationAlertsDesc")} control={<Switch checked={applicationAlerts} onCheckedChange={setApplicationAlerts} aria-label={t("employerDash.settings.applicationAlerts")} />} />
        </div>
      </section>
    </div>
  );
}
