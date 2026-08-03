import { useLanguage } from "@/contexts/LanguageContext";
import { DIFFICULTY_ORDER } from "../catalog";
import type { Difficulty } from "../types";

const LABEL_KEY: Record<Difficulty, string> = {
  starter: "sc.level.starter",
  intermediate: "sc.level.intermediate",
  advanced: "sc.level.advanced",
  expert: "sc.level.expert",
};

const BAR_CLASS: Record<Difficulty, string> = {
  starter: "bg-emerald-500",
  intermediate: "bg-sky-500",
  advanced: "bg-amber-500",
  expert: "bg-rose-500",
};

/**
 * Four bars rather than a word alone, so difficulty is comparable at a glance.
 * The text label is always present for screen readers and for anyone who
 * cannot distinguish the fill colours.
 */
export function DifficultyMeter({
  difficulty,
  showLabel = true,
}: {
  difficulty: Difficulty;
  showLabel?: boolean;
}) {
  const { t } = useLanguage();
  const filled = DIFFICULTY_ORDER[difficulty];
  const label = t(LABEL_KEY[difficulty]);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`w-1 rounded-sm ${
              step <= filled ? BAR_CLASS[difficulty] : "bg-muted-foreground/25"
            }`}
            style={{ height: `${4 + step * 2}px` }}
          />
        ))}
      </span>
      {showLabel ? (
        <span>{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}
