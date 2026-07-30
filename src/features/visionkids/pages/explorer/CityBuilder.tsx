import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Coins, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useAwardXp, useAwardCoins, useAwardAchievement } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useSimulatorSave, useSaveSimulatorState } from "@/features/visionkids/hooks/explorer/useSimulatorSave";
import type { BuildingType, CityBuilderState } from "@/features/visionkids/types/explorer.types";
import { AutoSaveIndicator } from "@/features/visionkids/components/studio/AutoSaveIndicator";

const GRID_SIZE = 8;

const BUILDINGS: { type: BuildingType; emoji: string; cost: number; happiness: number }[] = [
  { type: "road", emoji: "🛣️", cost: 10, happiness: 0 },
  { type: "house", emoji: "🏠", cost: 40, happiness: 2 },
  { type: "school", emoji: "🏫", cost: 80, happiness: 5 },
  { type: "hospital", emoji: "🏥", cost: 100, happiness: 5 },
  { type: "park", emoji: "🌳", cost: 30, happiness: 6 },
  { type: "power_plant", emoji: "⚡", cost: 90, happiness: -3 },
  { type: "water_tower", emoji: "💧", cost: 60, happiness: 1 },
];

function buildingInfo(type: BuildingType) {
  return BUILDINGS.find((b) => b.type === type)!;
}

function initialState(): CityBuilderState {
  return { gridSize: GRID_SIZE, grid: Array(GRID_SIZE * GRID_SIZE).fill(null), money: 500, happiness: 50 };
}

export default function CityBuilder() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: save, isLoading } = useSimulatorSave<CityBuilderState>("city_builder");
  const saveMutation = useSaveSimulatorState<CityBuilderState>("city_builder");
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();

  const [state, setState] = useState<CityBuilderState>(initialState());
  const [tool, setTool] = useState<BuildingType>("road");
  const hasAwardedRef = useRef(false);
  const loadedRef = useRef(false);

  useDocumentHead({ title: `${t("kids.explorer.tool.city_builder.title")} — VisionKids Explorer`, description: t("kids.explorer.meta.description"), canonicalPath: "/kids/explorer/city-builder" });

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

  const placeAt = (index: number) => {
    const existing = state.grid[index];
    if (existing) {
      const refund = Math.round(buildingInfo(existing).cost / 2);
      const nextGrid = [...state.grid];
      nextGrid[index] = null;
      setState((s) => ({ ...s, grid: nextGrid, money: s.money + refund, happiness: s.happiness - buildingInfo(existing).happiness }));
      return;
    }
    const info = buildingInfo(tool);
    if (state.money < info.cost) return;
    const nextGrid = [...state.grid];
    nextGrid[index] = tool;
    setState((s) => ({ ...s, grid: nextGrid, money: s.money - info.cost, happiness: Math.max(0, s.happiness + info.happiness) }));

    if (!hasAwardedRef.current) {
      hasAwardedRef.current = true;
      awardAchievement.mutate("city_planner");
      awardXp.mutate({ amount: 15, reason: "Simulator milestone: city_builder_first_building" });
      awardCoins.mutate({ amount: 10, reason: "Simulator milestone: city_builder_first_building" });
    }
  };

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/kids/explorer" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.homeTitle")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">🏙️ {t("kids.explorer.tool.city_builder.title")}</h1>
        {user && <AutoSaveIndicator saving={saveMutation.isPending} />}
      </div>
      <p className="mt-1 text-muted-foreground">{t("kids.explorer.cityBuilderSubtitle")}</p>

      <div className="mt-4 flex items-center gap-4 text-sm font-semibold">
        <span className="flex items-center gap-1 text-kids-secondary"><Coins className="h-4 w-4" aria-hidden="true" /> {state.money}</span>
        <span className="flex items-center gap-1 text-kids-pink"><Smile className="h-4 w-4" aria-hidden="true" /> {state.happiness}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {BUILDINGS.map((b) => (
          <button
            key={b.type}
            type="button"
            onClick={() => setTool(b.type)}
            className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tool === b.type ? "border-kids-primary bg-kids-primary/10" : "border-border hover:bg-muted"
            }`}
            aria-pressed={tool === b.type}
          >
            <span aria-hidden="true">{b.emoji}</span> {t(`kids.explorer.building.${b.type}`)} · {b.cost}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-0.5 rounded-2xl border-2 border-border bg-card p-2" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
        {state.grid.map((cell, i) => (
          <button
            key={i}
            type="button"
            onClick={() => placeAt(i)}
            className="flex aspect-square items-center justify-center rounded-md bg-muted text-lg hover:bg-kids-primary/10"
            aria-label={cell ? t(`kids.explorer.building.${cell}`) : t("kids.explorer.emptyLot")}
          >
            {cell ? BUILDINGS.find((b) => b.type === cell)?.emoji : ""}
          </button>
        ))}
      </div>

      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.explorer.signInToSave")}</p>}
    </div>
  );
}
