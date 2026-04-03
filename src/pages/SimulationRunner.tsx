import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { useAchievements } from "@/hooks/useAchievements";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SimulationMentor } from "@/components/SimulationMentor";
import { getSimulationComponent, hasCustomComponent } from "@/pages/simulations/registry";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Trophy,
} from "lucide-react";

type Simulation = {
  id: string;
  title: string;
  description: string;
  slug: string;
  points: number;
  difficulty: string;
  estimated_duration: number;
  subcategory: string;
};

type SimProgress = {
  id: string;
  current_step: number;
  decisions: any[];
  completed: boolean;
  score: number;
};

/**
 * SimulationRunner renders a simulation. Each simulation's steps & decisions
 * are defined by a registry (simulationSteps). When a user provides their
 * project code, they register their steps here.
 *
 * For now this component shows a placeholder framework that simulation
 * code will plug into.
 */

// Registry: slug → steps array. Simulation code will register here.
export type SimulationStep = {
  title: string;
  description: string;
  choices?: { label: string; value: string; feedback: string; points: number }[];
};

export const simulationRegistry: Record<string, SimulationStep[]> = {};

export default function SimulationRunner() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints } = useEarnPoints();
  const { checkAndUnlock } = useAchievements();

  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [progress, setProgress] = useState<SimProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const steps = slug ? simulationRegistry[slug] || [] : [];
  const totalSteps = steps.length;
  const progressPct = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  // Load simulation + progress
  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data: simData } = await supabase
        .from("simulations")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();

      if (simData) {
        setSimulation(simData as Simulation);

        if (user) {
          const { data: prog } = await supabase
            .from("simulation_progress")
            .select("*")
            .eq("simulation_id", simData.id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (prog) {
            const p = prog as SimProgress;
            setProgress(p);
            setCurrentStep(p.current_step);
            setDecisions(Array.isArray(p.decisions) ? p.decisions : []);
            setScore(p.score);
            setCompleted(p.completed);
          }
        }
      }
      setLoading(false);
    };
    load();
  }, [slug, user]);

  // Save progress to DB
  const saveProgress = useCallback(
    async (step: number, decs: any[], sc: number, done: boolean) => {
      if (!user || !simulation) return;
      const payload = {
        user_id: user.id,
        simulation_id: simulation.id,
        current_step: step,
        decisions: decs as any,
        score: sc,
        completed: done,
        updated_at: new Date().toISOString(),
      };

      if (progress) {
        await supabase
          .from("simulation_progress")
          .update(payload)
          .eq("id", progress.id);
      } else {
        const { data } = await supabase
          .from("simulation_progress")
          .insert(payload)
          .select()
          .single();
        if (data) setProgress(data as SimProgress);
      }
    },
    [user, simulation, progress]
  );

  const handleChoice = async (choice: { label: string; value: string; feedback: string; points: number }) => {
    const newDecisions = [...decisions, { step: currentStep, choice: choice.value }];
    const newScore = score + choice.points;
    setDecisions(newDecisions);
    setScore(newScore);
    setFeedback(choice.feedback);

    if (currentStep >= totalSteps - 1) {
      setCompleted(true);
      await saveProgress(currentStep, newDecisions, newScore, true);
      if (user && simulation) {
        await earnPoints(simulation.points, `Completed simulation: ${simulation.title}`);
        toast({
          title: t("bsim.completed"),
          description: `+${simulation.points} pts`,
        });
      }
    } else {
      await saveProgress(currentStep, newDecisions, newScore, false);
    }
  };

  const nextStep = () => {
    setFeedback(null);
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const resetSimulation = async () => {
    setCurrentStep(0);
    setDecisions([]);
    setScore(0);
    setCompleted(false);
    setFeedback(null);
    if (progress) {
      await supabase
        .from("simulation_progress")
        .update({ current_step: 0, decisions: [] as any, score: 0, completed: false })
        .eq("id", progress.id);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!simulation) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">{t("bsim.notFound")}</h1>
          <Button asChild>
            <Link to="/business-simulator">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("bsim.backToList")}
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  // Custom component simulation
  if (slug && hasCustomComponent(slug)) {
    const CustomSim = getSimulationComponent(slug)!;
    return (
      <Layout>
        <section className="mx-auto max-w-4xl px-4 py-10">
          <Suspense fallback={
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }>
            <CustomSim simulationId={simulation.id} />
          </Suspense>
        </section>
      </Layout>
    );
  }

  // No steps registered yet — show placeholder
  if (totalSteps === 0) {
    return (
      <Layout>
        <section className="mx-auto max-w-3xl px-4 py-10">
          <Button asChild variant="ghost" className="mb-4">
            <Link to="/business-simulator">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("bsim.backToList")}
            </Link>
          </Button>
          <Card>
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold mb-2">{simulation.title}</h1>
              <p className="text-muted-foreground mb-6">{simulation.description}</p>
              <Badge variant="secondary" className="text-base">
                {t("bsim.comingSoon")}
              </Badge>
            </CardContent>
          </Card>
          <SimulationMentor simulationTitle={simulation.title} currentStepTitle="" />
        </section>
      </Layout>
    );
  }

  const step = steps[currentStep];

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <Button asChild variant="ghost" className="mb-4">
          <Link to="/business-simulator">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("bsim.backToList")}
          </Link>
        </Button>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold">{simulation.title}</h1>
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {completed ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <Trophy className="h-16 w-16 text-primary mx-auto" />
              <h2 className="text-2xl font-bold">{t("bsim.completed")}</h2>
              <p className="text-lg text-muted-foreground">
                {t("bsim.finalScore")}: {score} pts
              </p>
              <Button onClick={resetSimulation} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("bsim.playAgain")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-2">{step.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>

              {feedback && (
                <div className="rounded-lg bg-muted p-4 border-l-4 border-primary">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">{feedback}</p>
                  </div>
                  <Button onClick={nextStep} className="mt-3" size="sm">
                    {t("bsim.next")}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}

              {!feedback && step.choices && (
                <div className="grid gap-3">
                  {step.choices.map((choice, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4 whitespace-normal"
                      onClick={() => handleChoice(choice)}
                    >
                      <span className="font-semibold mr-2 shrink-0">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {choice.label}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Mentor */}
        <SimulationMentor
          simulationTitle={simulation.title}
          currentStepTitle={step?.title || ""}
        />
      </section>
    </Layout>
  );
}
