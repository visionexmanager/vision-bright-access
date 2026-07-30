import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Coins, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useAwardXp, useAwardCoins, useAwardAchievement } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useSimulatorSave, useSaveSimulatorState } from "@/features/visionkids/hooks/explorer/useSimulatorSave";
import type { CropType, FarmAnimal, FarmAnimalType, FarmPlot, FarmSimulatorState } from "@/features/visionkids/types/explorer.types";
import { AutoSaveIndicator } from "@/features/visionkids/components/studio/AutoSaveIndicator";

const PLOT_COUNT = 6;
const GROW_TIME_MS = 15000;

const CROPS: { type: CropType; emoji: string; cost: number; reward: number }[] = [
  { type: "wheat", emoji: "🌾", cost: 5, reward: 12 },
  { type: "carrot", emoji: "🥕", cost: 8, reward: 18 },
  { type: "tomato", emoji: "🍅", cost: 12, reward: 26 },
  { type: "corn", emoji: "🌽", cost: 10, reward: 22 },
];

const ANIMAL_TYPES: { type: FarmAnimalType; emoji: string; cost: number; reward: number }[] = [
  { type: "chicken", emoji: "🐔", cost: 20, reward: 5 },
  { type: "sheep", emoji: "🐑", cost: 40, reward: 8 },
  { type: "cow", emoji: "🐄", cost: 60, reward: 12 },
];

function cropInfo(type: CropType) {
  return CROPS.find((c) => c.type === type)!;
}
function animalInfo(type: FarmAnimalType) {
  return ANIMAL_TYPES.find((a) => a.type === type)!;
}

function initialState(): FarmSimulatorState {
  return { plots: Array.from({ length: PLOT_COUNT }, () => ({ crop: null, plantedAtMs: null, wateredAtMs: null })), animals: [], coins: 100, harvestCount: 0 };
}

export default function FarmSimulator() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: save, isLoading } = useSimulatorSave<FarmSimulatorState>("farm_simulator");
  const saveMutation = useSaveSimulatorState<FarmSimulatorState>("farm_simulator");
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();

  const [state, setState] = useState<FarmSimulatorState>(initialState());
  const [cropTool, setCropTool] = useState<CropType>("wheat");
  const [, forceTick] = useState(0);
  const loadedRef = useRef(false);

  useDocumentHead({ title: `${t("kids.explorer.tool.farm_simulator.title")} — VisionKids Explorer`, description: t("kids.explorer.meta.description"), canonicalPath: "/kids/explorer/farm-simulator" });

  useEffect(() => {
    if (!loadedRef.current && save?.state) {
      setState(save.state);
      loadedRef.current = true;
    }
  }, [save]);

  useEffect(() => {
    if (!user) return;
    const handle = window.setTimeout(() => saveMutation.mutate(state), 800);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, user?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const plant = (index: number) => {
    const info = cropInfo(cropTool);
    if (state.coins < info.cost || state.plots[index].crop) return;
    const nextPlots = [...state.plots];
    nextPlots[index] = { crop: cropTool, plantedAtMs: Date.now(), wateredAtMs: null };
    setState((s) => ({ ...s, plots: nextPlots, coins: s.coins - info.cost }));
  };

  const water = (index: number) => {
    const nextPlots = [...state.plots];
    nextPlots[index] = { ...nextPlots[index], wateredAtMs: Date.now() };
    setState((s) => ({ ...s, plots: nextPlots }));
  };

  const isReady = (plot: FarmPlot) =>
    !!plot.crop && !!plot.wateredAtMs && !!plot.plantedAtMs && Date.now() - plot.plantedAtMs >= GROW_TIME_MS;

  const harvest = (index: number) => {
    const plot = state.plots[index];
    if (!plot.crop || !isReady(plot)) return;
    const reward = cropInfo(plot.crop).reward;
    const nextPlots = [...state.plots];
    nextPlots[index] = { crop: null, plantedAtMs: null, wateredAtMs: null };
    setState((s) => ({ ...s, plots: nextPlots, coins: s.coins + reward, harvestCount: s.harvestCount + 1 }));

    if (state.harvestCount === 0) {
      awardAchievement.mutate("green_thumb");
      awardXp.mutate({ amount: 15, reason: "Simulator milestone: farm_first_harvest" });
      awardCoins.mutate({ amount: 10, reason: "Simulator milestone: farm_first_harvest" });
    }
  };

  const adopt = (type: FarmAnimalType) => {
    const info = animalInfo(type);
    if (state.coins < info.cost) return;
    const animal: FarmAnimal = { id: `${type}-${Date.now()}`, type, happiness: 100, lastFedAtMs: null };
    setState((s) => ({ ...s, animals: [...s.animals, animal], coins: s.coins - info.cost }));
  };

  const feed = (id: string) => {
    const animal = state.animals.find((a) => a.id === id);
    if (!animal) return;
    const canCollect = !animal.lastFedAtMs || Date.now() - animal.lastFedAtMs >= 8000;
    if (!canCollect) return;
    const reward = animalInfo(animal.type).reward;
    setState((s) => ({
      ...s,
      coins: s.coins + reward,
      animals: s.animals.map((a) => (a.id === id ? { ...a, happiness: 100, lastFedAtMs: Date.now() } : a)),
    }));
  };

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/kids/explorer" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.homeTitle")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">🚜 {t("kids.explorer.tool.farm_simulator.title")}</h1>
        {user && <AutoSaveIndicator saving={saveMutation.isPending} />}
      </div>
      <p className="mt-1 text-muted-foreground">{t("kids.explorer.farmSimulatorSubtitle")}</p>

      <div className="mt-4 flex items-center gap-4 text-sm font-semibold">
        <span className="flex items-center gap-1 text-kids-secondary"><Coins className="h-4 w-4" aria-hidden="true" /> {state.coins}</span>
      </div>

      <h2 className="mt-6 font-heading text-sm font-bold">{t("kids.explorer.chooseCrop")}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {CROPS.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => setCropTool(c.type)}
            className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
              cropTool === c.type ? "border-kids-primary bg-kids-primary/10" : "border-border hover:bg-muted"
            }`}
            aria-pressed={cropTool === c.type}
          >
            <span aria-hidden="true">{c.emoji}</span> {t(`kids.explorer.crop.${c.type}`)} · {c.cost}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {state.plots.map((plot, i) => {
          const ready = isReady(plot);
          return (
            <div key={i} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card p-4 text-center">
              <span className="text-3xl" aria-hidden="true">{plot.crop ? cropInfo(plot.crop).emoji : "🟫"}</span>
              {!plot.crop && <Button size="sm" variant="outline" onClick={() => plant(i)}>{t("kids.explorer.plant")}</Button>}
              {plot.crop && !plot.wateredAtMs && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => water(i)}>
                  <Droplets className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.explorer.water")}
                </Button>
              )}
              {plot.crop && plot.wateredAtMs && !ready && <p className="text-xs text-muted-foreground">{t("kids.explorer.growing")}</p>}
              {plot.crop && ready && (
                <Button size="sm" className="bg-kids-green text-white hover:bg-kids-green/90" onClick={() => harvest(i)}>
                  {t("kids.explorer.harvest")}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mt-6 font-heading text-sm font-bold">{t("kids.explorer.animals")}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {ANIMAL_TYPES.map((a) => (
          <Button key={a.type} size="sm" variant="outline" onClick={() => adopt(a.type)} className="gap-1.5">
            <span aria-hidden="true">{a.emoji}</span> {t(`kids.explorer.animalType.${a.type}`)} · {a.cost}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {state.animals.map((animal) => (
          <button
            key={animal.id}
            type="button"
            onClick={() => feed(animal.id)}
            className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card p-3 text-center hover:bg-muted"
          >
            <span className="text-2xl" aria-hidden="true">{animalInfo(animal.type).emoji}</span>
            <span className="text-xs text-muted-foreground">{t("kids.explorer.feed")}</span>
          </button>
        ))}
      </div>

      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.explorer.signInToSave")}</p>}
    </div>
  );
}
