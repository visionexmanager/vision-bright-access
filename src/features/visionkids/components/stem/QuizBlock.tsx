import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { QuizQuestion } from "@/features/visionkids/types/stem.types";

/** A friendly one-question-at-a-time quiz. Gives instant feedback with a short
 *  explanation, then reports a 0–100 score to `onDone` when finished. */
export function QuizBlock({
  questions,
  onDone,
}: {
  questions: QuizQuestion[];
  onDone: (score: number) => void;
}) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const question = questions[index];
  if (!question) return null;

  const answered = picked !== null;
  const isCorrect = picked === question.answer;
  const isLast = index === questions.length - 1;

  function pick(choiceIndex: number) {
    if (answered) return;
    setPicked(choiceIndex);
    if (choiceIndex === question.answer) setCorrectCount((c) => c + 1);
  }

  function next() {
    if (isLast) {
      onDone(Math.round((correctCount / questions.length) * 100));
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  }

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("kids.stem.quiz.question")} {index + 1} / {questions.length}
      </p>
      <p className="mt-1 font-heading text-lg font-bold">{question.q}</p>

      <div className="mt-3 flex flex-col gap-2">
        {question.choices.map((choice, i) => {
          const showCorrect = answered && i === question.answer;
          const showWrong = answered && i === picked && i !== question.answer;
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={answered}
              aria-pressed={picked === i}
              className={`flex items-center justify-between gap-2 rounded-xl border-2 px-4 py-2.5 text-start text-sm font-semibold transition-colors disabled:cursor-default ${
                showCorrect
                  ? "border-kids-green bg-kids-green/10 text-kids-green"
                  : showWrong
                    ? "border-kids-pink bg-kids-pink/10 text-kids-pink"
                    : "border-border hover:border-kids-primary/50"
              }`}
            >
              {choice}
              {showCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {showWrong && <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
          <p className="font-semibold">{isCorrect ? t("kids.stem.quiz.correct") : t("kids.stem.quiz.tryNext")}</p>
          {question.explain && <p className="mt-1 text-muted-foreground">{question.explain}</p>}
          <button
            type="button"
            onClick={next}
            className="mt-3 rounded-full bg-kids-primary px-5 py-2 font-bold text-white hover:opacity-90"
          >
            {isLast ? t("kids.stem.quiz.finish") : t("kids.stem.quiz.next")}
          </button>
        </div>
      )}
    </div>
  );
}
