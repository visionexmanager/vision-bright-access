import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { TRAINING_STEPS } from "@/lib/types/voice-studio";
import type { TrainingJob, TrainingLog, VoiceProfile, TrainingJobStatus } from "@/lib/types/voice-studio";

const LOG_COLORS: Record<string, string> = {
  info:    "text-muted-foreground",
  warning: "text-amber-500",
  error:   "text-destructive",
  success: "text-green-600",
};

const LOG_PREFIXES: Record<string, string> = {
  info:    "ℹ",
  warning: "⚠",
  error:   "✗",
  success: "✓",
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
}

function stepIndex(status: TrainingJobStatus): number {
  return TRAINING_STEPS.findIndex((s) => s.key === status);
}

interface Props {
  profile:     VoiceProfile;
  job:         TrainingJob | null;
  logs:        TrainingLog[];
  isActive:    boolean;
  canStart:    boolean;
  isStarting:  boolean;
  isCancelling: boolean;
  onStart:     () => void;
  onCancel:    () => void;
}

export function TrainingPipeline({
  profile, job, logs, isActive, canStart, isStarting, isCancelling, onStart, onCancel,
}: Props) {
  const currentStatus = job?.status ?? "queued";
  const currentIdx    = stepIndex(currentStatus as TrainingJobStatus);
  const isFailed      = job?.status === "failed";
  const isCompleted   = job?.status === "completed" || profile.status === "completed";
  const isCancelled   = job?.status === "cancelled";

  return (
    <div className="space-y-4">
      {/* CTA */}
      {profile.status === "draft" && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Loader2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Ready to train?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                You have {profile.sample_count} accepted sample{profile.sample_count !== 1 ? "s" : ""}
                {profile.total_duration_sec > 0 && ` (${Math.round(profile.total_duration_sec)}s total)`}.
                Training takes 1–5 minutes depending on the dataset size.
              </p>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={onStart}
            disabled={!canStart || isStarting}
          >
            {isStarting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting…</>
            ) : (
              "Start Training"
            )}
          </Button>
          {!canStart && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Add at least 30 seconds of accepted audio samples to start training.
            </p>
          )}
        </div>
      )}

      {/* Active training */}
      {(isActive || isFailed || isCompleted || isCancelled) && job && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          {/* Steps */}
          <div className="flex items-start gap-0">
            {TRAINING_STEPS.map((step, i) => {
              const isDone    = !isFailed && !isCancelled && currentIdx > i;
              const isCurrent = !isFailed && !isCancelled && currentIdx === i;
              const isErr     = isFailed && currentIdx <= i && currentIdx >= i - 1;

              return (
                <div key={step.key} className="flex flex-col items-center flex-1 gap-1 text-center">
                  <div className="flex items-center w-full">
                    <div className={cn("flex-1 h-0.5", i === 0 ? "invisible" : isDone ? "bg-primary" : "bg-border")} />
                    <div className={cn(
                      "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      isDone    ? "border-primary bg-primary text-white" :
                      isCurrent && !isFailed ? "border-primary bg-primary/10 text-primary" :
                      isErr     ? "border-destructive bg-destructive/10 text-destructive" :
                                  "border-border text-muted-foreground"
                    )}>
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : isCurrent && isActive ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isCurrent && isFailed ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </div>
                    <div className={cn("flex-1 h-0.5", i === TRAINING_STEPS.length - 1 ? "invisible" : isDone ? "bg-primary" : "bg-border")} />
                  </div>
                  <span className={cn("text-[9px] font-medium leading-tight", isDone ? "text-primary" : isCurrent ? "text-primary" : "text-muted-foreground")}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Status message */}
          {isCompleted && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Voice cloning completed! Your voice is now available in Speech Studio.
            </div>
          )}
          {isFailed && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 shrink-0" />
                Training failed: {job.error_message ?? "Unknown error"}
              </div>
              <Button size="sm" variant="outline" className="mt-3" onClick={onStart}>
                Retry Training
              </Button>
            </div>
          )}
          {isCancelled && (
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Training was cancelled.
            </div>
          )}
          {isActive && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onCancel()}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling…" : "Cancel Training"}
            </Button>
          )}
        </div>
      )}

      {/* Training logs */}
      {logs.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Training Log
            </span>
            <Badge variant="secondary" className="ml-auto text-[10px]">{logs.length}</Badge>
          </div>
          <ScrollArea className="h-40">
            <div className="p-3 space-y-1 font-mono text-[11px]">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-muted-foreground/60 shrink-0 tabular-nums">{formatTime(log.created_at)}</span>
                  <span className={cn("shrink-0", LOG_COLORS[log.level])}>{LOG_PREFIXES[log.level]}</span>
                  <span className={LOG_COLORS[log.level]}>{log.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
