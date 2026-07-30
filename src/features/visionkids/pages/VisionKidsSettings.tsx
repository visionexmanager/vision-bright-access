import { useState } from "react";
import { Moon, Sun, Eye, Type, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  getKidsTextScale,
  setKidsTextScale,
  getKidsReduceMotion,
  setKidsReduceMotion,
} from "@/features/visionkids/utils/accessibilityPrefs";
import type { KidsTextScale } from "@/features/visionkids/types/visionkids.types";

const TEXT_SCALES: KidsTextScale[] = ["normal", "large", "extra-large"];

export default function VisionKidsSettings() {
  const { t } = useLanguage();
  const { theme, setTheme } = useThemeToggle();
  const [, forceRerender] = useState(0);

  useDocumentHead({ title: `${t("kids.nav.settings")} — VisionKids`, description: t("kids.settings.subtitle"), canonicalPath: "/kids/settings" });

  const textScale = getKidsTextScale();
  const reduceMotion = getKidsReduceMotion();
  const bump = () => forceRerender((v) => v + 1);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="font-heading text-3xl font-extrabold">{t("kids.nav.settings")}</h1>
      <p className="mt-1 text-muted-foreground">{t("kids.settings.subtitle")}</p>

      <div className="mt-8 flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sun className="h-5 w-5 text-kids-accent" aria-hidden="true" />
              {t("kids.settings.appearance")}
            </CardTitle>
            <CardDescription>{t("kids.settings.appearanceDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div role="group" aria-label={t("kids.settings.appearance")} className="flex flex-wrap gap-2">
              {(
                [
                  { value: "light", label: t("nav.lightMode"), icon: Sun },
                  { value: "dark", label: t("nav.darkMode"), icon: Moon },
                  { value: "high-contrast", label: t("nav.highContrastMode"), icon: Eye },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    theme === value
                      ? "border-kids-primary bg-kids-primary/10 text-kids-primary"
                      : "border-border text-foreground/80 hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Type className="h-5 w-5 text-kids-secondary" aria-hidden="true" />
              {t("kids.settings.textSize")}
            </CardTitle>
            <CardDescription>{t("kids.settings.textSizeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div role="group" aria-label={t("kids.settings.textSize")} className="flex flex-wrap gap-2">
              {TEXT_SCALES.map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => { setKidsTextScale(scale); bump(); }}
                  aria-pressed={textScale === scale}
                  className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    textScale === scale
                      ? "border-kids-primary bg-kids-primary/10 text-kids-primary"
                      : "border-border text-foreground/80 hover:bg-muted"
                  }`}
                >
                  {t(`kids.settings.textScale.${scale}`)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wand2 className="h-5 w-5 text-kids-purple" aria-hidden="true" />
              {t("kids.settings.motion")}
            </CardTitle>
            <CardDescription>{t("kids.settings.motionDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="kids-reduce-motion" className="text-sm font-medium">
                {t("kids.settings.reduceMotion")}
              </Label>
              <Switch
                id="kids-reduce-motion"
                checked={reduceMotion}
                onCheckedChange={(checked) => { setKidsReduceMotion(checked); bump(); }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("kids.settings.language")}</CardTitle>
            <CardDescription>{t("kids.settings.languageDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher />
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />
      <p className="text-center text-sm text-muted-foreground">{t("kids.settings.footerNote")}</p>
    </div>
  );
}
