import { useState } from "react";
import { CheckCircle2, XCircle, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LessonActivity } from "@/features/visionkids/types/academy.types";

interface ExerciseRunnerProps {
  activity: LessonActivity;
  onComplete: (correct: boolean, answer: Record<string, unknown>) => void;
}

const SUPPORTED_TYPES = new Set(["multiple_choice", "matching", "typing"]);

function MultipleChoiceExercise({ activity, onComplete }: ExerciseRunnerProps) {
  const content = activity.content as { options: string[]; correctAnswer: string };
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const choose = (option: string) => {
    if (revealed) return;
    setSelected(option);
    setRevealed(true);
    window.setTimeout(() => onComplete(option === content.correctAnswer, { selected: option }), 900);
  };

  return (
    <div className="grid gap-2">
      {content.options.map((option) => {
        const isCorrect = option === content.correctAnswer;
        const isSelected = option === selected;
        return (
          <button
            key={option}
            type="button"
            disabled={revealed}
            onClick={() => choose(option)}
            className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-start font-medium transition-colors ${
              revealed && isCorrect ? "border-kids-green bg-kids-green/10" : revealed && isSelected ? "border-destructive bg-destructive/10" : "border-border hover:bg-muted"
            }`}
          >
            {option}
            {revealed && isCorrect && <CheckCircle2 className="h-5 w-5 text-kids-green" aria-hidden="true" />}
            {revealed && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function TypingExercise({ activity, onComplete }: ExerciseRunnerProps) {
  const { t } = useLanguage();
  const content = activity.content as { correctAnswer: string };
  const [value, setValue] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(false);

  const submit = () => {
    if (revealed || !value.trim()) return;
    const isCorrect = value.trim().toLowerCase() === content.correctAnswer.trim().toLowerCase();
    setCorrect(isCorrect);
    setRevealed(true);
    window.setTimeout(() => onComplete(isCorrect, { typed: value }), 900);
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        disabled={revealed}
        placeholder={t("kids.academy.typeYourAnswer")}
        className={revealed ? (correct ? "border-kids-green" : "border-destructive") : undefined}
      />
      {!revealed && <Button onClick={submit} disabled={!value.trim()} className="self-start bg-kids-primary text-white hover:bg-kids-primary/90">{t("kids.academy.submit")}</Button>}
      {revealed && (
        <p className={`flex items-center gap-1 text-sm font-semibold ${correct ? "text-kids-green" : "text-destructive"}`}>
          {correct ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
          {correct ? t("kids.academy.correct") : `${t("kids.academy.correctAnswerWas")}: ${content.correctAnswer}`}
        </p>
      )}
    </div>
  );
}

function MatchingExercise({ activity, onComplete }: ExerciseRunnerProps) {
  const { t } = useLanguage();
  const content = activity.content as { pairs: { left: string; right: string }[] };
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);

  const pickRight = (right: string, left: string) => {
    if (!selectedLeft) return;
    if (selectedLeft === left) {
      const next = new Set(matched).add(left);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === content.pairs.length) {
        window.setTimeout(() => onComplete(true, { matchedAll: true }), 500);
      }
    } else {
      setWrongFlash(right);
      window.setTimeout(() => setWrongFlash(null), 500);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-2" role="group" aria-label={t("kids.academy.matchLeft")}>
        {content.pairs.map((pair) => (
          <button
            key={pair.left}
            type="button"
            disabled={matched.has(pair.left)}
            onClick={() => setSelectedLeft(pair.left)}
            className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
              matched.has(pair.left) ? "border-kids-green bg-kids-green/10" : selectedLeft === pair.left ? "border-kids-primary bg-kids-primary/10" : "border-border hover:bg-muted"
            }`}
          >
            {pair.left}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2" role="group" aria-label={t("kids.academy.matchRight")}>
        {content.pairs.map((pair) => {
          const leftForThis = content.pairs.find((p) => p.right === pair.right)?.left ?? "";
          return (
            <button
              key={pair.right}
              type="button"
              disabled={matched.has(leftForThis)}
              onClick={() => pickRight(pair.right, leftForThis)}
              className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                matched.has(leftForThis) ? "border-kids-green bg-kids-green/10" : wrongFlash === pair.right ? "border-destructive bg-destructive/10" : "border-border hover:bg-muted"
              }`}
            >
              {pair.right}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Unified Exercises runner. multiple_choice/matching/typing are fully
 *  real; drag_drop/speaking/listening/drawing/voice_answer show an honest
 *  "not available yet" state with a Skip — same ComingSoon precedent as
 *  Games' unimplemented titles, not faked functionality. */
export function ExerciseRunner({ activity, onComplete }: ExerciseRunnerProps) {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5">
      <p className="mb-4 font-semibold">{activity.prompt}</p>

      {activity.type === "multiple_choice" && <MultipleChoiceExercise activity={activity} onComplete={onComplete} />}
      {activity.type === "typing" && <TypingExercise activity={activity} onComplete={onComplete} />}
      {activity.type === "matching" && <MatchingExercise activity={activity} onComplete={onComplete} />}

      {!SUPPORTED_TYPES.has(activity.type) && (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 text-center">
          <Construction className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("kids.academy.exerciseTypeComingSoon")}</p>
          <Button variant="outline" size="sm" onClick={() => onComplete(true, { skipped: true })}>{t("kids.academy.skip")}</Button>
        </div>
      )}
    </div>
  );
}
