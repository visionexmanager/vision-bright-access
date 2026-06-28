import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenerationStep } from "@/lib/types/speech-studio";

interface Props {
  step: GenerationStep;
  progress: number;
  error?: string | null;
}

const STEPS: { key: GenerationStep; label: string; sublabel: string }[] = [
  { key: "queued",     label: "Queued",     sublabel: "Waiting for processing…" },
  { key: "processing", label: "Processing", sublabel: "Sending to voice engine…" },
  { key: "finalizing", label: "Finalizing", sublabel: "Encoding audio…" },
  { key: "completed",  label: "Complete",   sublabel: "Your audio is ready!" },
];

function stepIndex(step: GenerationStep): number {
  if (step === "failed" || step === "idle") return -1;
  return STEPS.findIndex((s) => s.key === step);
}

export function GenerationStatus({ step, progress, error }: Props) {
  if (step === "idle") return null;

  const currentIndex = stepIndex(step);
  const isFailed     = step === "failed";
  const isCompleted  = step === "completed";

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className={cn(
            "font-medium",
            isFailed    ? "text-destructive" :
            isCompleted ? "text-green-600"   : "text-primary"
          )}>
            {isFailed
              ? "Generation failed"
              : isCompleted
              ? "Audio ready"
              : STEPS[currentIndex]?.label ?? "Processing…"}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {isFailed ? "—" : `${Math.round(progress)}%`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isFailed    ? "bg-destructive" :
              isCompleted ? "bg-green-500"   : "bg-primary"
            )}
            style={{ width: `${isFailed ? 100 : progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-start gap-0">
        {STEPS.map((s, i) => {
          const isDone    = !isFailed && currentIndex > i;
          const isCurrent = !isFailed && currentIndex === i;
          const isPending = isFailed || currentIndex < i;

          return (
            <div key={s.key} className="flex flex-1 flex-col items-center gap-1 text-center">
              {/* Connector + icon row */}
              <div className="flex items-center w-full">
                {/* Left connector */}
                <div className={cn("flex-1 h-0.5 transition-colors", i === 0 ? "invisible" : isDone || isCurrent ? "bg-primary" : "bg-border")} />
                {/* Icon */}
                <div className={cn(
                  "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                  isDone    ? "border-primary bg-primary text-primary-foreground" :
                  isCurrent ? "border-primary bg-primary/10 text-primary" :
                  isFailed && i <= currentIndex
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-border bg-background text-muted-foreground"
                )}>
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isFailed && i === currentIndex ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>
                {/* Right connector */}
                <div className={cn("flex-1 h-0.5 transition-colors", i === STEPS.length - 1 ? "invisible" : isDone ? "bg-primary" : "bg-border")} />
              </div>
              {/* Label */}
              <span className={cn(
                "text-[10px] font-medium leading-tight",
                isDone    ? "text-primary" :
                isCurrent ? "text-primary" : "text-muted-foreground"
              )}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {isFailed && error ? (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive leading-relaxed">
          {error}
        </div>
      ) : !isCompleted && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">
          {STEPS[currentIndex]?.sublabel}
        </p>
      )}
    </div>
  );
}
