import { useState } from "react";
import { Sun, Moon, Eye, Type, Wand2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  getKidsTextScale, setKidsTextScale, getKidsReduceMotion, setKidsReduceMotion,
} from "@/features/visionkids/utils/accessibilityPrefs";
import { EconomyHeader } from "@/features/visionkids/components/economy/EconomyShell";
import type { KidsTextScale } from "@/features/visionkids/types/visionkids.types";

const TEXT_SCALES: KidsTextScale[] = ["normal", "large", "extra-large"];

export default function EconomyAccessibility() {
  const { t } = useLanguage();
  const { theme, setTheme } = useThemeToggle();
  const [, force] = useState(0);
  const bump = () => force((v) => v + 1);

  useDocumentHead({ title: `${t("kids.economy.nav.accessibility")} — VisionKids`, description: t("kids.economy.accessibility.subtitle"), canonicalPath: "/kids/economy/accessibility" });

  const textScale = getKidsTextScale();
  const reduceMotion = getKidsReduceMotion();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <EconomyHeader emoji="♿" title={t("kids.economy.nav.accessibility")} subtitle={t("kids.economy.accessibility.subtitle")} />
      <div className="mt-4 rounded-2xl border-2 border-kids-primary/30 bg-kids-primary/5 p-4"><p className="text-sm font-semibold">🏅 {t("kids.economy.accessibility.wcag")}</p></div>
      <div className="mt-5 flex flex-col gap-5">
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold"><Sun className="h-5 w-5 text-kids-accent" aria-hidden="true" /> {t("kids.settings.appearance")}</h2>
          <div role="group" aria-label={t("kids.settings.appearance")} className="mt-3 flex flex-wrap gap-2">
            {([
              { value: "light", label: t("nav.lightMode"), icon: Sun },
              { value: "dark", label: t("nav.darkMode"), icon: Moon },
              { value: "high-contrast", label: t("nav.highContrastMode"), icon: Eye },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => setTheme(value)} aria-pressed={theme === value}
                className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${theme === value ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border text-foreground/80 hover:bg-muted"}`}>
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold"><Type className="h-5 w-5 text-kids-secondary" aria-hidden="true" /> {t("kids.settings.textSize")}</h2>
          <div role="group" aria-label={t("kids.settings.textSize")} className="mt-3 flex flex-wrap gap-2">
            {TEXT_SCALES.map((scale) => (
              <button key={scale} type="button" onClick={() => { setKidsTextScale(scale); bump(); }} aria-pressed={textScale === scale}
                className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${textScale === scale ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border text-foreground/80 hover:bg-muted"}`}>
                {t(`kids.settings.textScale.${scale}`)}
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold"><Wand2 className="h-5 w-5 text-kids-purple" aria-hidden="true" /> {t("kids.settings.motion")}</h2>
          <div className="mt-3 flex items-center justify-between gap-4">
            <Label htmlFor="econ-reduce-motion" className="text-sm font-medium">{t("kids.settings.reduceMotion")}</Label>
            <Switch id="econ-reduce-motion" checked={reduceMotion} onCheckedChange={(c) => { setKidsReduceMotion(c); bump(); }} />
          </div>
        </section>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">{t("kids.economy.accessibility.footerNote")}</p>
    </div>
  );
}
