import { TrendingUp, Volume2, Mic2, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { DATASET_CONSTRAINTS } from "@/lib/types/voice-studio";
import type { VoiceDataset } from "@/lib/types/voice-studio";

interface OverallMetrics {
  avgQuality:     number;
  avgNoiseLevel:  number;
  avgClarity:     number;
  totalDuration:  number;
  sampleCount:    number;
}

function computeMetrics(datasets: VoiceDataset[]): OverallMetrics {
  const accepted = datasets.filter((d) => d.status === "accepted");
  const n = accepted.length || 1;

  return {
    avgQuality:    accepted.reduce((s, d) => s + (d.quality_score ?? 0), 0) / n,
    avgNoiseLevel: accepted.reduce((s, d) => s + (d.noise_level ?? 0), 0) / n,
    avgClarity:    accepted.reduce((s, d) => s + (d.clarity_score ?? 0), 0) / n,
    totalDuration: accepted.reduce((s, d) => s + (d.duration_sec ?? 0), 0),
    sampleCount:   accepted.length,
  };
}

function ScoreBar({
  label, value, max = 10, inverted = false, icon: Icon,
}: { label: string; value: number; max?: number; inverted?: boolean; icon: React.ElementType }) {
  const pct = (value / max) * 100;
  const good = inverted ? value < 4 : value >= 6;
  const color = good ? "bg-green-500" : value >= (max / 2) ? "bg-amber-500" : "bg-destructive";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className={cn("font-semibold tabular-nums", good ? "text-green-600" : "text-amber-600")}>
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface Props {
  datasets: VoiceDataset[];
  className?: string;
}

export function QualityAnalysis({ datasets, className }: Props) {
  const accepted = datasets.filter((d) => d.status === "accepted");
  if (accepted.length === 0) {
    return (
      <div className={cn("rounded-xl border bg-card p-5 text-center space-y-2", className)}>
        <Mic2 className="h-7 w-7 text-muted-foreground/50 mx-auto" />
        <p className="text-sm font-medium">No samples yet</p>
        <p className="text-xs text-muted-foreground">Upload audio samples to see quality analysis.</p>
      </div>
    );
  }

  const m = computeMetrics(datasets);
  const readyForTraining = m.totalDuration >= DATASET_CONSTRAINTS.MIN_TOTAL_SEC && accepted.length > 0;
  const optimal = m.totalDuration >= DATASET_CONSTRAINTS.RECOMMENDED_SEC;

  // Generate suggestions
  const suggestions: string[] = [];
  if (m.totalDuration < DATASET_CONSTRAINTS.MIN_TOTAL_SEC)
    suggestions.push(`Add ${Math.ceil(DATASET_CONSTRAINTS.MIN_TOTAL_SEC - m.totalDuration)}s more audio to reach the minimum.`);
  if (m.avgNoiseLevel > 5)
    suggestions.push("Record in a quieter environment or use a noise gate.");
  if (m.avgClarity < 5)
    suggestions.push("Speak closer to the microphone and articulate clearly.");
  if (m.sampleCount < 3)
    suggestions.push("Add at least 3 varied samples for better voice consistency.");
  if (!optimal)
    suggestions.push(`Add ${Math.ceil((DATASET_CONSTRAINTS.RECOMMENDED_SEC - m.totalDuration) / 60)} more minute(s) for optimal quality.`);

  return (
    <div className={cn("rounded-xl border bg-card p-5 space-y-5", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Quality Analysis</h3>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            optimal          ? "text-green-600 border-green-500/30 bg-green-500/10" :
            readyForTraining ? "text-amber-600 border-amber-500/30 bg-amber-500/10" :
                               "text-destructive border-destructive/30 bg-destructive/10"
          )}
        >
          {optimal ? "Optimal" : readyForTraining ? "Trainable" : "Insufficient"}
        </Badge>
      </div>

      {/* Scores */}
      <div className="space-y-3">
        <ScoreBar label="Overall Quality"  value={m.avgQuality}    icon={TrendingUp} />
        <ScoreBar label="Audio Clarity"    value={m.avgClarity}    icon={Volume2} />
        <ScoreBar label="Noise Level"      value={m.avgNoiseLevel} icon={Mic2} inverted />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Samples"  value={String(m.sampleCount)} />
        <Stat label="Duration" value={`${Math.round(m.totalDuration)}s`} />
        <Stat label="Quality"  value={`${m.avgQuality.toFixed(1)}/10`} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Lightbulb className="h-3.5 w-3.5" />
            Suggestions
          </div>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
      )}

      {readyForTraining && suggestions.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Dataset is ready for training. Excellent quality!
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
      <p className="text-sm font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
