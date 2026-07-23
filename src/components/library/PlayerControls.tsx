import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";

interface PlayerControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  positionSeconds: number;
  durationSeconds: number;
  onSeek: (deltaSeconds: number) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

const RATES = [1, 1.25, 1.5, 2];

export function PlayerControls({
  isPlaying, onTogglePlay, positionSeconds, durationSeconds, onSeek, playbackRate, onPlaybackRateChange,
}: PlayerControlsProps) {
  const { t } = useLanguage();
  const pct = durationSeconds > 0 ? (positionSeconds / durationSeconds) * 100 : 0;

  return (
    <div role="group" aria-label={t("library.player.controls")} className="space-y-3 rounded-xl border bg-card p-4">
      <Progress value={pct} aria-label={`${formatTime(positionSeconds)} / ${formatTime(durationSeconds)}`} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatTime(positionSeconds)}</span>
        <span>{formatTime(durationSeconds)}</span>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => onSeek(-15)} aria-label={t("library.player.back15")}>
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button size="icon" className="h-12 w-12 rounded-full" onClick={onTogglePlay} aria-label={isPlaying ? t("library.player.pause") : t("library.player.play")}>
          {isPlaying ? <Pause className="h-6 w-6" aria-hidden="true" /> : <Play className="h-6 w-6" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onSeek(15)} aria-label={t("library.player.forward15")}>
          <RotateCw className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex items-center justify-center gap-1" role="group" aria-label={t("library.player.speed")}>
        {RATES.map((rate) => (
          <Button
            key={rate}
            variant={playbackRate === rate ? "default" : "outline"}
            size="sm"
            onClick={() => onPlaybackRateChange(rate)}
            aria-pressed={playbackRate === rate}
          >
            {rate}x
          </Button>
        ))}
      </div>
    </div>
  );
}
