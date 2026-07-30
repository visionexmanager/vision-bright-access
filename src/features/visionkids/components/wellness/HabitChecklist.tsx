import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { WELLNESS_COLOR_CLASSES } from "@/features/visionkids/data/wellnessConfig";
import type { WellnessHabit } from "@/features/visionkids/types/wellness.types";

/** Tappable checklist of habits/routine steps. `doneSet` holds the slugs
 *  already logged today; tapping an undone item calls onToggle (logging is
 *  one-way — you can't "un-do" a completed habit, matching the reward model). */
export function HabitChecklist({
  habits,
  doneSet,
  onToggle,
  disabled,
}: {
  habits: WellnessHabit[];
  doneSet: Set<string>;
  onToggle: (slug: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <ul className="space-y-2">
      {habits.map((h) => {
        const done = doneSet.has(h.slug);
        return (
          <li key={h.slug}>
            <button
              type="button"
              onClick={() => !done && onToggle(h.slug)}
              disabled={disabled || done}
              aria-pressed={done}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-start transition-colors disabled:cursor-default ${
                done ? "border-kids-green/40 bg-kids-green/5" : `${WELLNESS_COLOR_CLASSES[h.color]} hover:brightness-95`
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{h.emoji}</span>
              <span className="flex-1">
                <span className="font-heading font-bold">{h.title}</span>
                {h.description && <span className="block text-xs text-foreground/70">{h.description}</span>}
              </span>
              {done ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-kids-green" aria-hidden="true" />
              ) : (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground/70">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{h.reward_xp}
                  <Circle className="ms-1 h-5 w-5" aria-hidden="true" />
                </span>
              )}
            </button>
          </li>
        );
      })}
      {habits.length === 0 && <li className="text-sm text-muted-foreground">{t("kids.wellness.habits.none")}</li>}
    </ul>
  );
}
