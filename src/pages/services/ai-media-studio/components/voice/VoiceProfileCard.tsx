import {
  Star, MoreHorizontal, Mic2, CheckCircle2, XCircle,
  Loader2, Archive, Copy, Pencil, Trash2, RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { VoiceProfile } from "@/lib/types/voice-studio";

const STATUS_CONFIG = {
  draft:     { label: "Draft",    color: "bg-muted text-muted-foreground",         icon: null },
  training:  { label: "Training", color: "bg-blue-500/10 text-blue-600",           icon: Loader2 },
  completed: { label: "Ready",    color: "bg-green-500/10 text-green-600",         icon: CheckCircle2 },
  failed:    { label: "Failed",   color: "bg-destructive/10 text-destructive",     icon: XCircle },
  archived:  { label: "Archived", color: "bg-muted/50 text-muted-foreground/60",  icon: Archive },
} as const;

const GENDER_ICON: Record<string, string> = {
  male:    "♂",
  female:  "♀",
  neutral: "⊙",
};

const PROFILE_GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-cyan-600",
  "from-rose-500 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-teal-500 to-emerald-700",
  "from-indigo-500 to-blue-700",
  "from-red-500 to-rose-700",
  "from-green-500 to-teal-600",
];

function profileGradient(id: string): string {
  const idx = id.charCodeAt(0) % PROFILE_GRADIENTS.length;
  return PROFILE_GRADIENTS[idx];
}

interface Props {
  profile: VoiceProfile;
  onClick: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore?: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export function VoiceProfileCard({
  profile, onClick, onRename, onDuplicate, onArchive, onRestore, onDelete, onToggleFavorite,
}: Props) {
  const cfg     = STATUS_CONFIG[profile.status];
  const gradient = profileGradient(profile.id);
  const initials = profile.name.slice(0, 2).toUpperCase();
  const StatusIcon = cfg.icon;

  const isArchived = profile.status === "archived";
  const isTraining = profile.status === "training";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-card cursor-pointer",
        "hover:shadow-md transition-all duration-200 overflow-hidden",
        isArchived && "opacity-60"
      )}
    >
      {/* Banner */}
      <div className={cn("relative h-20 bg-gradient-to-br flex items-end px-4 pb-3", gradient)}>
        {/* Avatar */}
        <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg border border-white/30">
          {initials}
        </div>
        {/* Favorite */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="absolute top-3 left-3 text-white/70 hover:text-white transition-colors"
          aria-label={profile.is_favorite ? "Remove favorite" : "Add to favorites"}
        >
          <Star className={cn("h-4 w-4", profile.is_favorite && "fill-amber-400 text-amber-400")} />
        </button>
        {/* Menu */}
        <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/20"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onRename}>
                <Pencil className="h-3.5 w-3.5 mr-2" />Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isArchived ? (
                <DropdownMenuItem onClick={onRestore}>
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="h-3.5 w-3.5 mr-2" />Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Training progress bar */}
        {isTraining && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-white/70 animate-pulse w-2/3 rounded-full" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{profile.name}</h3>
            {profile.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{profile.description}</p>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0 shrink-0 flex items-center gap-1", cfg.color)}
          >
            {StatusIcon && (
              <StatusIcon className={cn("h-2.5 w-2.5", isTraining && "animate-spin")} />
            )}
            {cfg.label}
          </Badge>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {profile.gender && (
            <span className="flex items-center gap-0.5">
              <span className="text-sm">{GENDER_ICON[profile.gender]}</span>
              <span className="capitalize">{profile.gender}</span>
            </span>
          )}
          <span className="uppercase font-mono">{profile.language}</span>
          {profile.accent && <span className="capitalize">{profile.accent}</span>}
          {profile.sample_count > 0 && (
            <span className="flex items-center gap-1">
              <Mic2 className="h-3 w-3" />
              {profile.sample_count} sample{profile.sample_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Quality score */}
        {profile.quality_score !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Quality</span>
              <span className="font-semibold">{profile.quality_score.toFixed(1)}/10</span>
            </div>
            <Progress value={profile.quality_score * 10} className="h-1" />
          </div>
        )}

        {/* Tags */}
        {profile.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {profile.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                {t}
              </Badge>
            ))}
            {profile.tags.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                +{profile.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
