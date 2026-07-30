import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useWorldSettings, useUpsertWorldSettings } from "@/features/visionkids/hooks/world/useWorldProgress";
import { WEATHER_OPTIONS, WEATHER_BACKDROP } from "@/features/visionkids/data/worldConfig";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";
import type { WeatherKind } from "@/features/visionkids/types/world.types";

function resolve(pref: WeatherKind): keyof typeof WEATHER_BACKDROP {
  if (pref === "auto") {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 6 ? "night" : "day";
  }
  return pref;
}

export default function WeatherCenter() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: settings } = useWorldSettings();
  const save = useUpsertWorldSettings();

  useDocumentHead({
    title: `${t("kids.world.nav.weather")} — VisionKids`,
    description: t("kids.world.weather.subtitle"),
    canonicalPath: "/kids/world/weather",
  });

  const current: WeatherKind = settings?.weather ?? "auto";
  const backdrop = WEATHER_BACKDROP[resolve(current)];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <WorldHeader emoji="⛅" title={t("kids.world.nav.weather")} subtitle={t("kids.world.weather.subtitle")} />

      {/* Preview */}
      <div className={`relative mt-6 grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-3xl border-2 border-border bg-gradient-to-b ${backdrop.gradient}`}>
        <span className="text-6xl" aria-hidden="true">{backdrop.overlay || "🏙️"}</span>
      </div>

      {/* Options */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {WEATHER_OPTIONS.map((w) => (
          <button
            key={w.slug}
            type="button"
            disabled={!user || save.isPending}
            onClick={() => save.mutate({ weather: w.slug })}
            aria-pressed={current === w.slug}
            className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition-transform hover:scale-105 disabled:opacity-50 ${current === w.slug ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border"}`}
          >
            <span className="text-2xl" aria-hidden="true">{w.emoji}</span>
            <span className="text-xs font-semibold">{t(`kids.world.weather.${w.slug}`)}</span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">🔄 {t("kids.world.weather.autoNote")}</p>
      {!user && <p className="mt-2 text-sm text-muted-foreground">{t("kids.world.signInHint")}</p>}
    </div>
  );
}
