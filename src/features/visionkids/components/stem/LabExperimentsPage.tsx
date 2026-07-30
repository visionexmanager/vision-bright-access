import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useExperiments } from "@/features/visionkids/hooks/stem/useStemCatalog";
import { useExperimentProgress } from "@/features/visionkids/hooks/stem/useStemEngagement";
import { LAB_CONCEPTS } from "@/features/visionkids/data/stemConfig";
import { StemHeader } from "@/features/visionkids/components/stem/StemHeader";
import { ExperimentCard } from "@/features/visionkids/components/stem/ExperimentCard";

/** Generic list page shared by all 8 "list" labs (Science, Physics, Chemistry,
 *  Biology, Math, Engineering, Electronics, Space) — one component, driven by
 *  props + the LAB_CONCEPTS config (same discipline as Explorer's world
 *  template and Wellness' CategoryLessonsPage). Scales to thousands of
 *  experiments with zero new code — a new experiment is a catalog row. */
export function LabExperimentsPage({
  lab,
  emoji,
  title,
  subtitle,
  canonicalPath,
}: {
  lab: string;
  emoji: string;
  title: string;
  subtitle?: string;
  canonicalPath: string;
}) {
  const { t } = useLanguage();
  const [topic, setTopic] = useState("all");
  const { data: experiments = [], isLoading } = useExperiments(lab);
  const { data: progress = [] } = useExperimentProgress();

  const doneIds = useMemo(
    () => new Set(progress.filter((p) => p.completed).map((p) => p.experiment_id)),
    [progress],
  );

  const tabs = LAB_CONCEPTS[lab] ?? [];
  const visible = topic === "all" ? experiments : experiments.filter((e) => e.topic === topic);

  useDocumentHead({ title: `${title} — VisionKids`, description: subtitle ?? t("kids.stem.meta.description"), canonicalPath });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <StemHeader emoji={emoji} title={title} subtitle={subtitle} />

      {tabs.length > 0 && (
        <nav aria-label={t("kids.stem.conceptsLabel")} className="mt-5 flex flex-wrap gap-2">
          {[{ value: "all", labelKey: "kids.stem.all" }, ...tabs].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTopic(tab.value)}
              aria-current={topic === tab.value ? "true" : undefined}
              className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition-colors ${
                topic === tab.value ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border hover:border-kids-primary/50"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">{t("kids.stem.noExperiments")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} done={doneIds.has(exp.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
