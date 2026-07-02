import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Clock, CheckCircle2, XCircle, HelpCircle, ArrowRight, ArrowLeft, Award, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { submitQuizAttemptLocal, getQuizAttempts } from "@/lib/academy/assessmentLocalStore";
import type { AcademyQuizRow, AcademyQuizQuestionRow, AcademyQuizAttemptRow } from "@/lib/types/academy-lms";

interface QuizPlayerProps {
  quiz: AcademyQuizRow;
  questions: AcademyQuizQuestionRow[];
  userId: string;
  onPassed?: (attempt: AcademyQuizAttemptRow) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function QuizPlayer({ quiz, questions, userId, onPassed }: QuizPlayerProps) {
  const orderedQuestions = useMemo(
    () => (quiz.randomize_questions ? shuffle(questions) : [...questions].sort((a, b) => a.order_index - b.order_index)),
    [questions, quiz.randomize_questions]
  );

  const pastAttempts = getQuizAttempts(userId, quiz.id);
  const attemptsUsed = pastAttempts.length;
  const attemptsExhausted = quiz.attempts_limit != null && attemptsUsed >= quiz.attempts_limit;

  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { choiceIndexes?: number[]; text?: string }>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});
  const [showInstantFeedback, setShowInstantFeedback] = useState(false);
  const [result, setResult] = useState<AcademyQuizAttemptRow | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : null);

  const questionStartRef = useRef<number>(Date.now());
  const currentQuestion = orderedQuestions[currentIndex];

  const finishAttempt = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    const finalTimes = { ...questionTimes, [currentQuestion?.id ?? "final"]: (questionTimes[currentQuestion?.id ?? "final"] ?? 0) + elapsed };
    const attempt = submitQuizAttemptLocal(userId, quiz, orderedQuestions, answers, finalTimes);
    setResult(attempt);
    if (attempt.passed) onPassed?.(attempt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, questionTimes, currentQuestion, orderedQuestions, quiz, userId, onPassed]);

  useEffect(() => {
    if (!started || result || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      finishAttempt();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
  }, [started, result, secondsLeft, finishAttempt]);

  const recordTimeAndAdvance = (goNext: boolean) => {
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    setQuestionTimes((prev) => ({ ...prev, [currentQuestion.id]: (prev[currentQuestion.id] ?? 0) + elapsed }));
    questionStartRef.current = Date.now();
    setShowInstantFeedback(false);
    if (goNext) {
      if (currentIndex < orderedQuestions.length - 1) setCurrentIndex((i) => i + 1);
      else finishAttempt();
    } else {
      setCurrentIndex((i) => Math.max(0, i - 1));
    }
  };

  const setChoiceAnswer = (indexes: number[]) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: { choiceIndexes: indexes } }));
  };
  const setTextAnswer = (text: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: { text } }));
  };

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isAnswered = currentQuestion
    ? currentQuestion.type === "single_choice" || currentQuestion.type === "true_false" || currentQuestion.type === "multiple_choice"
      ? (currentAnswer?.choiceIndexes?.length ?? 0) > 0
      : (currentAnswer?.text?.trim().length ?? 0) > 0
    : false;

  // ── Not started yet ──────────────────────────────────────────────────────
  if (!started && !result) {
    return (
      <div className="bg-card p-8 rounded-2xl border border-border text-center space-y-4">
        <HelpCircle className="w-10 h-10 mx-auto text-primary" aria-hidden="true" />
        <h3 className="text-lg font-black text-foreground">{quiz.title}</h3>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          <span>{questions.length} أسئلة</span>
          {quiz.time_limit_minutes && <span className="flex items-center gap-1"><Clock className="w-4 h-4" aria-hidden="true" />{quiz.time_limit_minutes} دقيقة</span>}
          <span>الحد الأدنى للنجاح: {quiz.passing_score_percent}%</span>
          {quiz.attempts_limit != null && <span>المحاولات: {attemptsUsed}/{quiz.attempts_limit}</span>}
        </div>
        {pastAttempts.length > 0 && (
          <p className="text-sm text-muted-foreground">
            آخر محاولة: {pastAttempts[0].score_percent}% — {pastAttempts[0].passed ? "ناجح" : "غير ناجح"}
          </p>
        )}
        {attemptsExhausted ? (
          <p className="text-sm text-destructive font-medium">لقد استنفدت عدد المحاولات المسموح بها لهذا الاختبار.</p>
        ) : (
          <Button onClick={() => { setStarted(true); questionStartRef.current = Date.now(); }} className="rounded-xl gap-2">
            {pastAttempts.length > 0 ? <RotateCcw className="w-4 h-4" aria-hidden="true" /> : <HelpCircle className="w-4 h-4" aria-hidden="true" />}
            {pastAttempts.length > 0 ? "إعادة المحاولة" : "ابدأ الاختبار"}
          </Button>
        )}
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="bg-card p-8 rounded-2xl border border-border space-y-6">
        <div className="text-center space-y-2">
          {result.passed ? <Award className="w-12 h-12 mx-auto text-emerald-500" aria-hidden="true" /> : <XCircle className="w-12 h-12 mx-auto text-destructive" aria-hidden="true" />}
          <h3 className="text-2xl font-black text-foreground">{result.score_percent}%</h3>
          <p className={`font-bold ${result.passed ? "text-emerald-600" : "text-destructive"}`}>
            {result.passed ? "أحسنت! لقد اجتزت الاختبار" : "لم تصل للحد الأدنى للنجاح"}
          </p>
          {result.pending_manual_grading && (
            <p className="text-sm text-muted-foreground">بعض الأسئلة (مقالية/برمجية) تنتظر مراجعة المدرّس — قد تتغير النتيجة النهائية.</p>
          )}
        </div>

        <ul className="space-y-3" aria-label="مراجعة الأسئلة">
          {orderedQuestions.map((q, i) => {
            const r = result.question_results[q.id];
            return (
              <li key={q.id} className="p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-start gap-2">
                  {r?.auto_graded ? (
                    r.correct ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" /> : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <HelpCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{i + 1}. {q.prompt}</p>
                    {q.explanation && <p className="text-xs text-muted-foreground mt-1">{q.explanation}</p>}
                    {!r?.auto_graded && <p className="text-xs text-yellow-600 mt-1">بانتظار مراجعة المدرّس</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{r?.points_earned ?? 0}/{q.points}</span>
                </div>
              </li>
            );
          })}
        </ul>

        {!attemptsExhausted && (
          <Button variant="outline" onClick={() => { setResult(null); setStarted(false); setCurrentIndex(0); setAnswers({}); setQuestionTimes({}); setSecondsLeft(quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : null); }} className="rounded-xl gap-2">
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            محاولة أخرى
          </Button>
        )}
      </div>
    );
  }

  // ── In progress ──────────────────────────────────────────────────────────
  if (!currentQuestion) return null;

  const isCorrectPreview = currentQuestion.type !== "essay" && currentQuestion.type !== "code" && quiz.instant_feedback && showInstantFeedback;

  return (
    <div className="bg-card p-6 md:p-8 rounded-2xl border border-border space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-bold text-muted-foreground">سؤال {currentIndex + 1} من {orderedQuestions.length}</p>
        {secondsLeft !== null && (
          <p className={`text-xs font-bold flex items-center gap-1 ${secondsLeft < 30 ? "text-destructive" : "text-muted-foreground"}`} role="timer" aria-live="polite">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </p>
        )}
      </div>
      <Progress value={((currentIndex + 1) / orderedQuestions.length) * 100} className="h-1.5" />

      <fieldset>
        <legend className="text-base font-bold text-foreground mb-4">{currentQuestion.prompt}</legend>

        {(currentQuestion.type === "single_choice" || currentQuestion.type === "true_false") && (
          <div role="radiogroup" aria-label={currentQuestion.prompt} className="space-y-2">
            {currentQuestion.choices.map((choice, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={currentAnswer?.choiceIndexes?.[0] === i}
                onClick={() => setChoiceAnswer([i])}
                className={`w-full text-start p-3 rounded-xl border transition-colors ${
                  currentAnswer?.choiceIndexes?.[0] === i ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                } ${isCorrectPreview && currentQuestion.correct_choice_indexes.includes(i) ? "border-emerald-500 bg-emerald-500/10" : ""}`}
              >
                {choice}
              </button>
            ))}
          </div>
        )}

        {currentQuestion.type === "multiple_choice" && (
          <div className="space-y-2">
            {currentQuestion.choices.map((choice, i) => {
              const checked = currentAnswer?.choiceIndexes?.includes(i) ?? false;
              return (
                <label key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const current = currentAnswer?.choiceIndexes ?? [];
                      setChoiceAnswer(e.target.checked ? [...current, i] : current.filter((x) => x !== i));
                    }}
                    className="w-4 h-4"
                  />
                  {choice}
                </label>
              );
            })}
          </div>
        )}

        {currentQuestion.type === "short_answer" && (
          <input
            value={currentAnswer?.text ?? ""}
            onChange={(e) => setTextAnswer(e.target.value)}
            className="w-full p-3 rounded-xl border border-border bg-background"
            aria-label={currentQuestion.prompt}
            placeholder="اكتب إجابتك..."
          />
        )}

        {currentQuestion.type === "essay" && (
          <Textarea value={currentAnswer?.text ?? ""} onChange={(e) => setTextAnswer(e.target.value)} className="rounded-xl min-h-32" aria-label={currentQuestion.prompt} placeholder="اكتب إجابتك التفصيلية..." />
        )}

        {currentQuestion.type === "code" && (
          <Textarea
            value={currentAnswer?.text ?? currentQuestion.code_starter ?? ""}
            onChange={(e) => setTextAnswer(e.target.value)}
            className="rounded-xl min-h-40 font-mono text-sm"
            dir="ltr"
            aria-label={currentQuestion.prompt}
          />
        )}
      </fieldset>

      {isCorrectPreview && currentQuestion.explanation && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground p-3 rounded-xl bg-muted/50">{currentQuestion.explanation}</p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => recordTimeAndAdvance(false)} disabled={currentIndex === 0} className="gap-2 rounded-xl">
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          السابق
        </Button>
        {quiz.instant_feedback && !showInstantFeedback && isAnswered && currentQuestion.type !== "essay" && currentQuestion.type !== "code" ? (
          <Button onClick={() => setShowInstantFeedback(true)} className="rounded-xl">تحقق</Button>
        ) : (
          <Button onClick={() => recordTimeAndAdvance(true)} disabled={!isAnswered} className="gap-2 rounded-xl">
            {currentIndex === orderedQuestions.length - 1 ? "إنهاء الاختبار" : "التالي"}
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
