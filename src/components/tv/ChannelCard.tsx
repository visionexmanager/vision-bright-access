import { Tv, Play, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TVChannel } from "@/hooks/useTVSubscription";

type Props = {
  channel:      TVChannel;
  isSubscribed: boolean;
  isSelected?:  boolean;
  onClick:      (channel: TVChannel) => void;
};

const qualityColor: Record<string, string> = {
  SD:  "bg-gray-500/20 text-gray-400",
  HD:  "bg-blue-500/20 text-blue-400",
  FHD: "bg-purple-500/20 text-purple-400",
  "4K":"bg-yellow-500/20 text-yellow-400",
};

export function ChannelCard({ channel, isSubscribed, isSelected, onClick }: Props) {
  const { dir } = useLanguage();
  const isRTL = dir === "rtl";

  // Show Arabic name in RTL languages, English name otherwise
  const displayName     = isRTL ? (channel.name_ar || channel.name) : (channel.name || channel.name_ar);
  const displayCategory = channel.category
    ? isRTL
      ? (channel.category.name_ar || channel.category.name)
      : (channel.category.name    || channel.category.name_ar)
    : null;

  return (
    <button
      onClick={() => onClick(channel)}
      className={cn(
        "relative flex items-center gap-3 w-full rounded-xl p-3 transition-all duration-200 border",
        isRTL ? "text-right" : "text-left",
        "hover:scale-[1.02] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        isSelected
          ? "border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/20"
          : "border-border bg-card hover:border-blue-400/40 hover:bg-muted/50"
      )}
      aria-label={[
        displayName,
        displayCategory,
        channel.quality,
        !isSubscribed ? "🔒" : undefined,
      ].filter(Boolean).join(" — ")}
      aria-pressed={isSelected}
    >
      {/* Logo / fallback */}
      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center" aria-hidden="true">
        {channel.logo_url ? (
          <img src={channel.logo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Tv className="w-6 h-6 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-foreground">{displayName}</p>
        {displayCategory && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate" aria-hidden="true">{displayCategory}</p>
        )}
      </div>

      {/* Quality badge */}
      <span aria-hidden="true" className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0", qualityColor[channel.quality] ?? qualityColor.HD)}>
        {channel.quality}
      </span>

      {/* Lock or Play indicator */}
      {isSubscribed ? (
        isSelected ? (
          <Play className="w-4 h-4 text-blue-400 flex-shrink-0 fill-blue-400" aria-hidden="true" />
        ) : (
          <Play className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" aria-hidden="true" />
        )
      ) : (
        <Lock className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
