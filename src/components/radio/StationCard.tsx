import { Radio, Play, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
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
  return (
    <button
      onClick={() => onClick(station)}
      className={cn(
        "relative flex items-center gap-3 w-full rounded-xl p-3 text-right transition-all duration-200 border",
        "hover:scale-[1.02] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        isSelected
          ? "border-orange-500 bg-orange-500/10 shadow-md shadow-orange-500/20"
          : "border-border bg-card hover:border-orange-400/40 hover:bg-muted/50"
      )}
      aria-label={`${station.name_ar} — ${station.bitrate} kbps`}
    >
      {/* Playing pulse indicator */}
      {isSelected && (
        <span className="absolute top-2 left-2 flex gap-0.5 items-end h-4">
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
      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        {station.logo_url ? (
          <img src={station.logo_url} alt={station.name_ar} className="w-full h-full object-cover" />
        ) : (
          <Radio className="w-6 h-6 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-right">
        <p className="font-semibold text-sm truncate text-foreground">{station.name_ar}</p>
        {station.genre && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{station.genre.name_ar}</p>
        )}
      </div>

      {/* Bitrate badge */}
      <span className={cn(
        "text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0",
        bitrateColor[station.bitrate] ?? bitrateColor["128"]
      )}>
        {station.bitrate === "HI" ? "HI-FI" : `${station.bitrate}k`}
      </span>

      {/* Lock or Play indicator */}
      {isSubscribed ? (
        isSelected ? (
          <Play className="w-4 h-4 text-orange-400 flex-shrink-0 fill-orange-400" />
        ) : (
          <Play className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
        )
      ) : (
        <Lock className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
      )}
    </button>
  );
}
