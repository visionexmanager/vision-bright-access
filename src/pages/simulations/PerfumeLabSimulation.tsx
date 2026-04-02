import { useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock, Unlock, FlaskConical, Droplets, Star, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Ingredient = {
  id: string;
  nameKey: string;
  amount: number;
  category: "top" | "heart" | "base";
  premium: boolean;
};

const INGREDIENTS: Ingredient[] = [
  { id: "musk", nameKey: "sim.perfume.ing.musk", amount: 10, category: "base", premium: false },
  { id: "lemon", nameKey: "sim.perfume.ing.lemon", amount: 10, category: "top", premium: false },
  { id: "lavender", nameKey: "sim.perfume.ing.lavender", amount: 10, category: "heart", premium: false },
  { id: "vanilla", nameKey: "sim.perfume.ing.vanilla", amount: 15, category: "base", premium: false },
  { id: "royalOud", nameKey: "sim.perfume.ing.royalOud", amount: 20, category: "base", premium: true },
  { id: "indianIncense", nameKey: "sim.perfume.ing.indianIncense", amount: 20, category: "heart", premium: true },
  { id: "jasmine", nameKey: "sim.perfume.ing.jasmine", amount: 15, category: "heart", premium: true },
  { id: "amber", nameKey: "sim.perfume.ing.amber", amount: 15, category: "base", premium: true },
];

type Props = { simulationId?: string };

export function PerfumeLabSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [volume, setVolume] = useState(0);
  const [proUnlocked, setProUnlocked] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const hasTop = added.some((id) => INGREDIENTS.find((i) => i.id === id)?.category === "top");
  const hasHeart = added.some((id) => INGREDIENTS.find((i) => i.id === id)?.category === "heart");
  const hasBase = added.some((id) => INGREDIENTS.find((i) => i.id === id)?.category === "base");
  const balanced = hasTop && hasHeart && hasBase;

  const addIngredient = useCallback((ing: Ingredient) => {
    if (volume >= 100 || added.includes(ing.id)) return;
    if (ing.premium && !proUnlocked) return;

    const newVol = Math.min(volume + ing.amount, 100);
    setVolume(newVol);
    setAdded((prev) => [...prev, ing.id]);
    setScore((prev) => prev + (ing.premium ? 15 : 10));

    toast.success(`${t(ing.nameKey)} +${ing.amount}%`);

    if (newVol >= 50 && !proUnlocked) {
      toast.info(t("sim.perfume.unlockHint"));
    }
  }, [volume, added, proUnlocked, t]);

  const unlockPro = useCallback(() => {
    setProUnlocked(true);
    setScore((prev) => prev + 20);
    toast.success(t("sim.perfume.proUnlocked"));
  }, [t]);

  const finishBlend = useCallback(async () => {
    if (completed) return;
    const bonus = balanced ? 30 : 0;
    const finalScore = score + bonus;
    setScore(finalScore);
    setCompleted(true);

    if (balanced) toast.success(t("sim.perfume.balanced"));
    else toast.info(t("sim.perfume.unbalanced"));

    if (user && simulationId) {
      const { data: existing } = await supabase
        .from("simulation_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_id", simulationId)
        .maybeSingle();

      if (existing) {
        await supabase.from("simulation_progress").update({
          current_step: added.length,
          decisions: JSON.parse(JSON.stringify(added)),
          score: finalScore,
          completed: true,
        }).eq("id", existing.id);
      } else {
        await supabase.from("simulation_progress").insert([{
          user_id: user.id,
          simulation_id: simulationId,
          current_step: added.length,
          decisions: JSON.parse(JSON.stringify(added)),
          score: finalScore,
          completed: true,
        }]);
      }
    }
  }, [completed, balanced, score, user, simulationId, added, t]);

  const reset = () => {
    setVolume(0);
    setProUnlocked(false);
    setAdded([]);
    setScore(0);
    setCompleted(false);
  };

  const fillColor = proUnlocked
    ? "bg-gradient-to-t from-amber-500 to-yellow-300"
    : "bg-gradient-to-t from-amber-700 to-amber-400";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-amber-500" />
          <h2 className="text-xl font-bold">{t("sim.perfume.title")}</h2>
        </div>
        <Badge variant={proUnlocked ? "default" : "secondary"}>
          {proUnlocked ? t("sim.perfume.modePro") : t("sim.perfume.modeFree")}
        </Badge>
      </div>

      <p className="text-muted-foreground text-sm">{t("sim.perfume.desc")}</p>

      {/* Bottle visualization */}
      <Card className="border-amber-500/30">
        <CardContent className="pt-6 flex flex-col items-center gap-4">
          <div className="relative w-28 h-48 border-2 border-amber-500/60 rounded-b-[2rem] rounded-t-lg overflow-hidden bg-background">
            <div
              className={`absolute bottom-0 w-full transition-all duration-500 ${fillColor}`}
              style={{ height: `${volume}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-mono font-bold drop-shadow-lg">
                {volume}%
              </span>
            </div>
          </div>

          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className={hasTop ? "text-green-500 font-semibold" : ""}>
              {t("sim.perfume.noteTop")} {hasTop ? "✓" : "—"}
            </span>
            <span className={hasHeart ? "text-green-500 font-semibold" : ""}>
              {t("sim.perfume.noteHeart")} {hasHeart ? "✓" : "—"}
            </span>
            <span className={hasBase ? "text-green-500 font-semibold" : ""}>
              {t("sim.perfume.noteBase")} {hasBase ? "✓" : "—"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{t("sim.perfume.score")}: {score}</span>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients grid */}
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
                +{ing.amount}% · {t(`sim.perfume.cat.${ing.category}`)}
              </span>
              {isLocked && (
                <Badge variant="outline" className="absolute -top-2 -right-2 text-[10px] px-1">
                  PRO
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Unlock PRO */}
      {!proUnlocked && volume >= 30 && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="pt-4 text-center space-y-3">
            <p className="font-semibold text-amber-400">{t("sim.perfume.unlockTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("sim.perfume.unlockDesc")}</p>
            <Button onClick={unlockPro} className="gap-2">
              <Unlock className="h-4 w-4" />
              {t("sim.perfume.unlockBtn")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Finish / Reset */}
      <div className="flex gap-3">
        {!completed && volume > 0 && (
          <Button onClick={finishBlend} className="flex-1 gap-2">
            <Droplets className="h-4 w-4" />
            {t("sim.perfume.finish")}
          </Button>
        )}
        {completed && (
          <Button onClick={reset} variant="outline" className="flex-1">
            {t("sim.perfume.restart")}
          </Button>
        )}
      </div>

      {completed && (
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-4 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
            <p className="font-semibold">{t("sim.perfume.complete")}</p>
            <p className="text-sm text-muted-foreground">
              {t("sim.perfume.finalScore")}: {score}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
