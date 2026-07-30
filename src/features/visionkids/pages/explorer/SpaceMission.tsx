import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Fuel, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useLocationsByWorld } from "@/features/visionkids/hooks/explorer/useExplorerWorlds";
import { useAwardXp, useAwardCoins, useAwardAchievement } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useSimulatorSave, useSaveSimulatorState } from "@/features/visionkids/hooks/explorer/useSimulatorSave";
import type { SpaceMissionState } from "@/features/visionkids/types/explorer.types";
import { AutoSaveIndicator } from "@/features/visionkids/components/studio/AutoSaveIndicator";

const MAX_FUEL = 100;
const TRAVEL_COST = 15;
const SAMPLE_COST = 10;

function initialState(): SpaceMissionState {
  return { visitedPlanetSlugs: [], samplesCollected: [], fuel: MAX_FUEL, missionsCompleted: 0 };
}

export default function SpaceMission() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: planets = [], isLoading: planetsLoading } = useLocationsByWorld("planet-explorer");
  const { data: save, isLoading } = useSimulatorSave<SpaceMissionState>("space_mission");
  const saveMutation = useSaveSimulatorState<SpaceMissionState>("space_mission");
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();

  const [state, setState] = useState<SpaceMissionState>(initialState());
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useDocumentHead({ title: `${t("kids.explorer.tool.space_mission.title")} — VisionKids Explorer`, description: t("kids.explorer.meta.description"), canonicalPath: "/kids/explorer/space-mission" });

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

  const current = planets.find((p) => p.slug === currentSlug) ?? null;
  const allSampled = planets.length > 0 && planets.every((p) => state.samplesCollected.includes(p.slug));

  const travelTo = (slug: string) => {
    if (state.fuel < TRAVEL_COST) return;
    setCurrentSlug(slug);
    setState((s) => ({
      ...s,
      fuel: s.fuel - TRAVEL_COST,
      visitedPlanetSlugs: s.visitedPlanetSlugs.includes(slug) ? s.visitedPlanetSlugs : [...s.visitedPlanetSlugs, slug],
    }));
  };

  const collectSample = () => {
    if (!current || state.fuel < SAMPLE_COST || state.samplesCollected.includes(current.slug)) return;
    setState((s) => ({ ...s, fuel: s.fuel - SAMPLE_COST, samplesCollected: [...s.samplesCollected, current.slug] }));

    if (state.samplesCollected.length === 0) {
      awardAchievement.mutate("space_cadet");
      awardXp.mutate({ amount: 15, reason: "Simulator milestone: space_first_sample" });
      awardCoins.mutate({ amount: 10, reason: "Simulator milestone: space_first_sample" });
    }
  };

  const refuel = () => setState((s) => ({ ...s, fuel: MAX_FUEL }));

  const completeMission = () => {
    setState((s) => ({ ...s, missionsCompleted: s.missionsCompleted + 1, samplesCollected: [] }));
    awardXp.mutate({ amount: 30, reason: "Simulator milestone: space_mission_complete" });
    awardCoins.mutate({ amount: 15, reason: "Simulator milestone: space_mission_complete" });
  };

  if (isLoading || planetsLoading) return <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/kids/explorer" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.homeTitle")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">🚀 {t("kids.explorer.tool.space_mission.title")}</h1>
        {user && <AutoSaveIndicator saving={saveMutation.isPending} />}
      </div>
      <p className="mt-1 text-muted-foreground">{t("kids.explorer.spaceMissionSubtitle")}</p>

      <div className="mt-4 flex items-center gap-3">
        <Fuel className="h-4 w-4 text-kids-accent" aria-hidden="true" />
        <Progress value={state.fuel} className="max-w-xs flex-1" aria-label={`${state.fuel} / ${MAX_FUEL}`} />
        <span className="text-sm font-semibold">{state.fuel}/{MAX_FUEL}</span>
        <Button size="sm" variant="outline" onClick={refuel}>{t("kids.explorer.refuel")}</Button>
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <PackageCheck className="h-4 w-4" aria-hidden="true" /> {state.samplesCollected.length} / {planets.length} {t("kids.explorer.samplesCollected")}
        {state.missionsCompleted > 0 && <span>· {state.missionsCompleted} {t("kids.explorer.missionsCompleted")}</span>}
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {planets.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => travelTo(p.slug)}
            disabled={state.fuel < TRAVEL_COST}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center transition-colors disabled:opacity-40 ${
              currentSlug === p.slug ? "border-kids-primary bg-kids-primary/10" : "border-border hover:bg-muted"
            }`}
          >
            <span className="text-2xl" aria-hidden="true">{p.emoji}</span>
            <span className="text-xs font-semibold">{p.name}</span>
            {state.samplesCollected.includes(p.slug) && <span aria-hidden="true">✅</span>}
          </button>
        ))}
      </div>

      {current && (
        <div className="mt-6 rounded-2xl border-2 border-border bg-card p-4">
          <p className="font-heading text-lg font-bold">{current.emoji} {current.name}</p>
          {current.summary && <p className="mt-1 text-sm text-muted-foreground">{current.summary}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-kids-accent text-white hover:bg-kids-accent/90"
              onClick={collectSample}
              disabled={state.fuel < SAMPLE_COST || state.samplesCollected.includes(current.slug)}
            >
              {state.samplesCollected.includes(current.slug) ? t("kids.explorer.sampleCollected") : t("kids.explorer.collectSample")}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to={`/kids/explorer/world/planet-explorer/${current.slug}`}>{t("kids.explorer.learnMore")}</Link>
            </Button>
          </div>
        </div>
      )}

      {allSampled && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border-2 border-kids-green/40 bg-kids-green/10 p-6 text-center">
          <p className="font-heading font-bold text-kids-green">{t("kids.explorer.allSamplesCollected")}</p>
          <Button className="bg-kids-green text-white hover:bg-kids-green/90" onClick={completeMission}>{t("kids.explorer.completeMission")}</Button>
        </div>
      )}

      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.explorer.signInToSave")}</p>}
    </div>
  );
}
