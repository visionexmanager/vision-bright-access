import { FormEvent, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibraryAiAssistant } from "@/hooks/library/useLibraryAiAssistant";

interface QuestionsTabProps {
  bookId: string;
}

/** A lightweight single-question/single-answer mode (answer-question),
 *  distinct from the multi-turn Chat tab — same grounded-in-the-book
 *  guarantee, but no persisted conversation, for a quick one-off lookup
 *  ("Where does it discuss X?", "Give me all the definitions in this book").
 *  Evidence-based: shows which chapters the answer drew from, an
 *  alternative reading when the excerpts support more than one, and
 *  follow-up questions the reader can ask next with one click. */
export function QuestionsTab({ bookId }: QuestionsTabProps) {
  const { t } = useLanguage();
  const { run, result, isRunning, error } = useLibraryAiAssistant();
  const [question, setQuestion] = useState("");

  const ask = (q: string) => {
    if (!q.trim()) return;
    setQuestion(q);
    void run({ mode: "answer-question", book_id: bookId, question: q });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  const answer = result && result.mode === "answer-question" ? result.result : null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("library.ai.questions.hint")}</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder={t("library.ai.questions.placeholder")} />
        <Button type="submit" disabled={isRunning || !question.trim()} className="w-full">
          {isRunning ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="me-2 h-4 w-4" aria-hidden="true" />}
          {t("library.ai.questions.ask")}
        </Button>
      </form>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {answer && (
        <div className="space-y-3">
          <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">{answer.answer}</p>

          {answer.citations && answer.citations.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("library.ai.questions.sources")}</p>
              <div className="flex flex-wrap gap-1.5">
                {answer.citations.map((c) => (
                  <Badge key={c.chapterId} variant="outline">{c.chapterTitle ?? c.chapterId}</Badge>
                ))}
              </div>
            </div>
          )}

          {answer.alternative_interpretation && (
            <div className="rounded-lg border border-dashed p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("library.ai.questions.alternativeInterpretation")}</p>
              <p>{answer.alternative_interpretation}</p>
            </div>
          )}

          {answer.follow_up_questions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("library.ai.questions.followUps")}</p>
              <div className="flex flex-wrap gap-1.5">
                {answer.follow_up_questions.map((q) => (
                  <Button key={q} type="button" variant="outline" size="sm" className="h-auto whitespace-normal py-1 text-start text-xs" onClick={() => ask(q)}>
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
