import { useState } from "react";
import { Sun, Moon, Eye, Type, Wand2, Volume2, Keyboard, Contrast } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  getKidsTextScale, setKidsTextScale, getKidsReduceMotion, setKidsReduceMotion,
} from "@/features/visionkids/utils/accessibilityPrefs";
import { MarketHeader } from "@/features/visionkids/components/market/MarketHeader";
import type { KidsTextScale } from "@/features/visionkids/types/visionkids.types";

const TEXT_SCALES: KidsTextScale[] = ["normal", "large", "extra-large"];

/** Marketplace accessibility hub. Reuses the global VisionKids prefs and
 *  documents the WCAG 2.2 AA commitment and assistive-tech support. */
export default function MarketAccessibility() {
  const { t } = useLanguage();
  const { theme, setTheme } = useThemeToggle();
  const [, force] = useState(0);
  const bump = () => force((v) => v + 1);

  useDocumentHead({
    title: `${t("kids.market.nav.accessibility")} — VisionKids`,
    description: t("kids.market.accessibility.subtitle"),
    canonicalPath: "/kids/market/accessibility",
  });

  const textScale = getKidsTextScale();
  const reduceMotion = getKidsReduceMotion();

  const supportItems = [
    { icon: Eye, key: "screenReaders" },
    { icon: Keyboard, key: "keyboard" },
    { icon: Volume2, key: "audioPreview" },
    { icon: Contrast, key: "highContrast" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <MarketHeader emoji="♿" title={t("kids.market.nav.accessibility")} subtitle={t("kids.market.accessibility.subtitle")} />

      <div className="mt-4 rounded-2xl border-2 border-kids-primary/30 bg-kids-primary/5 p-4">
        <p className="text-sm font-semibold">🏅 {t("kids.market.accessibility.wcag")}</p>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Sun className="h-5 w-5 text-kids-accent" aria-hidden="true" /> {t("kids.settings.appearance")}
          </h2>
          <div role="group" aria-label={t("kids.settings.appearance")} className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { value: "light", label: t("nav.lightMode"), icon: Sun },
                { value: "dark", label: t("nav.darkMode"), icon: Moon },
                { value: "high-contrast", label: t("nav.highContrastMode"), icon: Eye },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => setTheme(value)} aria-pressed={theme === value}
                className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${theme === value ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border text-foreground/80 hover:bg-muted"}`}>
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Type className="h-5 w-5 text-kids-secondary" aria-hidden="true" /> {t("kids.settings.textSize")}
          </h2>
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
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Wand2 className="h-5 w-5 text-kids-purple" aria-hidden="true" /> {t("kids.settings.motion")}
          </h2>
          <div className="mt-3 flex items-center justify-between gap-4">
            <Label htmlFor="market-reduce-motion" className="text-sm font-medium">{t("kids.settings.reduceMotion")}</Label>
            <Switch id="market-reduce-motion" checked={reduceMotion} onCheckedChange={(c) => { setKidsReduceMotion(c); bump(); }} />
          </div>
        </section>

        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">{t("kids.market.accessibility.builtInTitle")}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {supportItems.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">{t(`kids.market.accessibility.support.${key}.title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`kids.market.accessibility.support.${key}.desc`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">{t("kids.market.accessibility.footerNote")}</p>
    </div>
  );
}
