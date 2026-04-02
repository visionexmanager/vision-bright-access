import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Lock, Plane, Hotel, UtensilsCrossed, ShoppingBag, ArrowRight, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { toast } from "sonner";

type Option = {
  textKey: string;
  correct: boolean;
  hintKey: string;
};

type Step = {
  questionKey: string;
  options: Option[];
};

type Location = {
  id: string;
  nameKey: string;
  icon: React.ReactNode;
  locked: boolean;
  steps: Step[];
};

const LOCATIONS: Location[] = [
  {
    id: "airport",
    nameKey: "sim.english.loc.airport",
    icon: <Plane className="h-8 w-8" />,
    locked: false,
    steps: [
      {
        questionKey: "sim.english.airport.q1",
        options: [
          { textKey: "sim.english.airport.q1.a1", correct: true, hintKey: "sim.english.airport.q1.h1" },
          { textKey: "sim.english.airport.q1.a2", correct: false, hintKey: "sim.english.airport.q1.h2" },
        ],
      },
      {
        questionKey: "sim.english.airport.q2",
        options: [
          { textKey: "sim.english.airport.q2.a1", correct: true, hintKey: "sim.english.airport.q2.h1" },
          { textKey: "sim.english.airport.q2.a2", correct: false, hintKey: "sim.english.airport.q2.h2" },
        ],
      },
    ],
  },
  {
    id: "hotel",
    nameKey: "sim.english.loc.hotel",
    icon: <Hotel className="h-8 w-8" />,
    locked: false,
    steps: [
      {
        questionKey: "sim.english.hotel.q1",
        options: [
          { textKey: "sim.english.hotel.q1.a1", correct: true, hintKey: "sim.english.hotel.q1.h1" },
          { textKey: "sim.english.hotel.q1.a2", correct: false, hintKey: "sim.english.hotel.q1.h2" },
        ],
      },
      {
        questionKey: "sim.english.hotel.q2",
        options: [
          { textKey: "sim.english.hotel.q2.a1", correct: true, hintKey: "sim.english.hotel.q2.h1" },
          { textKey: "sim.english.hotel.q2.a2", correct: false, hintKey: "sim.english.hotel.q2.h2" },
        ],
      },
    ],
  },
  {
    id: "restaurant",
    nameKey: "sim.english.loc.restaurant",
    icon: <UtensilsCrossed className="h-8 w-8" />,
    locked: true,
    steps: [
      {
        questionKey: "sim.english.restaurant.q1",
        options: [
          { textKey: "sim.english.restaurant.q1.a1", correct: true, hintKey: "sim.english.restaurant.q1.h1" },
          { textKey: "sim.english.restaurant.q1.a2", correct: false, hintKey: "sim.english.restaurant.q1.h2" },
        ],
      },
    ],
  },
  {
    id: "shopping",
    nameKey: "sim.english.loc.shopping",
    icon: <ShoppingBag className="h-8 w-8" />,
    locked: true,
    steps: [
      {
        questionKey: "sim.english.shopping.q1",
        options: [
          { textKey: "sim.english.shopping.q1.a1", correct: true, hintKey: "sim.english.shopping.q1.h1" },
          { textKey: "sim.english.shopping.q1.a2", correct: false, hintKey: "sim.english.shopping.q1.h2" },
        ],
      },
    ],
  },
];

type Props = { simulationId?: string };

export function EnglishJourneySimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [proUnlocked, setProUnlocked] = useState(false);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [completedLocations, setCompletedLocations] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState(false);

  const location = LOCATIONS.find((l) => l.id === activeLocation);
  const step = location?.steps[stepIdx];
  const allDone = completedLocations.size === LOCATIONS.length;

  const startLocation = useCallback((loc: Location) => {
    if (loc.locked && !proUnlocked) {
      toast.info(t("sim.english.unlockHint"));
      return;
    }
    setActiveLocation(loc.id);
    setStepIdx(0);
    setFeedback(null);
    setAnswered(false);
  }, [proUnlocked, t]);

  const handleAnswer = useCallback((opt: Option) => {
    if (answered) return;
    setAnswered(true);
    setFeedback({ text: t(opt.hintKey), correct: opt.correct });
    if (opt.correct) setScore((s) => s + 20);
  }, [answered, t]);

  const nextStep = useCallback(() => {
    if (!location) return;
    const next = stepIdx + 1;
    if (next < location.steps.length) {
      setStepIdx(next);
      setFeedback(null);
      setAnswered(false);
    } else {
      setCompletedLocations((prev) => new Set(prev).add(location.id));
      setActiveLocation(null);
      setFeedback(null);
      setAnswered(false);
      toast.success(t("sim.english.locationDone"));
    }
  }, [location, stepIdx, t]);

  const unlockPro = useCallback(() => {
    setProUnlocked(true);
    setScore((s) => s + 20);
    toast.success(t("sim.english.proUnlocked"));
  }, [t]);

  const saveAndFinish = useCallback(async () => {
    if (user && simulationId) {
      const { data: existing } = await supabase
        .from("simulation_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_id", simulationId)
        .maybeSingle();

      const payload = {
        current_step: completedLocations.size,
        decisions: JSON.parse(JSON.stringify([...completedLocations])),
        score,
        completed: true,
      };

      if (existing) {
        await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("simulation_progress").insert([{
          user_id: user.id,
          simulation_id: simulationId,
          ...payload,
        }]);
      }
    }
    toast.success(t("sim.english.saved"));
  }, [user, simulationId, completedLocations, score, t]);

  const reset = () => {
    setProUnlocked(false);
    setActiveLocation(null);
    setStepIdx(0);
    setScore(0);
    setFeedback(null);
    setCompletedLocations(new Set());
    setAnswered(false);
  };

  // Active scene view
  if (activeLocation && location && step) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t(location.nameKey)}</h2>
          <Button variant="ghost" size="sm" onClick={() => { setActiveLocation(null); setFeedback(null); setAnswered(false); }}>
            ✕
          </Button>
        </div>

        <Card className="border-primary/30">
          <CardContent className="pt-6 space-y-4">
            <p className="text-center text-lg font-medium">{t(step.questionKey)}</p>

            <div className="grid gap-3">
              {step.options.map((opt, i) => (
                <Button
                  key={i}
                  variant={
                    answered
                      ? opt.correct
                        ? "default"
                        : "outline"
                      : "outline"
                  }
                  disabled={answered}
                  onClick={() => handleAnswer(opt)}
                  className="h-auto py-3 text-start justify-start"
                >
                  {t(opt.textKey)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {feedback && (
          <Card className={feedback.correct ? "border-green-500/40 bg-green-500/10" : "border-destructive/40 bg-destructive/10"}>
            <CardContent className="pt-4 flex items-start gap-3">
              {feedback.correct ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              )}
              <p className="text-sm">{feedback.text}</p>
            </CardContent>
          </Card>
        )}

        {answered && (
          <Button onClick={nextStep} className="w-full gap-2">
            <ArrowRight className="h-4 w-4" />
            {stepIdx + 1 < location.steps.length ? t("sim.english.next") : t("sim.english.finishLocation")}
          </Button>
        )}
      </div>
    );
  }

  // Map view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t("sim.english.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("sim.english.desc")}</p>
        </div>
        <Badge variant="secondary">{t("sim.english.score")}: {score}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {LOCATIONS.map((loc) => {
          const isLocked = loc.locked && !proUnlocked;
          const isDone = completedLocations.has(loc.id);

          return (
            <Card
              key={loc.id}
              className={`cursor-pointer transition-all hover:shadow-md ${isLocked ? "opacity-50 grayscale" : ""} ${isDone ? "border-green-500/50" : ""}`}
              onClick={() => startLocation(loc)}
            >
              <CardContent className="pt-6 text-center space-y-2 relative">
                {isLocked && <Lock className="h-4 w-4 absolute top-2 right-2 text-muted-foreground" />}
                {isDone && <CheckCircle2 className="h-4 w-4 absolute top-2 right-2 text-green-500" />}
                <div className="flex justify-center text-primary">{loc.icon}</div>
                <p className="font-semibold text-sm">{t(loc.nameKey)}</p>
                <p className="text-xs text-muted-foreground">{loc.steps.length} {t("sim.english.scenarios")}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlock PRO */}
      {!proUnlocked && completedLocations.size >= 1 && (
        <Card className="border-primary bg-primary/10">
          <CardContent className="pt-4 text-center space-y-3">
            <p className="font-semibold">{t("sim.english.unlockTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("sim.english.unlockDesc")}</p>
            <Button onClick={unlockPro}>{t("sim.english.unlockBtn")}</Button>
          </CardContent>
        </Card>
      )}

      {/* Completion */}
      {allDone && (
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-4 text-center space-y-3">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
            <p className="font-semibold">{t("sim.english.complete")}</p>
            <p className="text-sm text-muted-foreground">{t("sim.english.finalScore")}: {score}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={saveAndFinish}>{t("sim.english.save")}</Button>
              <Button variant="outline" onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {t("sim.english.restart")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
