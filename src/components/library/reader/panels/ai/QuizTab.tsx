import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuizAttempts } from "@/hooks/library/useQuizAttempts";
import { gradeQuiz } from "@/services/library/quizzes";

interface QuizTabProps {
  bookId: string;
  chapterId: string | null;
}

export function QuizTab({ bookId, chapterId }: QuizTabProps) {
  const { t } = useLanguage();
  const { quiz, isGenerating, generate, submit, lastAttempt } = useQuizAttempts(bookId, chapterId ?? undefined);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerate = () => {
    setAnswers({});
    setSubmitted(false);
    void generate();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await submit(answers);
    setSubmitted(true);
    setIsSubmitting(false);
  };

  const preview = quiz ? gradeQuiz(quiz, answers) : null;

  return (
    <div className="space-y-4">
      <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
        {isGenerating ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="me-2 h-4 w-4" aria-hidden="true" />}
        {t("library.ai.quiz.generate")}
      </Button>

      {quiz && (
        <div className="space-y-4">
          {quiz.questions.map((q, i) => {
            const isCorrect = submitted && (
              q.type === "multiple-choice" || q.type === "true-false"
                ? Number(answers[i]) === q.correct_index
                : answers[i]?.trim().toLowerCase() === q.expected_answer.trim().toLowerCase()
            );
            return (
              <div key={i} className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">{i + 1}. {q.question}</p>

                {(q.type === "multiple-choice" || q.type === "true-false") ? (
                  <RadioGroup value={answers[i] ?? ""} onValueChange={(v) => setAnswers((prev) => ({ ...prev, [i]: v }))} disabled={submitted}>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <RadioGroupItem value={String(oi)} id={`q${i}-${oi}`} />
                        <Label htmlFor={`q${i}-${oi}`} className="text-sm font-normal">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Input
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                    disabled={submitted}
                    placeholder={t("library.ai.quiz.yourAnswer")}
                  />
                )}

                {submitted && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs">
                    {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />}
                    <span className="text-muted-foreground">{q.explanation}</span>
                  </div>
                )}
              </div>
            );
          })}

          {!submitted ? (
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("library.ai.quiz.submit")}
            </Button>
          ) : (
            <p className="text-center text-sm font-medium" aria-live="polite">
              {t("library.ai.quiz.score").replace("{score}", String(lastAttempt?.score ?? preview?.score ?? 0)).replace("{total}", String(lastAttempt?.total ?? preview?.total ?? quiz.questions.length))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
