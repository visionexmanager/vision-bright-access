import { useState } from "react";
import { Sun, Moon, Eye, Type, Wand2, Volume2, Mic, Keyboard, Navigation } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import {
  getKidsTextScale, setKidsTextScale, getKidsReduceMotion, setKidsReduceMotion,
} from "@/features/visionkids/utils/accessibilityPrefs";
import { useWorldSettings, useUpsertWorldSettings } from "@/features/visionkids/hooks/world/useWorldProgress";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";
import type { KidsTextScale } from "@/features/visionkids/types/visionkids.types";

const TEXT_SCALES: KidsTextScale[] = ["normal", "large", "extra-large"];

/** VisionKids World accessibility hub: reuses the global prefs (text scale,
 *  reduce motion, high-contrast theme), adds world toggles (audio navigation,
 *  voice commands) persisted per child, and documents the screen-reader /
 *  keyboard support built into the whole app. */
export default function WorldAccessibility() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme, setTheme } = useThemeToggle();
  const [, force] = useState(0);
  const bump = () => force((v) => v + 1);

  const { data: settings } = useWorldSettings();
  const save = useUpsertWorldSettings();

  useDocumentHead({
    title: `${t("kids.world.nav.accessibility")} — VisionKids`,
    description: t("kids.world.accessibility.subtitle"),
    canonicalPath: "/kids/world/accessibility",
  });

  const textScale = getKidsTextScale();
  const reduceMotion = getKidsReduceMotion();
  const audioNav = settings?.audio_navigation ?? false;
  const voice = settings?.voice_commands ?? false;

  const supportItems = [
    { icon: Eye, key: "screenReaders" },
    { icon: Navigation, key: "audioNav" },
    { icon: Mic, key: "voice" },
    { icon: Keyboard, key: "keyboard" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <WorldHeader emoji="♿" title={t("kids.world.nav.accessibility")} subtitle={t("kids.world.accessibility.subtitle")} />

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

        {/* Comfort + world toggles */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Wand2 className="h-5 w-5 text-kids-purple" aria-hidden="true" /> {t("kids.world.accessibility.comfort")}
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="world-reduce-motion" className="text-sm font-medium">{t("kids.settings.reduceMotion")}</Label>
              <Switch id="world-reduce-motion" checked={reduceMotion} onCheckedChange={(c) => { setKidsReduceMotion(c); bump(); }} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="world-audio-nav" className="flex items-center gap-1.5 text-sm font-medium"><Volume2 className="h-4 w-4" aria-hidden="true" /> {t("kids.world.accessibility.audioNavigation")}</Label>
              <Switch id="world-audio-nav" checked={audioNav} disabled={!user} onCheckedChange={(c) => save.mutate({ audio_navigation: c })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="world-voice" className="flex items-center gap-1.5 text-sm font-medium"><Mic className="h-4 w-4" aria-hidden="true" /> {t("kids.world.accessibility.voiceCommands")}</Label>
              <Switch id="world-voice" checked={voice} disabled={!user} onCheckedChange={(c) => save.mutate({ voice_commands: c })} />
            </div>
          </div>
          {!user && <p className="mt-3 text-sm text-muted-foreground">{t("kids.world.accessibility.signInHint")}</p>}
        </section>

        {/* Built-in support */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">{t("kids.world.accessibility.builtInTitle")}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {supportItems.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kids-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">{t(`kids.world.accessibility.support.${key}.title`)}</p>
                  <p className="text-sm text-muted-foreground">{t(`kids.world.accessibility.support.${key}.desc`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">{t("kids.world.accessibility.footerNote")}</p>
    </div>
  );
}
