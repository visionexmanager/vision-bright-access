import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { fadeIn } from "@/features/visionkids/utils/animations";
import type { Quiz, QuizQuestion } from "@/features/visionkids/types/stories.types";
import type { QuizAnswer } from "@/features/visionkids/services/stories/quizzes";

interface QuizRunnerProps {
  quiz: Quiz;
  onComplete: (result: { score: number; total: number; answers: QuizAnswer[] }) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function StandardQuestion({ question, onAnswer }: { question: QuizQuestion; onAnswer: (answer: string, correct: boolean) => void }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const options = question.type === "true_false" ? [t("kids.quiz.true"), t("kids.quiz.false")] : question.options;

  const submit = (option: string) => {
    if (revealed) return;
    setSelected(option);
    setRevealed(true);
    window.setTimeout(() => onAnswer(option, option === question.correct_answer), 900);
  };

  return (
    <div>
      <p className="text-lg font-bold">{question.question}</p>
      <div className="mt-4 grid gap-2">
        {options.map((option) => {
          const isCorrect = option === question.correct_answer;
          const isSelected = option === selected;
          return (
            <button
              key={option}
              type="button"
              disabled={revealed}
              onClick={() => submit(option)}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-start text-sm font-medium transition-colors ${
                revealed && isCorrect
                  ? "border-kids-green bg-kids-green/10"
                  : revealed && isSelected
                  ? "border-destructive bg-destructive/10"
                  : "border-border hover:bg-muted"
              }`}
            >
              {option}
              {revealed && isCorrect && <CheckCircle2 className="h-5 w-5 text-kids-green" aria-hidden="true" />}
              {revealed && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {revealed && question.explanation && (
        <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">{question.explanation}</p>
      )}
    </div>
  );
}

function MemoryMatchQuestion({ question, onAnswer }: { question: QuizQuestion; onAnswer: (answer: string, correct: boolean) => void }) {
  const { t } = useLanguage();
  const pairs = useMemo(() => {
    const list: { key: string; label: string; pairId: number }[] = [];
    question.options.forEach((label, i) => {
      const pairId = Math.floor(i / 2);
      list.push({ key: `${i}`, label, pairId });
    });
    return shuffle(list);
  }, [question.options]);

  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [mismatches, setMismatches] = useState(0);

  const handleFlip = (key: string, pairId: number) => {
    if (flipped.length === 2 || flipped.includes(key) || matched.has(pairId)) return;
    const next = [...flipped, key];
    setFlipped(next);
    if (next.length === 2) {
      const [firstKey, secondKey] = next;
      const first = pairs.find((p) => p.key === firstKey)!;
      const second = pairs.find((p) => p.key === secondKey)!;
      if (first.pairId === second.pairId) {
        const newMatched = new Set(matched).add(first.pairId);
        setMatched(newMatched);
        setFlipped([]);
        if (newMatched.size === pairs.length / 2) {
          const correct = mismatches === 0;
          window.setTimeout(() => onAnswer(correct ? question.correct_answer : "partial", correct), 500);
        }
      } else {
        setMismatches((m) => m + 1);
        window.setTimeout(() => setFlipped([]), 700);
      }
    }
  };

  return (
    <div>
      <p className="text-lg font-bold">{question.question}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("kids.quiz.memoryInstructions")}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {pairs.map(({ key, label, pairId }) => {
          const isFlipped = flipped.includes(key) || matched.has(pairId);
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleFlip(key, pairId)}
              disabled={matched.has(pairId)}
              aria-label={isFlipped ? label : t("kids.quiz.hiddenCard")}
              className={`flex aspect-square items-center justify-center rounded-xl border-2 p-2 text-center text-xs font-semibold transition-colors ${
                matched.has(pairId) ? "border-kids-green bg-kids-green/10" : isFlipped ? "border-kids-primary bg-kids-primary/10" : "border-border bg-muted"
              }`}
            >
              {isFlipped ? label : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function QuizRunner({ quiz, onComplete }: QuizRunnerProps) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [pendingAdvance, setPendingAdvance] = useState(false);

  const question = quiz.questions[index];
  const isLast = index === quiz.questions.length - 1;

  const handleAnswer = (answer: string, correct: boolean) => {
    setAnswers((prev) => [...prev, { question_id: question.id, answer, correct }]);
    setPendingAdvance(true);
  };

  const finish = (allAnswers: QuizAnswer[]) => {
    const avgPoints = quiz.questions.reduce((sum, q) => sum + (q.points || 10), 0);
    const score = allAnswers.reduce((sum, a, i) => sum + (a.correct ? quiz.questions[i]?.points || 10 : 0), 0);
    onComplete({ score, total: avgPoints, answers: allAnswers });
  };

  if (!question) return null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Progress value={((index + (pendingAdvance ? 1 : 0)) / quiz.questions.length) * 100} className="flex-1" />
        <span className="text-sm text-muted-foreground">{index + 1}/{quiz.questions.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={question.id} initial="hidden" animate="visible" exit="hidden" variants={fadeIn(reduced)}>
          {question.type === "memory" ? (
            <MemoryMatchQuestion question={question} onAnswer={handleAnswer} />
          ) : (
            <StandardQuestion question={question} onAnswer={handleAnswer} />
          )}
        </motion.div>
      </AnimatePresence>

      {pendingAdvance && !isLast && (
        <Button className="mt-4 gap-1.5" onClick={() => { setIndex((i) => i + 1); setPendingAdvance(false); }}>
          {t("kids.quiz.next")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}

      {pendingAdvance && isLast && (
        <Button className="mt-4 gap-1.5 bg-kids-accent text-white hover:bg-kids-accent/90" onClick={() => finish(answers)}>
          <Trophy className="h-4 w-4" aria-hidden="true" /> {t("kids.quiz.seeResults")}
        </Button>
      )}
    </div>
  );
}
