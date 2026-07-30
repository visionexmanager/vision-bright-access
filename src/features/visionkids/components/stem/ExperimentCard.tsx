import { Link } from "react-router-dom";
import { CheckCircle2, FlaskConical, Play, Calculator } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { STEM_COLOR_CLASSES } from "@/features/visionkids/data/stemConfig";
import type { Experiment } from "@/features/visionkids/types/stem.types";

const KIND_ICON = {
  experiment: FlaskConical,
  simulation: Play,
  activity: Calculator,
} as const;

export function ExperimentCard({ experiment, done }: { experiment: Experiment; done?: boolean }) {
  const { t } = useLanguage();
  const Icon = KIND_ICON[experiment.kind] ?? FlaskConical;

  return (
    <Link
      to={`/kids/stem/experiment/${experiment.lab}/${experiment.slug}`}
      className={`relative flex flex-col gap-2 rounded-2xl border-2 p-4 transition-transform hover:scale-[1.02] ${STEM_COLOR_CLASSES[experiment.color]}`}
    >
      {done && (
        <CheckCircle2 className="absolute end-3 top-3 h-5 w-5 text-kids-green" aria-label={t("kids.stem.done")} />
      )}
      <div className="flex items-center gap-2">
        <span className="text-3xl" aria-hidden="true">{experiment.emoji}</span>
        <p className="font-heading text-base font-bold leading-tight">{experiment.title}</p>
      </div>
      {experiment.summary && <p className="text-sm text-foreground/70">{experiment.summary}</p>}
      <div className="mt-auto flex items-center gap-2 pt-1 text-xs font-semibold text-foreground/60">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t(`kids.stem.kind.${experiment.kind}`)}</span>
        <span aria-hidden="true">·</span>
        <span>{t(`kids.stem.difficulty.${experiment.difficulty}`)}</span>
      </div>
    </Link>
  );
}
