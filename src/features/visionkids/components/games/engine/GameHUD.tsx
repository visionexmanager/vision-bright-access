import { Heart, Lightbulb, Pause, Timer as TimerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GameEngineState } from "@/features/visionkids/types/games.types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface GameHUDProps {
  state: GameEngineState;
  hasLives?: boolean;
  hasHints?: boolean;
  onHint?: () => void;
  onPause: () => void;
}

export function GameHUD({ state, hasLives, hasHints, onHint, onPause }: GameHUDProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card px-4 py-2.5" role="status" aria-label={t("kids.games.hud")}>
      <div className="flex items-center gap-4">
        <span className="font-heading text-lg font-bold text-kids-primary" aria-live="polite">
          {t("kids.games.score")}: {state.score}
        </span>
        {state.timeLeftSeconds !== null && (
          <span className={`flex items-center gap-1 font-semibold ${state.timeLeftSeconds <= 10 ? "text-destructive" : ""}`} aria-live="polite">
            <TimerIcon className="h-4 w-4" aria-hidden="true" /> {formatTime(state.timeLeftSeconds)}
          </span>
        )}
        {hasLives && (
          <span className="flex items-center gap-0.5" aria-label={`${state.lives} ${t("kids.games.livesLeft")}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart key={i} className={`h-4 w-4 ${i < state.lives ? "fill-kids-pink text-kids-pink" : "text-muted-foreground"}`} aria-hidden="true" />
            ))}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {hasHints && onHint && (
          <Button variant="outline" size="sm" onClick={onHint} disabled={state.hints <= 0} className="gap-1">
            <Lightbulb className="h-4 w-4" aria-hidden="true" /> {state.hints}
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onPause} aria-label={t("kids.games.pause")}>
          <Pause className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
