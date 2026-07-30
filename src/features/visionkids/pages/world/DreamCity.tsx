import { useEffect, useState } from "react";
import { Save, Eraser } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useHome, useSaveHome } from "@/features/visionkids/hooks/world/useWorldProgress";
import { WorldHeader } from "@/features/visionkids/components/world/WorldHeader";
import { WorldRewardBanner } from "@/features/visionkids/components/world/WorldRewardBanner";

const GRID = 6;

/** Building palette — labelKey drives the i18n name; emoji is the tile. */
const BUILDINGS = [
  { slug: "road", emoji: "🛣️" },
  { slug: "school", emoji: "🏫" },
  { slug: "park", emoji: "🌳" },
  { slug: "library", emoji: "📚" },
  { slug: "lab", emoji: "🧪" },
  { slug: "sports", emoji: "🏟️" },
  { slug: "museum", emoji: "🏛️" },
  { slug: "spaceport", emoji: "🚀" },
  { slug: "house", emoji: "🏠" },
] as const;

const EMOJI_BY_SLUG: Record<string, string> = Object.fromEntries(BUILDINGS.map((b) => [b.slug, b.emoji]));

export default function DreamCity() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: home } = useHome();
  const save = useSaveHome();

  const [selected, setSelected] = useState<string>("road");
  const [erase, setErase] = useState(false);
  const [cells, setCells] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const city = (home?.rooms as { city?: { cells?: Record<number, string> } })?.city;
    if (city?.cells) setCells(city.cells);
  }, [home]);

  useDocumentHead({
    title: `${t("kids.world.region.dream-city.title")} — VisionKids`,
    description: t("kids.world.dreamCity.subtitle"),
    canonicalPath: "/kids/world/dream-city",
  });

  function place(idx: number) {
    setCells((prev) => {
      const next = { ...prev };
      if (erase) delete next[idx];
      else next[idx] = selected;
      return next;
    });
  }

  async function onSave() {
    if (!user) return;
    const rooms = { ...(home?.rooms ?? {}), city: { cells } };
    try {
      await save.mutateAsync({ name: home?.name ?? "My Home", theme: home?.theme ?? "modern", rooms });
      setSaved(true);
      setTimeout(() => setSaved(false), 2800);
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <WorldHeader emoji="🏙️" title={t("kids.world.region.dream-city.title")} subtitle={t("kids.world.dreamCity.subtitle")} />
      <WorldRewardBanner show={saved} message={t("kids.world.dreamCity.savedMsg")} />

      <p className="mt-4 text-sm text-muted-foreground">{t("kids.world.dreamCity.hint")}</p>

      {/* Palette */}
      <div className="mt-4 flex flex-wrap gap-2">
        {BUILDINGS.map((b) => (
          <button key={b.slug} type="button" onClick={() => { setSelected(b.slug); setErase(false); }}
            aria-pressed={!erase && selected === b.slug}
            className={`inline-flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${!erase && selected === b.slug ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"}`}>
            <span aria-hidden="true">{b.emoji}</span> {t(`kids.world.building.${b.slug}`)}
          </button>
        ))}
        <button type="button" onClick={() => setErase((e) => !e)} aria-pressed={erase}
          className={`inline-flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${erase ? "border-kids-pink bg-kids-pink/10 text-kids-pink" : "border-border hover:border-kids-pink/50"}`}>
          <Eraser className="h-4 w-4" aria-hidden="true" /> {t("kids.world.dreamCity.erase")}
        </button>
      </div>

      {/* Grid */}
      <div className="mt-4 grid gap-1 rounded-2xl border-2 border-border bg-kids-green/5 p-2"
        style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }} role="group" aria-label={t("kids.world.dreamCity.gridLabel")}>
        {Array.from({ length: GRID * GRID }).map((_, idx) => (
          <button key={idx} type="button" onClick={() => place(idx)}
            className="grid aspect-square place-items-center rounded-md border border-border/60 bg-card text-2xl transition-colors hover:bg-kids-primary/5"
            aria-label={cells[idx] ? t(`kids.world.building.${cells[idx]}`) : t("kids.world.dreamCity.emptyPlot")}>
            <span aria-hidden="true">{cells[idx] ? EMOJI_BY_SLUG[cells[idx]] : ""}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {user ? (
          <button type="button" onClick={onSave} disabled={save.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-6 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50">
            <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.world.dreamCity.save")}
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">{t("kids.world.signInHint")}</p>
        )}
      </div>
    </div>
  );
}
