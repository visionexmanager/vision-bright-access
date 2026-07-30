import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCompleteExperiment } from "@/features/visionkids/hooks/stem/useStemEngagement";
import { SimulationStage } from "@/features/visionkids/components/stem/SimulationStage";
import { QuizBlock } from "@/features/visionkids/components/stem/QuizBlock";
import { MathActivity } from "@/features/visionkids/components/stem/MathActivity";
import { StemRewardBanner } from "@/features/visionkids/components/stem/StemRewardBanner";
import type { Experiment, SimulationConfig } from "@/features/visionkids/types/stem.types";

type Phase = "learn" | "quiz" | "done";

/** Orchestrates a single experiment: a learn step (body + steps + video + sim),
 *  then a quiz or math activity, then a celebratory completion that awards XP/
 *  coins server-side (once). Works for all three experiment kinds. */
export function ExperimentRunner({ experiment }: { experiment: Experiment }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const complete = useCompleteExperiment();

  const isActivity = experiment.kind === "activity";
  const hasQuiz = experiment.quiz.length > 0;
  const hasSim = experiment.kind === "simulation" && !!(experiment.simulation as SimulationConfig)?.type;

  const [phase, setPhase] = useState<Phase>("learn");
  const [reward, setReward] = useState(false);
  const [interacted, setInteracted] = useState(false);

  async function finish(score: number) {
    if (user) {
      try {
        const res = await complete.mutateAsync({ experimentId: experiment.id, quizScore: score });
        if (res.newly_completed) {
          setReward(true);
          setTimeout(() => setReward(false), 3500);
        }
      } catch { /* ignore */ }
    }
    setPhase("done");
  }

  // Learn step → advance to quiz/activity or complete directly.
  function proceed() {
    if (isActivity || hasQuiz) setPhase("quiz");
    else finish(0);
  }

  return (
    <div>
      <StemRewardBanner show={reward} message={t("kids.stem.experiment.completedMsg")} xp={experiment.reward_xp} coins={experiment.reward_coins} />

      {phase === "learn" && (
        <div className="flex flex-col gap-4">
          {experiment.body && <p className="text-base leading-relaxed">{experiment.body}</p>}

          {experiment.video_url && (
            <div className="overflow-hidden rounded-2xl border-2 border-border">
              <video controls preload="metadata" className="w-full" src={experiment.video_url}>
                {t("kids.stem.experiment.noVideo")}
              </video>
            </div>
          )}

          {hasSim && (
            <SimulationStage config={experiment.simulation as SimulationConfig} onInteract={() => setInteracted(true)} />
          )}

          {experiment.steps.length > 0 && (
            <ol className="flex flex-col gap-2">
              {experiment.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border-2 border-border bg-card p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-kids-primary/15 text-sm font-bold text-kids-primary">{i + 1}</span>
                  <span className="text-sm">{step}</span>
                </li>
              ))}
            </ol>
          )}

          <button
            type="button"
            onClick={proceed}
            disabled={hasSim && !interacted}
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-full bg-kids-primary px-6 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isActivity || hasQuiz ? t("kids.stem.experiment.toQuiz") : t("kids.stem.experiment.finish")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
          {hasSim && !interacted && <p className="text-sm text-muted-foreground">{t("kids.stem.experiment.tryFirst")}</p>}
        </div>
      )}

      {phase === "quiz" && (
        isActivity
          ? <MathActivity config={experiment.content} onDone={finish} />
          : <QuizBlock questions={experiment.quiz} onDone={finish} />
      )}

      {phase === "done" && (
        <div className="rounded-2xl border-2 border-kids-green/40 bg-kids-green/5 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-kids-green" aria-hidden="true" />
          <p className="mt-2 font-heading text-xl font-bold">{t("kids.stem.experiment.wellDone")}</p>
          {!user && <p className="mt-1 text-sm text-muted-foreground">{t("kids.stem.experiment.signInHint")}</p>}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => { setPhase("learn"); setInteracted(false); }} className="rounded-full border-2 border-border px-5 py-2 font-bold hover:border-kids-primary/50">
              {t("kids.stem.experiment.again")}
            </button>
            <Link to={`/kids/stem/${experiment.lab}`} className="rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90">
              {t("kids.stem.experiment.moreExperiments")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
