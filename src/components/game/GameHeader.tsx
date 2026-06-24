import { Link } from "react-router-dom";
import { ArrowLeft, Volume2, VolumeX, Pause, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSound } from "@/contexts/SoundContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface GameHeaderProps {
  title: string;
  score?: number;
  highScore?: number;
  isPaused?: boolean;
  onPause?: () => void;
  extra?: React.ReactNode;
}

export function GameHeader({
  title, score, highScore, isPaused, onPause, extra,
}: GameHeaderProps) {
  const { enabled, setEnabled } = useSound();
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
        <Link to="/games">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t("games.backToGames")}</span>
        </Link>
      </Button>

      <h1 className="text-lg font-bold tracking-tight">{title}</h1>

      <div className="flex items-center gap-1.5 flex-wrap">
        {highScore !== undefined && highScore > 0 && (
          <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-400/40">
            <Trophy className="h-3 w-3" aria-hidden="true" />
            {highScore.toLocaleString()}
          </Badge>
        )}
        {score !== undefined && (
          <Badge className="gap-1">⭐ {score.toLocaleString()}</Badge>
        )}
        {extra}
        {onPause && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPause}
            aria-label={isPaused ? t("games.resume") : t("games.pause")}
          >
            {isPaused
              ? <Play className="h-4 w-4" aria-hidden="true" />
              : <Pause className="h-4 w-4" aria-hidden="true" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setEnabled(!enabled)}
          aria-label={enabled ? t("nav.muteSounds") : t("nav.unmuteSounds")}
        >
          {enabled
            ? <Volume2 className="h-4 w-4" aria-hidden="true" />
            : <VolumeX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
