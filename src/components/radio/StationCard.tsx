import { Radio, Play, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RadioStation } from "@/hooks/useRadioSubscription";

type Props = {
  station:      RadioStation;
  isSubscribed: boolean;
  isSelected?:  boolean;
  onClick:      (station: RadioStation) => void;
};

const bitrateColor: Record<string, string> = {
  "64":  "bg-gray-500/20 text-gray-400",
  "128": "bg-blue-500/20 text-blue-400",
  "192": "bg-purple-500/20 text-purple-400",
  "320": "bg-orange-500/20 text-orange-400",
  "HI":  "bg-yellow-500/20 text-yellow-400",
};

export function StationCard({ station, isSubscribed, isSelected, onClick }: Props) {
  const { dir } = useLanguage();
  const isRTL = dir === "rtl";

  const displayName  = isRTL ? (station.name_ar || station.name) : (station.name || station.name_ar);
  const displayGenre = station.genre
    ? isRTL
      ? (station.genre.name_ar || station.genre.name)
      : (station.genre.name    || station.genre.name_ar)
    : null;

  return (
    <button
      onClick={() => onClick(station)}
      className={cn(
        "relative flex items-center gap-3 w-full rounded-xl p-3 transition-all duration-200 border",
        isRTL ? "text-right" : "text-left",
        "hover:scale-[1.02] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        isSelected
          ? "border-orange-500 bg-orange-500/10 shadow-md shadow-orange-500/20"
          : "border-border bg-card hover:border-orange-400/40 hover:bg-muted/50"
      )}
      aria-label={[
        displayName,
        displayGenre,
        station.bitrate === "HI" ? "HI-FI" : `${station.bitrate} kbps`,
        !isSubscribed ? "🔒" : undefined,
      ].filter(Boolean).join(" — ")}
      aria-pressed={isSelected}
    >
      {/* Playing pulse indicator */}
      {isSelected && (
        <span aria-hidden="true" className={cn("absolute top-2 flex gap-0.5 items-end h-4", isRTL ? "left-2" : "right-2")}>
          {[0, 0.15, 0.3].map(delay => (
            <span
              key={delay}
              className="w-0.5 bg-orange-400 rounded-full animate-bounce"
              style={{ height: `${8 + Math.random() * 8}px`, animationDelay: `${delay}s` }}
            />
          ))}
        </span>
      )}

      {/* Logo / fallback */}
      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center" aria-hidden="true">
        {station.logo_url ? (
          <img src={station.logo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Radio className="w-6 h-6 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-foreground">{displayName}</p>
        {displayGenre && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate" aria-hidden="true">{displayGenre}</p>
        )}
      </div>

      {/* Bitrate badge */}
      <span aria-hidden="true" className={cn(
        "text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0",
        bitrateColor[station.bitrate] ?? bitrateColor["128"]
      )}>
        {station.bitrate === "HI" ? "HI-FI" : `${station.bitrate}k`}
      </span>

      {/* Lock or Play indicator */}
      {isSubscribed ? (
        isSelected ? (
          <Play className="w-4 h-4 text-orange-400 flex-shrink-0 fill-orange-400" aria-hidden="true" />
        ) : (
          <Play className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" aria-hidden="true" />
        )
      ) : (
        <Lock className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
