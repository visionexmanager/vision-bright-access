import { useRef, useCallback, useState } from "react";
import { StudioLayout } from "./StudioLayout";
import { useAMSAssets } from "@/hooks/useAMSAssets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Search,
  Music,
  Video,
  Image,
  FileText,
  File,
  Trash2,
  MoreHorizontal,
  X,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/lib/types/ai-media-studio";

const TYPE_ICONS: Record<AssetType, React.ElementType> = {
  audio: Music,
  video: Video,
  image: Image,
  document: FileText,
  generated: File,
  other: File,
};

const TYPE_COLORS: Record<AssetType, string> = {
  audio: "text-blue-500",
  video: "text-orange-500",
  image: "text-green-500",
  document: "text-violet-500",
  generated: "text-primary",
  other: "text-muted-foreground",
};

const ACCEPTED_TYPES =
  "audio/*,video/*,image/*,application/pdf,.doc,.docx,.txt";

export default function Assets() {
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<AssetType | "all">("all");

  const { assets, isLoading, deleteAsset, uploads, uploadFiles, cancelUpload, retryUpload, clearCompletedUploads, updateFilters } =
    useAMSAssets({
      asset_type: filterType !== "all" ? filterType : undefined,
      query: search || undefined,
    });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      uploadFiles(Array.from(files));
    },
    [uploadFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const activeUploads = uploads.filter((u) => u.status !== "done" && u.status !== "cancelled");
  const completedUploads = uploads.filter((u) => u.status === "done");

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  };

  return (
    <StudioLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Asset Library</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage all your media files in one place
            </p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          role="button"
          tabIndex={0}
          aria-label="Drop files here or click to upload"
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        >
          <Upload className={cn("h-8 w-8 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
          <div className="text-center">
            <p className="font-medium">
              {isDragging ? "Drop files to upload" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Supports audio, video, images, and documents
            </p>
          </div>
        </div>

        {/* Upload queue */}
        {uploads.length > 0 && (
          <section aria-label="Upload progress">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">
                Uploads
                {activeUploads.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {activeUploads.length} active
                  </span>
                )}
              </h2>
              {completedUploads.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCompletedUploads}>
                  Clear completed
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {uploads.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <div className="shrink-0">
                    {u.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {u.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {u.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    {(u.status === "pending" || u.status === "cancelled") && (
                      <File className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {u.status === "uploading" && (
                        <Progress value={u.progress} className="h-1.5 flex-1" />
                      )}
                      {u.error && (
                        <p className="text-xs text-destructive">{u.error}</p>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatSize(u.file.size)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {u.status === "error" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => retryUpload(u.id)} aria-label="Retry">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {u.status === "uploading" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancelUpload(u.id)} aria-label="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Search assets…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateFilters({ query: e.target.value || undefined });
              }}
              aria-label="Search assets"
            />
          </div>
          <Select
            value={filterType}
            onValueChange={(v) => {
              setFilterType(v as AssetType | "all");
              updateFilters({ asset_type: v !== "all" ? (v as AssetType) : undefined });
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
              <SelectItem value="generated">Generated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Asset list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border border-dashed rounded-2xl">
            <File className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">No assets found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload files to build your asset library
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map((asset) => {
              const Icon = TYPE_ICONS[asset.asset_type] ?? File;
              const colorClass = TYPE_COLORS[asset.asset_type] ?? "text-muted-foreground";
              return (
                <div key={asset.id} className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/50 transition-colors group">
                  <div className={cn("p-2 rounded-lg bg-muted shrink-0", colorClass)}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.original_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                        {asset.asset_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatSize(asset.size_bytes)}</span>
                      {asset.duration_sec && (
                        <span className="text-xs text-muted-foreground">
                          {Math.floor(asset.duration_sec / 60)}:{String(Math.round(asset.duration_sec % 60)).padStart(2, "0")}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(asset.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Asset actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => deleteAsset(asset.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StudioLayout>
  );
}
