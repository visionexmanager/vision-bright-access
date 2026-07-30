import { useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ActivityConfig } from "@/features/visionkids/types/stem.types";

interface Round {
  a: number;
  b: number;
  op: NonNullable<ActivityConfig["op"]>;
  answer: number;
  choices: number[];
}

const OP_SYMBOL: Record<NonNullable<ActivityConfig["op"]>, string> = {
  add: "+", subtract: "−", multiply: "×", divide: "÷",
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildRound(op: NonNullable<ActivityConfig["op"]>, min: number, max: number): Round {
  let a = randomInt(min, max);
  let b = randomInt(min, max);
  let answer = 0;
  switch (op) {
    case "add": answer = a + b; break;
    case "subtract": if (b > a) [a, b] = [b, a]; answer = a - b; break;
    case "multiply": answer = a * b; break;
    case "divide": { const product = a * b; answer = a; return makeChoices({ a: product, b, op, answer }); }
  }
  return makeChoices({ a, b, op, answer });
}

function makeChoices(base: { a: number; b: number; op: Round["op"]; answer: number }): Round {
  const set = new Set<number>([base.answer]);
  while (set.size < 3) {
    const delta = randomInt(1, 5) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = base.answer + delta;
    if (candidate >= 0) set.add(candidate);
  }
  const choices = [...set].sort(() => Math.random() - 0.5);
  return { ...base, choices };
}

/** Math Lab practice: generates `rounds` questions from an ActivityConfig and
 *  reports a 0–100 score to `onDone`. Multiple-choice, instant feedback. */
export function MathActivity({ config, onDone }: { config: ActivityConfig; onDone: (score: number) => void }) {
  const { t } = useLanguage();
  const op = config.op ?? "add";
  const min = config.min ?? 1;
  const max = config.max ?? 10;
  const total = Math.max(1, Math.min(10, config.rounds ?? 5));

  const rounds = useMemo(
    () => Array.from({ length: total }, () => buildRound(op, min, max)),
    [op, min, max, total],
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  const round = rounds[index];
  const answered = picked !== null;
  const isLast = index === rounds.length - 1;

  function pick(value: number) {
    if (answered) return;
    setPicked(value);
    if (value === round.answer) setCorrect((c) => c + 1);
  }

  function next() {
    if (isLast) { onDone(Math.round((correct / rounds.length) * 100)); return; }
    setIndex((i) => i + 1);
    setPicked(null);
  }

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("kids.stem.quiz.question")} {index + 1} / {rounds.length}
      </p>
      <p className="mt-2 font-heading text-4xl font-extrabold">
        {round.a} {OP_SYMBOL[round.op]} {round.b} = ?
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {round.choices.map((choice) => {
          const showCorrect = answered && choice === round.answer;
          const showWrong = answered && choice === picked && choice !== round.answer;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => pick(choice)}
              disabled={answered}
              className={`flex items-center gap-1 rounded-xl border-2 px-5 py-3 text-lg font-bold transition-colors disabled:cursor-default ${
                showCorrect ? "border-kids-green bg-kids-green/10 text-kids-green"
                  : showWrong ? "border-kids-pink bg-kids-pink/10 text-kids-pink"
                    : "border-border hover:border-kids-primary/50"
              }`}
            >
              {choice}
              {showCorrect && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              {showWrong && <XCircle className="h-4 w-4" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <button type="button" onClick={next} className="mt-4 rounded-full bg-kids-primary px-6 py-2 font-bold text-white hover:opacity-90">
          {isLast ? t("kids.stem.quiz.finish") : t("kids.stem.quiz.next")}
        </button>
      )}
    </div>
  );
}
