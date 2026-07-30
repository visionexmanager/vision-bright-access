import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { slideUp, bounceIn } from "@/features/visionkids/utils/animations";
import { useAssessmentQuestions, useSubmitAssessment } from "@/features/visionkids/hooks/talent/useAssessment";
import { useTalentDomains } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";

export default function TalentAssessment() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const reduced = useKidsReducedMotion();

  const { data: questions = [], isLoading } = useAssessmentQuestions();
  const { data: domains = [] } = useTalentDomains();
  const submit = useSubmitAssessment();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [topDomains, setTopDomains] = useState<string[] | null>(null);

  useDocumentHead({
    title: `${t("kids.talent.nav.assessment")} — VisionKids`,
    description: t("kids.talent.assessment.subtitle"),
    canonicalPath: "/kids/talent/assessment",
  });

  const domainTitle = (slug: string) => domains.find((d) => d.slug === slug)?.title ?? slug;
  const domainEmoji = (slug: string) => domains.find((d) => d.slug === slug)?.emoji ?? "⭐";

  const current = questions[step];
  const progressPct = questions.length ? Math.round((step / questions.length) * 100) : 0;

  function choose(optionId: string) {
    if (!current) return;
    const next = { ...answers, [current.id]: optionId };
    setAnswers(next);
    if (step + 1 < questions.length) {
      setStep(step + 1);
    } else {
      finish(next);
    }
  }

  async function finish(finalAnswers: Record<string, string>) {
    try {
      const res = await submit.mutateAsync({ questions, answers: finalAnswers });
      setTopDomains(res.topDomains);
    } catch {
      // Not signed in / offline — still show a local result from the answers.
      const scores: Record<string, number> = {};
      for (const q of questions) {
        const opt = q.options.find((o) => o.id === finalAnswers[q.id]);
        if (!opt) continue;
        for (const [d, w] of Object.entries(opt.weights)) scores[d] = (scores[d] ?? 0) + w;
      }
      setTopDomains(Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d));
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <TalentHeader emoji="🧭" title={t("kids.talent.nav.assessment")} subtitle={t("kids.talent.assessment.subtitle")} />

      {!user && (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-card p-3 text-sm text-muted-foreground" role="status">
          {t("kids.talent.assessment.signInHint")}
        </p>
      )}

      {topDomains ? (
        <motion.section initial="hidden" animate="visible" variants={bounceIn(reduced)} className="mt-6 rounded-3xl border-2 border-kids-primary/30 bg-kids-primary/5 p-6 text-center">
          <p className="text-5xl" aria-hidden="true">🎉</p>
          <h2 className="mt-2 font-heading text-2xl font-extrabold">{t("kids.talent.assessment.resultTitle")}</h2>
          <p className="mt-1 text-muted-foreground">{t("kids.talent.assessment.resultSubtitle")}</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {topDomains.map((d, i) => (
              <li key={d} className="flex items-center gap-1.5 rounded-full border-2 border-kids-primary/40 bg-background px-3 py-1.5 font-semibold">
                <span aria-hidden="true">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                <span aria-hidden="true">{domainEmoji(d)}</span> {domainTitle(d)}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/kids/talent/my-talents" className="rounded-full bg-kids-primary px-5 py-2.5 font-bold text-white hover:opacity-90">
              🌟 {t("kids.talent.nav.myTalents")}
            </Link>
            <Link to="/kids/talent/skill-tree" className="rounded-full border-2 border-border px-5 py-2.5 font-bold hover:border-kids-primary/50">
              🌳 {t("kids.talent.nav.skillTree")}
            </Link>
          </div>
        </motion.section>
      ) : isLoading || !current ? (
        <div className="mt-6 h-64 animate-pulse rounded-3xl bg-muted" aria-busy="true" />
      ) : (
        <div className="mt-6">
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-kids-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("kids.talent.assessment.question")} {step + 1} / {questions.length}
          </p>

          <AnimatePresence mode="wait">
            <motion.div key={current.id} initial="hidden" animate="visible" exit="hidden" variants={slideUp(reduced)}>
              <h2 className="mt-2 font-heading text-2xl font-bold">
                <span aria-hidden="true">{current.emoji}</span> {current.prompt}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {current.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => choose(opt.id)}
                    disabled={submit.isPending}
                    className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-start transition-colors hover:border-kids-primary hover:bg-kids-primary/5 disabled:opacity-60"
                  >
                    <span className="text-2xl" aria-hidden="true">{opt.emoji}</span>
                    <span className="font-semibold">{opt.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
