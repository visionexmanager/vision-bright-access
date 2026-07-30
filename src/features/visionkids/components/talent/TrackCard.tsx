import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { TALENT_COLOR_CLASSES } from "@/features/visionkids/data/talentConfig";
import type { TalentTrack } from "@/features/visionkids/types/talent.types";

/** A track tile for the hub / tracks grid. When `progress` is provided it
 *  renders a small completion bar. */
export function TrackCard({
  track,
  progress,
}: {
  track: TalentTrack;
  progress?: { done: number; total: number };
}) {
  const { t } = useLanguage();
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Link
      to={`/kids/talent/track/${track.slug}`}
      className={`flex flex-col gap-2 rounded-2xl border-2 p-4 transition-transform hover:scale-[1.02] ${TALENT_COLOR_CLASSES[track.color]}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-3xl" aria-hidden="true">{track.emoji}</span>
        <p className="font-heading text-base font-bold leading-tight">{track.title}</p>
      </div>
      {track.description && <p className="text-sm text-foreground/70">{track.description}</p>}

      {progress && progress.total > 0 && (
        <div className="mt-1">
          <div className="h-2 overflow-hidden rounded-full bg-background/60" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-current transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs font-medium text-foreground/70">
            {progress.done}/{progress.total} · {pct}%{pct === 100 ? ` ${t("kids.talent.track.completed")}` : ""}
          </p>
        </div>
      )}
    </Link>
  );
}
