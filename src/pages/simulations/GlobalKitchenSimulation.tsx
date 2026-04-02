import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChefHat, Flame, Lock, RotateCcw, Trophy, Star } from "lucide-react";

interface Props {
  simulationId?: string;
}

type RecipeId = "omelette" | "pancakes" | "salad" | "sushi" | "macarons" | "wagyu";

interface Recipe {
  id: RecipeId;
  emoji: string;
  category: "free" | "premium";
  difficulty: "easy" | "medium" | "hard";
  points: number;
  steps: number;
}

const RECIPES: Recipe[] = [
  { id: "omelette", emoji: "🍳", category: "free", difficulty: "easy", points: 10, steps: 3 },
  { id: "pancakes", emoji: "🥞", category: "free", difficulty: "easy", points: 10, steps: 3 },
  { id: "salad", emoji: "🥗", category: "free", difficulty: "easy", points: 10, steps: 2 },
  { id: "sushi", emoji: "🍣", category: "premium", difficulty: "hard", points: 25, steps: 5 },
  { id: "macarons", emoji: "🧁", category: "premium", difficulty: "hard", points: 25, steps: 5 },
  { id: "wagyu", emoji: "🥩", category: "premium", difficulty: "medium", points: 20, steps: 4 },
];

export function GlobalKitchenSimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [proUnlocked, setProUnlocked] = useState(false);
  const [completed, setCompleted] = useState<RecipeId[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<RecipeId | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [cooking, setCooking] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);

  // Cooking timer per step
  useEffect(() => {
    if (!cooking || !activeRecipe) return;
    const timer = setTimeout(() => {
      const recipe = RECIPES.find((r) => r.id === activeRecipe)!;
      if (currentStep + 1 >= recipe.steps) {
        // Recipe complete
        setCompleted((prev) => [...prev, activeRecipe]);
        setScore((prev) => prev + recipe.points);
        setCooking(false);
        setActiveRecipe(null);
        setCurrentStep(0);
        toast.success(t("sim.kitchen.recipeDone"));
      } else {
        setCurrentStep((s) => s + 1);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [cooking, activeRecipe, currentStep, t]);

  const startRecipe = (recipe: Recipe) => {
    if (cooking || completed.includes(recipe.id)) return;
    if (recipe.category === "premium" && !proUnlocked) {
      setShowUnlock(true);
      return;
    }
    setActiveRecipe(recipe.id);
    setCurrentStep(0);
    setCooking(true);
  };

  const unlockPro = () => {
    setProUnlocked(true);
    setShowUnlock(false);
    toast.success(t("sim.kitchen.proUnlocked"));
  };

  const finish = async () => {
    setDone(true);
    const allDone = completed.length === RECIPES.length;
    const finalScore = score + (allDone ? 30 : 0);
    setScore(finalScore);

    if (user && simulationId) {
      const { data: existing } = await supabase
        .from("simulation_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_id", simulationId)
        .maybeSingle();

      const payload = {
        current_step: completed.length,
        decisions: JSON.parse(JSON.stringify({ completed, proUnlocked })),
        score: finalScore,
        completed: true,
      };

      if (existing) {
        await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("simulation_progress").insert({ user_id: user.id, simulation_id: simulationId, ...payload });
      }
    }
  };

  const restart = () => {
    setProUnlocked(false);
    setCompleted([]);
    setActiveRecipe(null);
    setCurrentStep(0);
    setCooking(false);
    setShowUnlock(false);
    setDone(false);
    setScore(0);
  };

  if (done) {
    const allDone = completed.length === RECIPES.length;
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-primary" />
          <CardTitle>{t("sim.kitchen.complete")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-3xl font-bold">{score} {t("sim.kitchen.points")}</p>
          <p className="text-muted-foreground">
            {allDone ? t("sim.kitchen.allRecipes") : t("sim.kitchen.partialRecipes")}
          </p>
          <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.kitchen.restart")}</Button>
        </CardContent>
      </Card>
    );
  }

  const activeR = activeRecipe ? RECIPES.find((r) => r.id === activeRecipe) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Cooking Station */}
      <Card className="overflow-hidden">
        <div className="relative h-48 bg-gradient-to-b from-muted to-muted/50 flex items-center justify-center">
          {cooking && activeR ? (
            <div className="text-center space-y-3">
              <span className="text-5xl animate-bounce">{activeR.emoji}</span>
              <p className="font-semibold">{t(`sim.kitchen.recipe.${activeR.id}`)}</p>
              <div className="flex gap-1 justify-center">
                {Array.from({ length: activeR.steps }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-2 rounded-full transition-colors ${i <= currentStep ? "bg-primary" : "bg-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("sim.kitchen.step")} {currentStep + 1}/{activeR.steps}
              </p>
              {cooking && <Flame className="mx-auto h-6 w-6 text-destructive animate-pulse" />}
            </div>
          ) : (
            <div className="text-center space-y-2">
              <ChefHat className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t("sim.kitchen.selectRecipe")}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Recipes grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {RECIPES.map((recipe) => {
          const isDone = completed.includes(recipe.id);
          const locked = recipe.category === "premium" && !proUnlocked;
          return (
            <Card
              key={recipe.id}
              className={`cursor-pointer transition-all hover:scale-[1.02] ${isDone ? "border-primary bg-primary/10" : ""} ${locked ? "opacity-60" : ""}`}
              onClick={() => startRecipe(recipe)}
            >
              <CardContent className="py-6 text-center space-y-2 relative">
                {locked && <Lock className="absolute top-2 right-2 h-4 w-4 text-accent-foreground" />}
                <span className="text-3xl">{recipe.emoji}</span>
                <p className="font-medium text-sm">{t(`sim.kitchen.recipe.${recipe.id}`)}</p>
                <Badge variant={recipe.difficulty === "hard" ? "destructive" : recipe.difficulty === "medium" ? "secondary" : "outline"} className="text-xs">
                  {t(`sim.kitchen.diff.${recipe.difficulty}`)}
                </Badge>
                {isDone && <Star className="mx-auto h-4 w-4 text-primary" />}
                {locked && <Badge variant="outline" className="text-xs border-accent-foreground text-accent-foreground">PREMIUM</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlock card */}
      {showUnlock && (
        <Card className="border-accent">
          <CardContent className="py-6 text-center space-y-4">
            <ChefHat className="mx-auto h-8 w-8 text-primary" />
            <h3 className="text-lg font-bold">{t("sim.kitchen.unlockTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("sim.kitchen.unlockDesc")}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={unlockPro}>{t("sim.kitchen.unlockBtn")}</Button>
              <Button variant="ghost" onClick={() => setShowUnlock(false)}>{t("sim.kitchen.close")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish */}
      {completed.length >= 3 && !cooking && (
        <div className="flex gap-3 justify-center">
          <Button size="lg" onClick={finish}>{t("sim.kitchen.finish")}</Button>
          <Button size="lg" variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />{t("sim.kitchen.restart")}</Button>
        </div>
      )}

      <p className="text-center text-muted-foreground">{t("sim.kitchen.score")}: {score}</p>
    </div>
  );
}
