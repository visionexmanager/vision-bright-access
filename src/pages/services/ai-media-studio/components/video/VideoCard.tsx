import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Heart, MoreVertical, Play, Download, Pencil,
  Archive, Trash2, ArchiveRestore, X, Clock, Film
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { VIDEO_STYLES } from "@/lib/types/video-studio";
import type { VideoJob } from "@/lib/types/video-studio";

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  queued:     { label: "Queued",     class: "bg-slate-500/20 text-slate-400" },
  preparing:  { label: "Preparing",  class: "bg-blue-500/20 text-blue-400" },
  generating: { label: "Generating", class: "bg-purple-500/20 text-purple-400 animate-pulse" },
  rendering:  { label: "Rendering",  class: "bg-indigo-500/20 text-indigo-400 animate-pulse" },
  optimizing: { label: "Optimizing", class: "bg-cyan-500/20 text-cyan-400 animate-pulse" },
  uploading:  { label: "Uploading",  class: "bg-sky-500/20 text-sky-400 animate-pulse" },
  completed:  { label: "Done",       class: "bg-green-500/20 text-green-400" },
  failed:     { label: "Failed",     class: "bg-red-500/20 text-red-400" },
  cancelled:  { label: "Cancelled",  class: "bg-gray-500/20 text-gray-400" },
};

interface VideoCardProps {
  job:           VideoJob;
  videoUrl?:     string | null;
  onPlay?:       (job: VideoJob) => void;
  onFavorite?:   (id: string, value: boolean) => void;
  onRename?:     (id: string, current: string) => void;
  onArchive?:    (id: string, value: boolean) => void;
  onDelete?:     (id: string) => void;
  onCancel?:     (id: string) => void;
}

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return "just now";
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr  < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function VideoCard({
  job, videoUrl, onPlay, onFavorite, onRename, onArchive, onDelete, onCancel,
}: VideoCardProps) {
  const [imgErr, setImgErr] = useState(false);

  const thumb     = job.thumbnail_url ?? null;
  const isActive  = ["queued","preparing","generating","rendering","optimizing","uploading"].includes(job.status);
  const isDone    = job.status === "completed";
  const isFailed  = job.status === "failed";
  const hasVideo  = isDone && (videoUrl || job.video_url);
  const src       = videoUrl || job.video_url;

  const styleInfo = VIDEO_STYLES.find((s) => s.id === job.style);
  const badge     = STATUS_BADGE[job.status] ?? { label: job.status, class: "" };

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md",
      job.is_archived && "opacity-60"
    )}>
      {/* Thumbnail / preview */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        {thumb && !imgErr ? (
          <img
            src={thumb}
            alt={job.title ?? "Video thumbnail"}
            className="h-full w-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br",
            styleInfo?.gradient ?? "from-muted to-muted-foreground/20"
          )}>
            <span className="text-3xl opacity-50">{styleInfo?.emoji ?? "🎬"}</span>
          </div>
        )}

        {/* Play overlay */}
        {hasVideo && (
          <button
            onClick={() => src && onPlay?.({ ...job, video_url: src })}
            className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40"
          >
            <Play className="size-10 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
          </button>
        )}

        {/* Active spinner */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-[10px] text-white/80">{job.progress}%</span>
            </div>
          </div>
        )}

        {/* Failed overlay */}
        {isFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <X className="size-8 text-destructive" />
          </div>
        )}

        {/* Status badge */}
        <Badge className={cn("absolute left-2 top-2 text-[10px]", badge.class)}>
          {badge.label}
        </Badge>

        {/* Favorite */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-2 top-2 size-6 bg-black/40 text-white hover:bg-black/60"
          onClick={() => onFavorite?.(job.id, !job.is_favorite)}
        >
          <Heart className={cn("size-3", job.is_favorite && "fill-red-400 text-red-400")} />
        </Button>
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="line-clamp-1 text-sm font-medium leading-tight">
            {job.title || job.prompt.slice(0, 50)}
          </p>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-6 shrink-0">
                <MoreVertical className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hasVideo && src && (
                <DropdownMenuItem onClick={() => {
                  const a = document.createElement("a");
                  a.href = src; a.download = job.title ?? "video.mp4"; a.click();
                }}>
                  <Download className="mr-2 size-3.5" /> Download
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onRename?.(job.id, job.title ?? "")}>
                <Pencil className="mr-2 size-3.5" /> Rename
              </DropdownMenuItem>
              {isActive && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onCancel?.(job.id)}
                >
                  <X className="mr-2 size-3.5" /> Cancel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onArchive?.(job.id, !job.is_archived)}>
                {job.is_archived
                  ? <><ArchiveRestore className="mr-2 size-3.5" /> Unarchive</>
                  : <><Archive className="mr-2 size-3.5" /> Archive</>
                }
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete?.(job.id)}
              >
                <Trash2 className="mr-2 size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Film className="size-2.5" />
            {job.aspect_ratio} · {job.resolution}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-2.5" />
            {formatDuration(job.duration_sec)}
          </span>
          <span className="ml-auto">{formatAgo(job.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
