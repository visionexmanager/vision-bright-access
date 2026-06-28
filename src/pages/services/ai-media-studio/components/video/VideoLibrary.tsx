import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Heart, LayoutGrid, LayoutList, RefreshCw } from "lucide-react";
import { VideoCard } from "./VideoCard";
import { VideoPlayer } from "./VideoPlayer";
import { useVideoJobs, useVideoJobMutations, useSignedVideoUrl } from "@/hooks/useVideoJobs";
import type { VideoJob, VideoLibraryFilters } from "@/lib/types/video-studio";
import { VIDEO_STYLES } from "@/lib/types/video-studio";
import { cn } from "@/lib/utils";

export function VideoLibrary() {
  const [filters, setFilters] = useState<VideoLibraryFilters>({
    status:  "all",
    sortBy:  "created_at",
    sortDir: "desc",
  });
  const [search,       setSearch]       = useState("");
  const [gridMode,     setGridMode]     = useState<"grid" | "list">("grid");
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameText,   setRenameText]   = useState("");
  const [previewJob,   setPreviewJob]   = useState<VideoJob | null>(null);

  const { data: jobs = [], isLoading, refetch } = useVideoJobs({
    ...filters,
    query: search,
  });
  const { rename, toggleFavorite, archive, cancel, remove } = useVideoJobMutations();

  // Signed URL for the preview job
  const { data: previewSignedUrl } = useSignedVideoUrl(previewJob);
  const previewSrc = previewJob?.video_url ?? previewSignedUrl ?? null;

  const setFilter = <K extends keyof VideoLibraryFilters>(k: K, v: VideoLibraryFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const handleRenameOpen = (id: string, current: string) => {
    setRenameTarget({ id, title: current });
    setRenameText(current);
  };

  const handleRenameConfirm = () => {
    if (renameTarget) {
      rename.mutate({ id: renameTarget.id, title: renameText });
      setRenameTarget(null);
    }
  };

  const handleDelete = () => {
    if (deleteId) { remove.mutate(deleteId); setDeleteId(null); }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos…"
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Status filter */}
        <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v as VideoLibraryFilters["status"])}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Style filter */}
        <Select value={filters.style ?? ""} onValueChange={(v) => setFilter("style", v || undefined)}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="All styles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All styles</SelectItem>
            {VIDEO_STYLES.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.emoji} {s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={`${filters.sortBy}:${filters.sortDir}`}
          onValueChange={(v) => {
            const [by, dir] = v.split(":");
            setFilter("sortBy", by as VideoLibraryFilters["sortBy"]);
            setFilter("sortDir", dir as VideoLibraryFilters["sortDir"]);
          }}
        >
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Newest first</SelectItem>
            <SelectItem value="created_at:asc">Oldest first</SelectItem>
            <SelectItem value="title:asc">Title A–Z</SelectItem>
            <SelectItem value="duration_sec:desc">Longest first</SelectItem>
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant={filters.showFavorites ? "secondary" : "ghost"}
          className="h-8 gap-1.5"
          onClick={() => setFilter("showFavorites", !filters.showFavorites)}
        >
          <Heart className={cn("size-3.5", filters.showFavorites && "fill-red-400 text-red-400")} />
          Favorites
        </Button>

        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => refetch()}>
          <RefreshCw className="size-3.5" />
        </Button>

        <div className="flex gap-0.5 border border-border rounded-md">
          <Button
            size="icon" variant={gridMode === "grid" ? "secondary" : "ghost"} className="h-8 w-8 rounded-r-none"
            onClick={() => setGridMode("grid")}
          >
            <LayoutGrid className="size-3.5" />
          </Button>
          <Button
            size="icon" variant={gridMode === "list" ? "secondary" : "ghost"} className="h-8 w-8 rounded-l-none"
            onClick={() => setGridMode("list")}
          >
            <LayoutList className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <p className="text-sm font-medium">No videos yet</p>
            <p className="text-xs">Generate your first video from the panel on the left.</p>
          </div>
        ) : (
          <div className={cn(
            "gap-3",
            gridMode === "grid"
              ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "flex flex-col"
          )}>
            {jobs.map((job) => (
              <VideoCard
                key={job.id}
                job={job}
                onPlay={(j) => setPreviewJob(j)}
                onFavorite={(id, val) => toggleFavorite.mutate({ id, value: val })}
                onRename={handleRenameOpen}
                onArchive={(id, val) => archive.mutate({ id, value: val })}
                onCancel={(id) => cancel.mutate(id)}
                onDelete={(id) => setDeleteId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Video preview dialog */}
      <Dialog open={!!previewJob} onOpenChange={(v) => { if (!v) setPreviewJob(null); }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {previewJob && previewSrc && (
            <VideoPlayer
              src={previewSrc}
              thumbnail={previewJob.thumbnail_url}
              title={previewJob.title}
              showDownload
              className="rounded-xl"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the video and its associated files.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(v) => { if (!v) setRenameTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rename video</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>New title</Label>
            <Input
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameConfirm(); }}
              placeholder="Enter title"
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRenameConfirm} disabled={rename.isPending}>
              {rename.isPending ? "Saving…" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
