import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PIPELINE_STEPS } from "@/lib/types/video-studio";
import type { GenerationPhase } from "@/hooks/useVideoGenerate";

interface VideoJobStatusProps {
  phase:       GenerationPhase;
  progress:    number;
  elapsedSec:  number;
  errorMessage?: string | null;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

const PHASE_LABELS: Record<GenerationPhase, string> = {
  idle:       "Idle",
  submitting: "Submitting…",
  preparing:  "Preparing…",
  generating: "Generating…",
  rendering:  "Rendering frames…",
  optimizing: "Optimizing…",
  uploading:  "Uploading…",
  completed:  "Complete!",
  failed:     "Failed",
};

export function VideoJobStatus({
  phase,
  progress,
  elapsedSec,
  errorMessage,
}: VideoJobStatusProps) {
  if (phase === "idle") return null;

  const isActive  = !["completed", "failed"].includes(phase);
  const isFailed  = phase === "failed";
  const isDone    = phase === "completed";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isActive  && <Loader2 className="size-4 animate-spin text-primary" />}
          {isDone    && <CheckCircle2 className="size-4 text-green-500" />}
          {isFailed  && <XCircle className="size-4 text-destructive" />}
          <span className={cn(
            "text-sm font-medium",
            isDone   && "text-green-500",
            isFailed && "text-destructive",
          )}>
            {PHASE_LABELS[phase]}
          </span>
        </div>
        {isActive && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {formatDuration(elapsedSec)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!isFailed && (
        <Progress
          value={progress}
          className={cn(
            "h-1.5",
            isDone && "[&>div]:bg-green-500"
          )}
        />
      )}

      {/* Pipeline steps */}
      {isActive && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PIPELINE_STEPS.map((step, i) => {
            const currentIdx = PIPELINE_STEPS.findIndex((s) => s.status === phase);
            const isPast     = i < currentIdx;
            const isCurrent  = step.status === phase;
            return (
              <div key={step.status} className="flex items-center gap-1 shrink-0">
                <div className={cn(
                  "size-1.5 rounded-full",
                  isPast   && "bg-primary",
                  isCurrent && "bg-primary animate-pulse",
                  !isPast && !isCurrent && "bg-muted-foreground/30",
                )} />
                <span className={cn(
                  "text-[10px]",
                  isCurrent ? "text-primary font-medium" : "text-muted-foreground/50",
                )}>
                  {step.label}
                </span>
                {i < PIPELINE_STEPS.length - 1 && (
                  <span className="text-[10px] text-muted-foreground/30">›</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {isFailed && errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
