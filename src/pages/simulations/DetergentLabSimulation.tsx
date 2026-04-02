import { useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, Droplets, FlaskConical, Beaker, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Ingredient = {
  id: string;
  nameKey: string;
  amount: number;
  premium: boolean;
  category: "base" | "active" | "secret";
};

const INGREDIENTS: Ingredient[] = [
  { id: "water", nameKey: "sim.detergent.ing.water", amount: 20, premium: false, category: "base" },
  { id: "texapon", nameKey: "sim.detergent.ing.texapon", amount: 20, premium: false, category: "active" },
  { id: "salt", nameKey: "sim.detergent.ing.salt", amount: 10, premium: false, category: "base" },
  { id: "fragrance", nameKey: "sim.detergent.ing.fragrance", amount: 10, premium: false, category: "active" },
  { id: "soda", nameKey: "sim.detergent.ing.soda", amount: 15, premium: true, category: "active" },
  { id: "stabilizer", nameKey: "sim.detergent.ing.stabilizer", amount: 15, premium: true, category: "secret" },
  { id: "thickener", nameKey: "sim.detergent.ing.thickener", amount: 10, premium: true, category: "secret" },
  { id: "preservative", nameKey: "sim.detergent.ing.preservative", amount: 10, premium: true, category: "secret" },
];

type Props = { simulationId?: string };

export function DetergentLabSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();

  const [volume, setVolume] = useState(0);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const hasBase = added.some((id) => INGREDIENTS.find((i) => i.id === id)?.category === "base");
  const hasActive = added.some((id) => INGREDIENTS.find((i) => i.id === id)?.category === "active");
  const hasSecret = added.some((id) => INGREDIENTS.find((i) => i.id === id)?.category === "secret");
  const balanced = hasBase && hasActive && hasSecret;

  const addIngredient = useCallback((ing: Ingredient) => {
    if (volume >= 100 || added.includes(ing.id) || completed) return;
    if (ing.premium && !proUnlocked) {
      playSound("wrong");
      toast.info(t("sim.detergent.unlockHint"));
      return;
    }

    playSound("pour");
    const newVol = Math.min(volume + ing.amount, 100);
    setVolume(newVol);
    setAdded((prev) => [...prev, ing.id]);
    setScore((s) => s + (ing.premium ? 15 : 10));
    toast.success(`${t(ing.nameKey)} +${ing.amount}%`);

    if (newVol >= 40 && !proUnlocked) {
      toast.info(t("sim.detergent.proHint"));
    }
  }, [volume, added, proUnlocked, completed, t, playSound]);

  const unlockPro = useCallback(() => {
    setProUnlocked(true);
    setScore((s) => s + 20);
    playSound("unlock");
    toast.success(t("sim.detergent.proUnlocked"));
  }, [t, playSound]);

  const finishMix = useCallback(async () => {
    if (completed) return;
    const bonus = balanced ? 30 : 0;
    const finalScore = score + bonus;
    setScore(finalScore);
    setCompleted(true);

    if (balanced) toast.success(t("sim.detergent.balanced"));
    else toast.info(t("sim.detergent.unbalanced"));

    if (user && simulationId) {
      const { data: existing } = await supabase
        .from("simulation_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_id", simulationId)
        .maybeSingle();

      const payload = {
        current_step: added.length,
        decisions: JSON.parse(JSON.stringify(added)),
        score: finalScore,
        completed: true,
      };

      if (existing) {
        await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("simulation_progress").insert([{ user_id: user.id, simulation_id: simulationId, ...payload }]);
      }
    }
  }, [completed, balanced, score, added, user, simulationId, t]);

  const reset = () => {
    setVolume(0);
    setProUnlocked(false);
    setAdded([]);
    setScore(0);
    setCompleted(false);
  };

  const fillColor = proUnlocked
    ? "bg-gradient-to-t from-blue-600 to-cyan-400"
    : "bg-gradient-to-t from-blue-800 to-blue-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">{t("sim.detergent.title")}</h2>
        </div>
        <Badge variant={proUnlocked ? "default" : "secondary"}>
          {proUnlocked ? "PRO" : t("sim.detergent.modeFree")}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">{t("sim.detergent.desc")}</p>

      {/* Beaker */}
      <Card className="border-primary/30">
        <CardContent className="pt-6 flex flex-col items-center gap-4">
          <div className="relative w-36 h-52 border-x-4 border-b-4 border-primary/40 rounded-b-[2.5rem] overflow-hidden bg-background">
            <div
              className={`absolute bottom-0 w-full transition-all duration-700 ${fillColor} opacity-80`}
              style={{ height: `${volume}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-mono font-bold drop-shadow-lg">{volume}%</span>
            </div>
          </div>

          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className={hasBase ? "text-green-500 font-semibold" : ""}>
              {t("sim.detergent.catBase")} {hasBase ? "✓" : "—"}
            </span>
            <span className={hasActive ? "text-green-500 font-semibold" : ""}>
              {t("sim.detergent.catActive")} {hasActive ? "✓" : "—"}
            </span>
            <span className={hasSecret ? "text-green-500 font-semibold" : ""}>
              {t("sim.detergent.catSecret")} {hasSecret ? "✓" : "—"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Beaker className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t("sim.detergent.score")}: {score}</span>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <div className="grid grid-cols-2 gap-3">
        {INGREDIENTS.map((ing) => {
          const isAdded = added.includes(ing.id);
          const isLocked = ing.premium && !proUnlocked;

          return (
            <Button
              key={ing.id}
              variant={isAdded ? "default" : "outline"}
              disabled={isAdded || isLocked || volume >= 100 || completed}
              onClick={() => addIngredient(ing)}
              className="h-auto py-3 flex flex-col gap-1 relative"
            >
              <span className="flex items-center gap-1">
                {isLocked && <Lock className="h-3 w-3" />}
                {isAdded && <CheckCircle2 className="h-3 w-3" />}
                {t(ing.nameKey)}
              </span>
              <span className="text-xs opacity-70">
                +{ing.amount}% · {t(`sim.detergent.cat.${ing.category}`)}
              </span>
              {isLocked && (
                <Badge variant="outline" className="absolute -top-2 -right-2 text-[10px] px-1">PRO</Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Unlock PRO */}
      {!proUnlocked && volume >= 30 && (
        <Card className="border-primary bg-primary/10">
          <CardContent className="pt-4 text-center space-y-3">
            <p className="font-semibold">{t("sim.detergent.unlockTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("sim.detergent.unlockDesc")}</p>
            <Button onClick={unlockPro}>{t("sim.detergent.unlockBtn")}</Button>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!completed && volume > 0 && (
          <Button onClick={finishMix} className="flex-1 gap-2">
            <Droplets className="h-4 w-4" />
            {t("sim.detergent.finish")}
          </Button>
        )}
        {completed && (
          <Button onClick={reset} variant="outline" className="flex-1 gap-2">
            <RotateCcw className="h-4 w-4" />
            {t("sim.detergent.restart")}
          </Button>
        )}
      </div>

      {completed && (
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-4 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
            <p className="font-semibold">{t("sim.detergent.complete")}</p>
            <p className="text-sm text-muted-foreground">{t("sim.detergent.finalScore")}: {score}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
