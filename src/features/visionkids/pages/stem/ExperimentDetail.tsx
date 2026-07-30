import { useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useExperiment } from "@/features/visionkids/hooks/stem/useStemCatalog";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";
import { ExperimentRunner } from "@/features/visionkids/components/stem/ExperimentRunner";

export default function ExperimentDetail() {
  const { lab, slug } = useParams<{ lab: string; slug: string }>();
  const { t } = useLanguage();
  const { data: experiment, isLoading } = useExperiment(lab, slug);

  useDocumentHead({
    title: experiment ? `${experiment.title} — VisionKids` : t("kids.stem.heroTitle"),
    description: experiment?.summary ?? t("kids.stem.meta.description"),
    canonicalPath: `/kids/stem/experiment/${lab}/${slug}`,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {isLoading ? (
        <div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />
      ) : !experiment ? (
        <div className="py-20 text-center">
          <StemHeader emoji="🔬" title={t("kids.stem.notFound")} backTo={`/kids/stem/${lab ?? ""}`} />
        </div>
      ) : (
        <>
          <StemHeader
            emoji={experiment.emoji}
            title={experiment.title}
            subtitle={experiment.summary ?? undefined}
            backTo={`/kids/stem/${experiment.lab}`}
            backLabelKey="kids.stem.experiment.backToLab"
          />
          <div className="mt-6">
            <ExperimentRunner experiment={experiment} />
          </div>
        </>
      )}
    </div>
  );
}
