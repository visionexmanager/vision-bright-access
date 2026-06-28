import { useCallback, useRef } from "react";
import {
  Upload, Mic2, CheckCircle2, XCircle, Loader2,
  X, RotateCcw, AlertTriangle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DATASET_CONSTRAINTS } from "@/lib/types/voice-studio";
import type { VoiceUploadItem, VoiceDataset } from "@/lib/types/voice-studio";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

function QualityBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const color =
    score >= 7 ? "bg-green-500/10 text-green-600 border-green-500/30" :
    score >= 4 ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
                 "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", color)}>
      {score.toFixed(1)}/10
    </Badge>
  );
}

interface Props {
  datasets:      VoiceDataset[];
  uploads:       VoiceUploadItem[];
  totalRequired: number;           // recommended seconds
  totalCurrent:  number;           // current total accepted seconds
  onUpload:      (files: File[]) => void;
  onCancel:      (id: string) => void;
  onRetry:       (id: string) => void;
  onDelete:      (id: string, storagePath: string) => void;
  onClearDone:   () => void;
  disabled?:     boolean;
}

export function DatasetUploader({
  datasets, uploads, totalRequired, totalCurrent, onUpload,
  onCancel, onRetry, onDelete, onClearDone, disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    onUpload(files);
  }, [onUpload, disabled]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onUpload(files);
    if (inputRef.current) inputRef.current.value = "";
  }, [onUpload]);

  const progress = Math.min(100, (totalCurrent / DATASET_CONSTRAINTS.RECOMMENDED_SEC) * 100);
  const hasEnough = totalCurrent >= DATASET_CONSTRAINTS.MIN_TOTAL_SEC;

  const activeUploads = uploads.filter((u) => u.status === "uploading" || u.status === "analyzing" || u.status === "pending");
  const doneUploads   = uploads.filter((u) => u.status === "done" || u.status === "cancelled");
  const errorUploads  = uploads.filter((u) => u.status === "error");

  return (
    <div className="space-y-4">
      {/* Duration progress */}
      <div className="space-y-1.5 p-4 rounded-xl border bg-card">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Total Recording Duration</span>
          <span className={cn("font-mono font-semibold", hasEnough ? "text-green-600" : "text-amber-600")}>
            {formatDuration(totalCurrent)} / {DATASET_CONSTRAINTS.RECOMMENDED_SEC}s recommended
          </span>
        </div>
        <Progress
          value={progress}
          className={cn("h-2", hasEnough ? "[&>div]:bg-green-500" : "[&>div]:bg-amber-500")}
        />
        <p className="text-[10px] text-muted-foreground">
          Minimum {DATASET_CONSTRAINTS.MIN_TOTAL_SEC}s required · {DATASET_CONSTRAINTS.RECOMMENDED_SEC}s recommended for best quality
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
          disabled
            ? "cursor-not-allowed border-border opacity-60"
            : "border-border hover:border-primary/50 hover:bg-primary/5"
        )}
      >
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
          <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div>
          <p className="text-sm font-semibold">Drop audio files here</p>
          <p className="text-xs text-muted-foreground mt-1">
            WAV · MP3 · FLAC — max {formatBytes(DATASET_CONSTRAINTS.MAX_FILE_SIZE_BYTES)} per file
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={disabled} onClick={(e) => e.stopPropagation()}>
          Browse Files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".wav,.mp3,.flac"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </div>

      {/* Upload queue */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Uploading ({activeUploads.length} active)
            </h4>
            {doneUploads.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClearDone}>
                Clear done
              </Button>
            )}
          </div>
          {uploads.map((item) => (
            <UploadRow
              key={item.id}
              item={item}
              onCancel={() => onCancel(item.id)}
              onRetry={() => onRetry(item.id)}
            />
          ))}
        </div>
      )}

      {/* Accepted datasets */}
      {datasets.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Accepted Samples ({datasets.filter((d) => d.status === "accepted").length})
          </h4>
          {datasets.map((dataset) => (
            <DatasetRow
              key={dataset.id}
              dataset={dataset}
              onDelete={() => onDelete(dataset.id, dataset.storage_path)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Upload row ────────────────────────────────────────────────────────────────

function UploadRow({
  item, onCancel, onRetry,
}: { item: VoiceUploadItem; onCancel: () => void; onRetry: () => void }) {
  const isActive = item.status === "uploading" || item.status === "analyzing" || item.status === "pending";

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="mt-0.5 shrink-0">
        {item.status === "done"     && <CheckCircle2 className="h-4 w-4 text-green-600" />}
        {item.status === "error"    && <XCircle       className="h-4 w-4 text-destructive" />}
        {item.status === "cancelled" && <XCircle      className="h-4 w-4 text-muted-foreground" />}
        {isActive && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium truncate">{item.file.name}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(item.file.size)}</span>
        </div>
        {isActive && (
          <Progress value={item.progress} className="h-1" />
        )}
        {item.status === "analyzing" && (
          <p className="text-[10px] text-primary animate-pulse">Analyzing audio quality…</p>
        )}
        {item.error && (
          <p className="text-[10px] text-destructive">{item.error}</p>
        )}
        {item.analysis && item.analysis.issues.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.analysis.issues.map((issue, i) => (
              <span key={i} className="text-[10px] text-amber-600 flex items-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                {issue}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1 shrink-0">
        {item.status === "error" && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRetry} title="Retry">
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
        {isActive && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel} title="Cancel">
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Dataset row ───────────────────────────────────────────────────────────────

function DatasetRow({
  dataset, onDelete, disabled,
}: { dataset: VoiceDataset; onDelete: () => void; disabled: boolean }) {
  const isAccepted = dataset.status === "accepted";
  const isRejected = dataset.status === "rejected";

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border p-3",
      isRejected && "border-destructive/30 bg-destructive/5"
    )}>
      <div className="shrink-0">
        {isAccepted ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : isRejected ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : (
          <Mic2 className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-medium truncate">{dataset.filename}</p>
          {dataset.duration_sec && (
            <span className="text-[10px] text-muted-foreground">
              {formatDuration(dataset.duration_sec)}
            </span>
          )}
          <QualityBadge score={dataset.quality_score} />
        </div>
        <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
          {dataset.sample_rate && <span>{(dataset.sample_rate / 1000).toFixed(1)} kHz</span>}
          {dataset.channels     && <span>{dataset.channels === 1 ? "Mono" : "Stereo"}</span>}
          {dataset.noise_level != null && (
            <span className={dataset.noise_level > 6 ? "text-amber-500" : ""}>
              Noise: {dataset.noise_level.toFixed(1)}/10
            </span>
          )}
          {isRejected && dataset.rejection_reason && (
            <span className="text-destructive">{dataset.rejection_reason}</span>
          )}
        </div>
      </div>

      {!disabled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onDelete}
          title="Remove sample"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
