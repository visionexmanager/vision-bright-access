import { useState } from "react";
import { Sun, Moon, Eye, Type, Wand2, Volume2, Mic, BookOpen, Keyboard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  getKidsTextScale, setKidsTextScale, getKidsReduceMotion, setKidsReduceMotion,
} from "@/features/visionkids/utils/accessibilityPrefs";
import { useStemSettings, useUpsertStemSettings } from "@/features/visionkids/hooks/stem/useStemEngagement";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";
import type { KidsTextScale } from "@/features/visionkids/types/visionkids.types";

const TEXT_SCALES: KidsTextScale[] = ["normal", "large", "extra-large"];

/** STEM accessibility hub. Reuses the global VisionKids prefs (text scale,
 *  reduce motion, high-contrast theme) and adds STEM comfort toggles (audio
 *  descriptions, voice commands, simpler language) persisted per child. Also
 *  explains the screen-reader / keyboard support built into the whole app
 *  (NVDA, JAWS, VoiceOver, TalkBack, keyboard navigation). */
export default function StemAccessibility() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme, setTheme } = useThemeToggle();
  const [, force] = useState(0);
  const bump = () => force((v) => v + 1);

  const { data: settings } = useStemSettings();
  const saveSettings = useUpsertStemSettings();

  useDocumentHead({
    title: `${t("kids.stem.nav.accessibility")} — VisionKids`,
    description: t("kids.stem.accessibility.subtitle"),
    canonicalPath: "/kids/stem/accessibility",
  });

  const textScale = getKidsTextScale();
  const reduceMotion = getKidsReduceMotion();

  const audioDescriptions = settings?.audio_descriptions ?? false;
  const voiceCommands = settings?.voice_commands ?? false;
  const simpleLanguage = settings?.simple_language ?? false;

  const supportItems = [
    { icon: Eye, key: "screenReaders" },
    { icon: Keyboard, key: "keyboard" },
    { icon: Volume2, key: "audioDesc" },
    { icon: Mic, key: "voice" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <StemHeader emoji="♿" title={t("kids.stem.nav.accessibility")} subtitle={t("kids.stem.accessibility.subtitle")} />

      <div className="mt-6 flex flex-col gap-5">
        {/* Appearance */}
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

        {/* Text size */}
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

        {/* Comfort toggles */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Wand2 className="h-5 w-5 text-kids-purple" aria-hidden="true" /> {t("kids.stem.accessibility.comfort")}
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="stem-reduce-motion" className="text-sm font-medium">{t("kids.settings.reduceMotion")}</Label>
              <Switch id="stem-reduce-motion" checked={reduceMotion} onCheckedChange={(c) => { setKidsReduceMotion(c); bump(); }} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="stem-audio-desc" className="text-sm font-medium">{t("kids.stem.accessibility.audioDescriptions")}</Label>
              <Switch id="stem-audio-desc" checked={audioDescriptions} disabled={!user}
                onCheckedChange={(c) => saveSettings.mutate({ audio_descriptions: c })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="stem-voice" className="text-sm font-medium">{t("kids.stem.accessibility.voiceCommands")}</Label>
              <Switch id="stem-voice" checked={voiceCommands} disabled={!user}
                onCheckedChange={(c) => saveSettings.mutate({ voice_commands: c })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="stem-simple" className="text-sm font-medium">{t("kids.stem.accessibility.simpleLanguage")}</Label>
              <Switch id="stem-simple" checked={simpleLanguage} disabled={!user}
                onCheckedChange={(c) => saveSettings.mutate({ simple_language: c })} />
            </div>
          </div>
          {!user && <p className="mt-3 text-sm text-muted-foreground">{t("kids.stem.accessibility.signInHint")}</p>}
        </section>

        {/* Support info */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <BookOpen className="h-5 w-5 text-kids-green" aria-hidden="true" /> {t("kids.stem.accessibility.builtInTitle")}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {supportItems.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">{t(`kids.stem.accessibility.support.${key}.title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`kids.stem.accessibility.support.${key}.desc`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">{t("kids.stem.accessibility.footerNote")}</p>
    </div>
  );
}
