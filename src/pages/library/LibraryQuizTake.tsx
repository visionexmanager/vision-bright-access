import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, ClipboardCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuizAttempt } from "@/hooks/library/useQuizAttempt";
import { useCertificates } from "@/hooks/library/useCertificates";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { cn } from "@/lib/utils";
import type { LibraryQuizAttemptQuestion } from "@/lib/types/library-learning";

function MatchingQuestion({ question, value, onChange }: { question: LibraryQuizAttemptQuestion; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const pairs = (question.options as { left: string; right: string }[] | null) ?? [];
  const rightOptions = useMemo(() => pairs.map((p) => p.right), [pairs]);
  return (
    <div className="space-y-2">
      {pairs.map((pair) => (
        <div key={pair.left} className="flex items-center gap-2">
          <span className="flex-1 text-sm">{pair.left}</span>
          <Select value={value[pair.left] ?? ""} onValueChange={(v) => onChange({ ...value, [pair.left]: v })}>
            <SelectTrigger className="w-48" aria-label={pair.left}><SelectValue /></SelectTrigger>
            <SelectContent>{rightOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

export default function LibraryQuizTake() {
  const { quizId } = useParams<{ quizId: string }>();
  const { t } = useLanguage();
  const { quiz, questions, isLoading, answers, setAnswer, results, submit, isSubmitting } = useQuizAttempt(quizId);
  const { isIssuing, issue } = useCertificates();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useDocumentHead({ title: quiz?.title ?? t("library.quizzes.title") });

  useEffect(() => {
    if (!quiz?.is_timed || !quiz.time_limit_minutes || results) return;
    setSecondsLeft(quiz.time_limit_minutes * 60);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          clearInterval(interval);
          void submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.is_timed, quiz?.time_limit_minutes, results]);

  if (isLoading) {
    return (
      <Layout>
        <LibraryLayout title={t("library.quizzes.title")}><SkeletonLoader variant="detail" /></LibraryLayout>
      </Layout>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <Layout>
        <LibraryLayout title={t("library.quizzes.title")}>
          <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title={t("library.quizzes.notFound")} className="py-12" />
        </LibraryLayout>
      </Layout>
    );
  }

  const resultByQuestion = new Map((results ?? []).map((r) => [r.question_id, r]));
  const timeLabel = secondsLeft != null ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : null;

  return (
    <Layout>
      <LibraryLayout
        title={quiz.title}
        breadcrumb={[{ label: quiz.title }]}
        headerActions={
          quiz.is_timed && quiz.time_limit_minutes && !results ? (
            <Badge variant="outline" className="gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {timeLabel ?? t("library.quizzes.timeLimit").replace("{minutes}", String(quiz.time_limit_minutes))}</Badge>
          ) : undefined
        }
      >
        {results ? (
          <div className="space-y-4">
            <Card className="space-y-2 p-5 text-center">
              <p className="text-2xl font-bold">{t("library.quizzes.score").replace("{score}", String(results[0]?.score_percent ?? 0))}</p>
              {!results.some((r) => r.needs_manual_grading) && (
                <Badge variant={results[0]?.passed ? "default" : "destructive"}>
                  {results[0]?.passed ? t("library.quizzes.passed") : t("library.quizzes.failed")}
                </Badge>
              )}
              {quiz.is_timed && results[0]?.passed && quizId && (
                <div>
                  <Button size="sm" variant="outline" disabled={isIssuing} onClick={() => void issue("exam", quizId)}>
                    {isIssuing ? t("library.certificates.claiming") : t("library.certificates.claim")}
                  </Button>
                </div>
              )}
              {results.some((r) => r.needs_manual_grading) && (
                <p className="text-sm text-muted-foreground">{t("library.quizzes.needsGrading")}</p>
              )}
            </Card>
            <ul className="space-y-3">
              {questions.map((q) => {
                const result = resultByQuestion.get(q.id);
                return (
                  <li key={q.id} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="font-medium">{q.question_text}</p>
                      {result?.needs_manual_grading ? null : result?.is_correct ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                      )}
                    </div>
                    {result?.explanation && <p className="text-sm text-muted-foreground">{result.explanation}</p>}
                  </li>
                );
              })}
            </ul>
            <Button asChild variant="outline"><Link to={`/library/books/${quiz.book_id}`}>{t("library.quizzes.backToBook")}</Link></Button>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((q, index) => (
              <Card key={q.id} className="space-y-3 p-4">
                <p className="text-xs text-muted-foreground">{t("library.quizzes.question").replace("{current}", String(index + 1)).replace("{total}", String(questions.length))}</p>
                <p className="font-medium">{q.question_text}</p>

                {q.question_type === "multiple_choice" && (
                  <div className="space-y-1.5">
                    {((q.options as string[] | null) ?? []).map((opt, i) => (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={answers[q.id] === i}
                        onClick={() => setAnswer(q.id, i)}
                        className={cn(
                          "w-full rounded-md border p-2 text-start text-sm transition-colors",
                          answers[q.id] === i ? "border-primary bg-primary/10" : "hover:bg-muted",
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {q.question_type === "true_false" && (
                  <div className="flex gap-2">
                    <Button variant={answers[q.id] === true ? "default" : "outline"} aria-pressed={answers[q.id] === true} onClick={() => setAnswer(q.id, true)}>{t("library.quizzes.trueOrFalse.true")}</Button>
                    <Button variant={answers[q.id] === false ? "default" : "outline"} aria-pressed={answers[q.id] === false} onClick={() => setAnswer(q.id, false)}>{t("library.quizzes.trueOrFalse.false")}</Button>
                  </div>
                )}

                {(q.question_type === "short_answer" || q.question_type === "fill_blank") && (
                  <Input value={(answers[q.id] as string) ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} placeholder={t("library.quizzes.yourAnswer")} />
                )}

                {q.question_type === "essay" && (
                  <div>
                    <Label htmlFor={`essay-${q.id}`} className="text-xs text-muted-foreground">{t("library.quizzes.yourAnswer")}</Label>
                    <Textarea id={`essay-${q.id}`} value={(answers[q.id] as string) ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} rows={5} />
                  </div>
                )}

                {q.question_type === "matching" && (
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">{t("library.quizzes.matchingInstructions")}</p>
                    <MatchingQuestion question={q} value={(answers[q.id] as Record<string, string>) ?? {}} onChange={(v) => setAnswer(q.id, v)} />
                  </div>
                )}
              </Card>
            ))}
            <Button size="lg" disabled={isSubmitting} onClick={() => void submit()}>
              {isSubmitting ? t("library.quizzes.submitting") : t("library.quizzes.submit")}
            </Button>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
