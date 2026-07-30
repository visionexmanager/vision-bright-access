import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Leaf, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn } from "@/features/visionkids/utils/animations";
import { useAwardXp, useAwardCoins, useAwardAchievement } from "@/features/visionkids/hooks/games/useGameEngagement";
import { useSimulatorSave, useSaveSimulatorState } from "@/features/visionkids/hooks/explorer/useSimulatorSave";
import type { EcoWorldState } from "@/features/visionkids/types/explorer.types";

interface EcoChoice {
  id: string;
  labelKey: string;
  correct: boolean;
  explanationKey: string;
}

interface EcoScenario {
  id: string;
  emoji: string;
  promptKey: string;
  choices: EcoChoice[];
}

const SCENARIOS: EcoScenario[] = [
  { id: "bottle", emoji: "🧴", promptKey: "kids.explorer.eco.bottle.prompt", choices: [
    { id: "recycle", labelKey: "kids.explorer.eco.bottle.recycle", correct: true, explanationKey: "kids.explorer.eco.bottle.explain" },
    { id: "trash", labelKey: "kids.explorer.eco.bottle.trash", correct: false, explanationKey: "kids.explorer.eco.bottle.explainWrong" },
  ]},
  { id: "tap", emoji: "🚰", promptKey: "kids.explorer.eco.tap.prompt", choices: [
    { id: "close", labelKey: "kids.explorer.eco.tap.close", correct: true, explanationKey: "kids.explorer.eco.tap.explain" },
    { id: "leave", labelKey: "kids.explorer.eco.tap.leave", correct: false, explanationKey: "kids.explorer.eco.tap.explainWrong" },
  ]},
  { id: "lights", emoji: "💡", promptKey: "kids.explorer.eco.lights.prompt", choices: [
    { id: "off", labelKey: "kids.explorer.eco.lights.off", correct: true, explanationKey: "kids.explorer.eco.lights.explain" },
    { id: "on", labelKey: "kids.explorer.eco.lights.on", correct: false, explanationKey: "kids.explorer.eco.lights.explainWrong" },
  ]},
  { id: "ride", emoji: "🚲", promptKey: "kids.explorer.eco.ride.prompt", choices: [
    { id: "bike", labelKey: "kids.explorer.eco.ride.bike", correct: true, explanationKey: "kids.explorer.eco.ride.explain" },
    { id: "car", labelKey: "kids.explorer.eco.ride.car", correct: false, explanationKey: "kids.explorer.eco.ride.explainWrong" },
  ]},
  { id: "tree", emoji: "🌳", promptKey: "kids.explorer.eco.tree.prompt", choices: [
    { id: "plant", labelKey: "kids.explorer.eco.tree.plant", correct: true, explanationKey: "kids.explorer.eco.tree.explain" },
    { id: "cut", labelKey: "kids.explorer.eco.tree.cut", correct: false, explanationKey: "kids.explorer.eco.tree.explainWrong" },
  ]},
  { id: "bag", emoji: "🛍️", promptKey: "kids.explorer.eco.bag.prompt", choices: [
    { id: "reusable", labelKey: "kids.explorer.eco.bag.reusable", correct: true, explanationKey: "kids.explorer.eco.bag.explain" },
    { id: "plastic", labelKey: "kids.explorer.eco.bag.plastic", correct: false, explanationKey: "kids.explorer.eco.bag.explainWrong" },
  ]},
  { id: "animal", emoji: "🦉", promptKey: "kids.explorer.eco.animal.prompt", choices: [
    { id: "protect", labelKey: "kids.explorer.eco.animal.protect", correct: true, explanationKey: "kids.explorer.eco.animal.explain" },
    { id: "ignore", labelKey: "kids.explorer.eco.animal.ignore", correct: false, explanationKey: "kids.explorer.eco.animal.explainWrong" },
  ]},
  { id: "solar", emoji: "☀️", promptKey: "kids.explorer.eco.solar.prompt", choices: [
    { id: "clean", labelKey: "kids.explorer.eco.solar.clean", correct: true, explanationKey: "kids.explorer.eco.solar.explain" },
    { id: "coal", labelKey: "kids.explorer.eco.solar.coal", correct: false, explanationKey: "kids.explorer.eco.solar.explainWrong" },
  ]},
];

function initialState(): EcoWorldState {
  return { scenarioIndex: 0, ecoScore: 0, choicesMade: [] };
}

export default function EcoWorld() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();
  const { data: save, isLoading } = useSimulatorSave<EcoWorldState>("eco_world");
  const saveMutation = useSaveSimulatorState<EcoWorldState>("eco_world");
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();

  const [state, setState] = useState<EcoWorldState>(initialState());
  const [pickedChoice, setPickedChoice] = useState<EcoChoice | null>(null);
  const loadedRef = useRef(false);

  useDocumentHead({ title: `${t("kids.explorer.tool.eco_world.title")} — VisionKids Explorer`, description: t("kids.explorer.meta.description"), canonicalPath: "/kids/explorer/eco-world" });

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

  const scenario = SCENARIOS[state.scenarioIndex];
  const finished = state.scenarioIndex >= SCENARIOS.length;

  const choose = (choice: EcoChoice) => {
    if (pickedChoice) return;
    setPickedChoice(choice);

    const wasFirstChoice = state.choicesMade.length === 0;
    window.setTimeout(() => {
      setState((s) => ({
        ...s,
        scenarioIndex: s.scenarioIndex + 1,
        ecoScore: s.ecoScore + (choice.correct ? 10 : 2),
        choicesMade: [...s.choicesMade, { scenarioId: scenario.id, choiceId: choice.id, correct: choice.correct }],
      }));
      setPickedChoice(null);
    }, 1400);

    if (wasFirstChoice) {
      awardAchievement.mutate("eco_hero");
      awardXp.mutate({ amount: 15, reason: "Simulator milestone: eco_first_choice" });
      awardCoins.mutate({ amount: 10, reason: "Simulator milestone: eco_first_choice" });
    }
  };

  const restart = () => setState(initialState());

  if (isLoading) return <div className="mx-auto max-w-xl px-4 py-16" aria-busy="true"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link to="/kids/explorer" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.homeTitle")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">♻️ {t("kids.explorer.tool.eco_world.title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("kids.explorer.ecoWorldSubtitle")}</p>

      {!finished && (
        <div className="mt-4 flex items-center gap-3">
          <Progress value={(state.scenarioIndex / SCENARIOS.length) * 100} className="flex-1" />
          <span className="text-sm text-muted-foreground">{state.scenarioIndex + 1}/{SCENARIOS.length}</span>
        </div>
      )}

      {finished ? (
        <motion.div initial="hidden" animate="visible" variants={fadeIn(reduced)} className="mt-8 flex flex-col items-center gap-4 rounded-2xl border-2 border-kids-green/40 bg-kids-green/10 p-8 text-center">
          <Leaf className="h-12 w-12 text-kids-green" aria-hidden="true" />
          <p className="font-heading text-2xl font-extrabold">{state.ecoScore} {t("kids.explorer.ecoPoints")}</p>
          <p className="text-muted-foreground">{t("kids.explorer.ecoWellDone")}</p>
          <Button variant="outline" className="gap-1.5" onClick={restart}><RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("kids.explorer.playAgain")}</Button>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={scenario.id} initial="hidden" animate="visible" exit="hidden" variants={fadeIn(reduced)} className="mt-6 rounded-2xl border-2 border-border bg-card p-6 text-center">
            <span className="text-4xl" aria-hidden="true">{scenario.emoji}</span>
            <p className="mt-3 font-heading text-lg font-bold">{t(scenario.promptKey)}</p>

            <div className="mt-4 grid gap-2">
              {scenario.choices.map((choice) => {
                const revealed = !!pickedChoice;
                const isPicked = pickedChoice?.id === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={revealed}
                    onClick={() => choose(choice)}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      revealed && choice.correct ? "border-kids-green bg-kids-green/10" : revealed && isPicked ? "border-destructive bg-destructive/10" : "border-border hover:bg-muted"
                    }`}
                  >
                    {t(choice.labelKey)}
                  </button>
                );
              })}
            </div>

            {pickedChoice && <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">{t(pickedChoice.explanationKey)}</p>}
          </motion.div>
        </AnimatePresence>
      )}

      {!user && <p className="mt-4 text-sm text-muted-foreground">{t("kids.explorer.signInToSave")}</p>}
    </div>
  );
}
