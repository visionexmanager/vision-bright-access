import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAchievements } from "@/hooks/useAchievements";
import { useAmbientSound, getSimulationAmbient } from "@/hooks/useAmbientSound";
import { supabase } from "@/integrations/supabase/client";
import { SimulationMentor } from "@/components/SimulationMentor";
import { SimulationProjectBrief } from "@/components/SimulationProjectBrief";
import { SimulationProjectReport } from "@/components/SimulationProjectReport";
import { getSimulationComponent, hasCustomComponent } from "@/pages/simulations/registry";
import { SIM_PROJECTS } from "@/data/simulationProjects";
import { ArrowLeft } from "lucide-react";
import { WatchAdButton } from "@/components/WatchAdButton";

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
  decisions: unknown[];
  completed: boolean;
  score: number;
};

type Phase = "loading" | "brief" | "active" | "report";

// Legacy registry kept for backwards-compatibility (unused when custom component exists)
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
  const { checkAndUnlock } = useAchievements();

  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [progress, setProgress] = useState<SimProgress | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [finalScore, setFinalScore] = useState(0);
  const [finalPoints, setFinalPoints] = useState(0);

  // Play ambient during brief and active phases; silence during report
  useAmbientSound(phase === "brief" || phase === "active" ? getSimulationAmbient(slug) : null);

  // Load simulation metadata + user progress
  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data: simData } = await supabase
        .from("simulations")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();

      if (!simData) {
        setPhase("brief"); // will show not-found via null simulation check
        return;
      }

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

          if (p.completed) {
            // User has already completed — show report or go straight to active
            setFinalScore(p.score);
            setFinalPoints(simData.points);
            setPhase("report");
          } else {
            // Resume in-progress session
            setPhase("active");
          }
          return;
        }
      }

      // No progress yet — show project brief first
      setPhase("brief");
    };

    load();
  }, [slug, user]);

  // Listen for simulation-completed event from custom components
  useEffect(() => {
    const handler = async () => {
      await checkAndUnlock();

      if (!simulation || !user) return;

      // Re-fetch the latest progress to get the real score
      const { data: latest } = await supabase
        .from("simulation_progress")
        .select("score, completed")
        .eq("simulation_id", simulation.id)
        .eq("user_id", user.id)
        .maybeSingle();

      setFinalScore(latest?.score ?? 0);
      setFinalPoints(simulation.points);

      // Brief delay so completion animations in the custom component can play
      setTimeout(() => setPhase("report"), 800);
    };

    window.addEventListener("simulation-completed", handler);
    return () => window.removeEventListener("simulation-completed", handler);
  }, [checkAndUnlock, simulation, user]);

  const handleStartProject = useCallback(() => {
    setPhase("active");
  }, []);

  const handleRestart = useCallback(async () => {
    if (progress) {
      await supabase
        .from("simulation_progress")
        .update({
          current_step: 0,
          decisions: [] as unknown as Record<string, unknown>,
          score: 0,
          completed: false,
        })
        .eq("id", progress.id);
    }
    setPhase("brief");
    setFinalScore(0);
  }, [progress]);

  // Loading spinner
  if (phase === "loading") {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  // Simulation not found
  if (!simulation) {
    return (
      <Layout>
        <div className="section-container py-20 text-center">
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

  const project = slug ? SIM_PROJECTS[slug] : null;

  // Project Brief phase
  if (phase === "brief") {
    return (
      <Layout>
        <section className="container mx-auto max-w-2xl px-4 py-10">
          <Button asChild variant="ghost" className="mb-6">
            <Link to="/business-simulator">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("bsim.backToList")}
            </Link>
          </Button>

          {project ? (
            <SimulationProjectBrief
              project={project}
              simulationTitle={simulation.title}
              difficulty={simulation.difficulty}
              estimatedDuration={simulation.estimated_duration}
              onStart={handleStartProject}
            />
          ) : (
            /* Fallback for simulations without project data */
            <div className="text-center space-y-4 py-10">
              <h1 className="text-2xl font-bold">{simulation.title}</h1>
              <p className="text-muted-foreground">{simulation.description}</p>
              <Button onClick={handleStartProject} size="lg" className="gap-2">
                Start Simulation
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          )}
          <WatchAdButton variant="banner" className="mt-4" />
        </section>
      </Layout>
    );
  }

  // Project Report phase
  if (phase === "report") {
    return (
      <Layout>
        <section className="container mx-auto max-w-2xl px-4 py-10">
          {project ? (
            <SimulationProjectReport
              project={project}
              simulationTitle={simulation.title}
              score={finalScore}
              pointsEarned={finalPoints}
              onRestart={handleRestart}
            />
          ) : (
            /* Fallback completion card */
            <div className="text-center space-y-4 py-10">
              <h2 className="text-2xl font-bold">{t("bsim.completed")}</h2>
              <p className="text-muted-foreground">{t("bsim.finalScore")}: {finalScore}</p>
              <div className="flex gap-3 justify-center">
                <Button asChild variant="outline">
                  <Link to="/business-simulator">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("bsim.backToList")}
                  </Link>
                </Button>
                <Button onClick={handleRestart} variant="outline">
                  {t("bsim.playAgain")}
                </Button>
              </div>
            </div>
          )}
        </section>
      </Layout>
    );
  }

  // Active simulation phase — render custom component
  if (slug && hasCustomComponent(slug)) {
    const CustomSim = getSimulationComponent(slug)!;
    return (
      <Layout>
        <section className="section-container py-10">
          <Suspense
            fallback={
              <div className="flex min-h-[30vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            }
          >
            <CustomSim simulationId={simulation.id} />
          </Suspense>
        </section>
      </Layout>
    );
  }

  // No custom component — show coming soon
  return (
    <Layout>
      <section className="section-container py-10">
        <Button asChild variant="ghost" className="mb-4">
          <Link to="/business-simulator">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("bsim.backToList")}
          </Link>
        </Button>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-2">{simulation.title}</h1>
          <p className="text-muted-foreground mb-6">{simulation.description}</p>
          <p className="text-sm text-muted-foreground">{t("bsim.comingSoon")}</p>
        </div>
        <SimulationMentor simulationTitle={simulation.title} currentStepTitle="" />
      </section>
    </Layout>
  );
}
