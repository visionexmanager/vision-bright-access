import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ArrowLeft, Send } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useInnovationChallenge } from "@/features/visionkids/hooks/stem/useStemCatalog";
import { useSubmitInnovation } from "@/features/visionkids/hooks/stem/useStemProjects";
import { INNOVATION_PHASES, INNOVATION_PHASE_EMOJI, type InnovationPhase } from "@/features/visionkids/data/stemConfig";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";
import { StemRewardBanner } from "@/features/visionkids/components/stem/StemRewardBanner";

export default function InnovationChallengeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: challenge, isLoading } = useInnovationChallenge(slug);
  const submit = useSubmitInnovation();

  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState("");
  const [solution, setSolution] = useState("");
  const [prototype, setPrototype] = useState("");
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState(false);
  const [done, setDone] = useState(false);

  useDocumentHead({
    title: challenge ? `${challenge.title} — VisionKids` : t("kids.stem.nav.innovation"),
    description: challenge?.problem ?? t("kids.stem.innovation.subtitle"),
    canonicalPath: `/kids/stem/innovation/${slug}`,
  });

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10"><div className="h-96 animate-pulse rounded-3xl bg-muted" /></div>;
  if (!challenge) return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <StemHeader emoji="💡" title={t("kids.stem.notFound")} backTo="/kids/stem/innovation" />
    </div>
  );

  const phase: InnovationPhase = INNOVATION_PHASES[step];
  const hints = challenge.content.hints ?? [];
  const isLast = step === INNOVATION_PHASES.length - 1;

  async function onSubmit() {
    if (!user || !title.trim()) return;
    try {
      await submit.mutateAsync({
        challengeId: challenge.id,
        title: title.trim(),
        description: solution.trim() || challenge.problem,
        data: { idea, solution, prototype },
        isPublic: true,
      });
      setDone(true);
      setReward(true);
      setTimeout(() => setReward(false), 3500);
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <StemHeader emoji={challenge.emoji} title={challenge.title} subtitle={challenge.problem}
        backTo="/kids/stem/innovation" backLabelKey="kids.stem.nav.innovation" />
      <StemRewardBanner show={reward} message={t("kids.stem.innovation.submittedMsg")} xp={challenge.reward_xp} coins={challenge.reward_coins} />

      {done ? (
        <div className="mt-6 rounded-2xl border-2 border-kids-green/40 bg-kids-green/5 p-6 text-center">
          <p className="font-heading text-xl font-bold text-kids-green">🎉 {t("kids.stem.innovation.thanks")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/kids/stem/gallery" className="rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90">{t("kids.stem.innovation.seeGallery")}</Link>
            <Link to="/kids/stem/innovation" className="rounded-full border-2 border-border px-5 py-2 font-bold hover:border-kids-primary/50">{t("kids.stem.innovation.moreChallenges")}</Link>
          </div>
        </div>
      ) : (
        <>
          {/* Phase stepper */}
          <ol className="mt-5 flex flex-wrap gap-2" aria-label={t("kids.stem.innovation.phases")}>
            {INNOVATION_PHASES.map((p, i) => (
              <li key={p} aria-current={i === step ? "step" : undefined}
                className={`flex items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-semibold ${i === step ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : i < step ? "border-kids-green/40 text-kids-green" : "border-border text-muted-foreground"}`}>
                <span aria-hidden="true">{INNOVATION_PHASE_EMOJI[p]}</span> {t(`kids.stem.innovation.phase.${p}`)}
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-2xl border-2 border-border bg-card p-5">
            <p className="font-heading text-lg font-bold">
              <span aria-hidden="true">{INNOVATION_PHASE_EMOJI[phase]}</span> {t(`kids.stem.innovation.phase.${phase}`)}
            </p>
            {hints[step] && <p className="mt-1 text-sm text-muted-foreground">💭 {hints[step]}</p>}

            {phase === "problem" && (
              <p className="mt-3 rounded-xl bg-muted p-3 text-sm">{challenge.problem}</p>
            )}
            {phase === "idea" && (
              <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} maxLength={500}
                placeholder={t("kids.stem.innovation.ideaPlaceholder")}
                className="mt-3 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
            )}
            {phase === "solution" && (
              <textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={3} maxLength={500}
                placeholder={t("kids.stem.innovation.solutionPlaceholder")}
                className="mt-3 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
            )}
            {phase === "prototype" && (
              <textarea value={prototype} onChange={(e) => setPrototype(e.target.value)} rows={3} maxLength={500}
                placeholder={t("kids.stem.innovation.prototypePlaceholder")}
                className="mt-3 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
            )}
            {phase === "present" && (
              <div className="mt-3">
                <label className="block text-sm font-semibold">
                  {t("kids.stem.innovation.projectName")}
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
                    placeholder={t("kids.stem.innovation.namePlaceholder")}
                    className="mt-1 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
                </label>
                {!user && <p className="mt-2 text-sm text-muted-foreground">{t("kids.stem.signInHint")}</p>}
              </div>
            )}
          </div>

          {/* Nav */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-4 py-2 font-semibold hover:border-kids-primary/50 disabled:opacity-40">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t("kids.stem.innovation.back")}
            </button>
            {isLast ? (
              <button type="button" onClick={onSubmit} disabled={!user || !title.trim() || submit.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-6 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50">
                <Send className="h-4 w-4" aria-hidden="true" /> {t("kids.stem.innovation.submit")}
              </button>
            ) : (
              <button type="button" onClick={() => setStep((s) => Math.min(INNOVATION_PHASES.length - 1, s + 1))}
                className="inline-flex items-center gap-1.5 rounded-full bg-kids-primary px-6 py-2 font-bold text-white hover:opacity-90">
                {t("kids.stem.innovation.next")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
