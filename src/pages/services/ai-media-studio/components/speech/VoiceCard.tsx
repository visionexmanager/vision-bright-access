import { Star, StarOff, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SpeechVoice } from "@/lib/types/speech-studio";

const GENDER_COLORS = {
  male:    "bg-blue-500/10 text-blue-600",
  female:  "bg-pink-500/10 text-pink-600",
  neutral: "bg-violet-500/10 text-violet-600",
};

const CATEGORY_COLORS: Record<string, string> = {
  general:   "bg-muted text-muted-foreground",
  education: "bg-green-500/10 text-green-600",
  creative:  "bg-violet-500/10 text-violet-600",
  news:      "bg-orange-500/10 text-orange-600",
  media:     "bg-pink-500/10 text-pink-600",
  tech:      "bg-blue-500/10 text-blue-600",
  wellness:  "bg-teal-500/10 text-teal-600",
  assistant: "bg-amber-500/10 text-amber-600",
};

const VOICE_GRADIENTS: Record<string, string> = {
  "openai-alloy":   "from-slate-400 to-slate-600",
  "openai-echo":    "from-blue-400 to-blue-700",
  "openai-fable":   "from-violet-400 to-purple-700",
  "openai-nova":    "from-pink-400 to-rose-600",
  "openai-onyx":    "from-gray-500 to-gray-900",
  "openai-shimmer": "from-amber-300 to-orange-500",
  "openai-ash":     "from-sky-400 to-cyan-600",
  "openai-ballad":  "from-indigo-400 to-purple-600",
  "openai-coral":   "from-rose-400 to-red-600",
  "openai-sage":    "from-teal-400 to-emerald-600",
};

interface Props {
  voice: SpeechVoice;
  isSelected?: boolean;
  onSelect: (voice: SpeechVoice) => void;
  onToggleFavorite: (voiceId: string, isFav: boolean) => void;
  compact?: boolean;
}

export function VoiceCard({ voice, isSelected, onSelect, onToggleFavorite, compact = false }: Props) {
  const gradient = VOICE_GRADIENTS[voice.id] ?? "from-primary/60 to-primary";
  const initials = voice.name.slice(0, 2).toUpperCase();

  if (compact) {
    return (
      <button
        onClick={() => onSelect(voice)}
        className={cn(
          "group flex items-center gap-3 w-full rounded-xl border p-3 text-left transition-all hover:shadow-sm",
          isSelected
            ? "border-primary/60 bg-primary/5"
            : "border-border hover:border-primary/30 hover:bg-muted/30"
        )}
        aria-pressed={isSelected}
      >
        <div className={cn("h-9 w-9 shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold", gradient)}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold truncate", isSelected && "text-primary")}>{voice.name}</p>
          <p className="text-xs text-muted-foreground truncate capitalize">
            {voice.gender ?? "neutral"} · {voice.accent ?? "american"}
          </p>
        </div>
        {voice.is_favorite && (
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card transition-all hover:shadow-md cursor-pointer overflow-hidden",
        isSelected ? "border-primary/60 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
      )}
      onClick={() => onSelect(voice)}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(e) => e.key === "Enter" && onSelect(voice)}
    >
      {/* Color banner */}
      <div className={cn("h-16 bg-gradient-to-br relative flex items-center px-4", gradient)}>
        <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
          {initials}
        </div>
        {/* Favorite button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(voice.id, voice.is_favorite ?? false); }}
          className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors"
          aria-label={voice.is_favorite ? "Remove from favorites" : "Add to favorites"}
        >
          {voice.is_favorite ? (
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          ) : (
            <StarOff className="h-4 w-4" />
          )}
        </button>
        {voice.is_recent && (
          <Badge className="absolute bottom-2 right-2 text-[9px] px-1.5 py-0 bg-white/20 text-white border-white/30">
            Recent
          </Badge>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn("text-sm font-semibold leading-tight", isSelected && "text-primary")}>
              {voice.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {voice.accent ?? "american"} · {voice.age_style ?? "middle"}
            </p>
          </div>
          {voice.gender && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 capitalize shrink-0", GENDER_COLORS[voice.gender])}>
              {voice.gender}
            </Badge>
          )}
        </div>

        {voice.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {voice.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 capitalize", CATEGORY_COLORS[voice.category] ?? CATEGORY_COLORS.general)}>
            {voice.category}
          </Badge>
          {voice.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
              {t}
            </Badge>
          ))}
        </div>

        {isSelected && (
          <div className="flex items-center gap-1 text-xs text-primary font-medium">
            <Volume2 className="h-3 w-3" />
            Selected
          </div>
        )}
      </div>
    </div>
  );
}
