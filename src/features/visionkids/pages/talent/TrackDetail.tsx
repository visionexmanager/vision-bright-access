import { useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { CheckCircle2, Circle, BookOpen, Gamepad2, Rocket } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useTalentTrack, useTrackModules } from "@/features/visionkids/hooks/talent/useTalentCatalog";
import { useMyModuleProgress } from "@/features/visionkids/hooks/talent/useTrackProgress";
import { TALENT_COLOR_CLASSES } from "@/features/visionkids/data/talentConfig";
import { TalentHeader } from "@/features/visionkids/components/talent/TalentHeader";
import type { ModuleKind } from "@/features/visionkids/types/talent.types";

const KIND_ICON: Record<ModuleKind, typeof BookOpen> = {
  lesson: BookOpen,
  activity: Gamepad2,
  project: Rocket,
};

/** Generic detail page shared by all 10 Talent Academy tracks (Coding,
 *  Robotics, AI, Music, Art, Writing, Public Speaking, Entrepreneurship,
 *  Financial Literacy, Innovation Lab) — driven entirely by :trackSlug, same
 *  discipline as Explorer's world template. Adding an 11th track needs no
 *  new route or page. */
export default function TrackDetail() {
  const { trackSlug } = useParams<{ trackSlug: string }>();
  const { t } = useLanguage();

  const { data: track, isLoading: trackLoading } = useTalentTrack(trackSlug);
  const { data: modules = [], isLoading: modulesLoading } = useTrackModules(trackSlug);
  const { data: progress = [] } = useMyModuleProgress(trackSlug);

  useDocumentHead({
    title: track ? `${track.title} — VisionKids` : t("kids.talent.heroTitle"),
    description: track?.description ?? t("kids.talent.meta.description"),
    canonicalPath: `/kids/talent/track/${trackSlug ?? ""}`,
  });

  const doneSet = useMemo(() => new Set(progress.map((p) => p.module_id)), [progress]);
  const donePct = modules.length ? Math.round((doneSet.size / modules.length) * 100) : 0;

  if (trackLoading || modulesLoading) {
    return <div className="mx-auto max-w-2xl px-4 py-10"><div className="h-72 animate-pulse rounded-3xl bg-muted" /></div>;
  }
  if (!track) return <Navigate to="/kids/talent" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <TalentHeader emoji={track.emoji} title={track.title} subtitle={track.description ?? undefined} />

      <div className="mt-5 rounded-2xl border-2 border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>{t("kids.talent.track.progress")}</span>
          <span className="tabular-nums text-muted-foreground">{doneSet.size}/{modules.length} · {donePct}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={donePct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-kids-primary transition-all" style={{ width: `${donePct}%` }} />
        </div>
        {donePct === 100 && <p className="mt-2 text-sm font-semibold text-kids-green">🎉 {t("kids.talent.track.completed")}</p>}
      </div>

      <ol className="mt-6 space-y-2">
        {modules.map((m, i) => {
          const done = doneSet.has(m.id);
          const Icon = KIND_ICON[m.kind];
          return (
            <li key={m.id}>
              <Link
                to={`/kids/talent/track/${track.slug}/${m.slug}`}
                className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-transform hover:scale-[1.01] ${done ? "border-kids-green/40 bg-kids-green/5" : "border-border bg-card"}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${TALENT_COLOR_CLASSES[track.color]}`}>{i + 1}</span>
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-heading font-bold">
                    <span aria-hidden="true">{m.emoji}</span> {m.title}
                  </span>
                  {m.description && <span className="text-xs text-muted-foreground">{m.description}</span>}
                </span>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {done
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 text-kids-green" aria-hidden="true" />
                  : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
