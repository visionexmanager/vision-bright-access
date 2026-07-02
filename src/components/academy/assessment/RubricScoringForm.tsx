import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface RubricScoringFormProps {
  rubric: Array<{ criterion: string; max_points: number }>;
  submitLabel: string;
  onSubmit: (scores: Record<string, number>, feedback: string) => void;
}

/** Shared rubric-based grading UI for both assignment and project review —
 * manual instructor grading only, no AI scoring involved. */
export function RubricScoringForm({ rubric, submitLabel, onSubmit }: RubricScoringFormProps) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(rubric.map((r) => [r.criterion, 0]))
  );
  const [feedback, setFeedback] = useState("");

  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const max = rubric.reduce((s, r) => s + r.max_points, 0);

  return (
    <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border">
      {rubric.length === 0 ? (
        <div className="flex items-center gap-2">
          <label htmlFor="direct-score" className="text-sm text-foreground shrink-0">الدرجة</label>
          <Input
            id="direct-score" type="number" min={0}
            value={scores.total ?? 0}
            onChange={(e) => setScores({ total: Number(e.target.value) })}
            className="rounded-xl w-28"
          />
        </div>
      ) : (
        rubric.map((r) => (
          <div key={r.criterion} className="flex items-center gap-2">
            <label htmlFor={`rubric-${r.criterion}`} className="text-sm text-foreground flex-1">{r.criterion}</label>
            <Input
              id={`rubric-${r.criterion}`} type="number" min={0} max={r.max_points}
              value={scores[r.criterion] ?? 0}
              onChange={(e) => setScores((prev) => ({ ...prev, [r.criterion]: Math.min(r.max_points, Number(e.target.value)) }))}
              className="rounded-xl w-24"
            />
            <span className="text-xs text-muted-foreground shrink-0">/ {r.max_points}</span>
          </div>
        ))
      )}

      {rubric.length > 0 && <p className="text-xs font-bold text-foreground">المجموع: {total} / {max}</p>}

      <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="ملاحظات وتغذية راجعة للطالب..." className="rounded-xl min-h-20 text-sm" />

      <Button size="sm" onClick={() => onSubmit(scores, feedback)} className="gap-2 rounded-xl">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        {submitLabel}
      </Button>
    </div>
  );
}
