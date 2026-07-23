import { useState } from "react";
import { Loader2, Sparkles, BookOpen, Lightbulb, Quote as QuoteIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSmartSummary } from "@/hooks/library/useSmartSummary";
import { useLibraryAiAssistant } from "@/hooks/library/useLibraryAiAssistant";
import { fetchQuotesForBook } from "@/services/library/quotes";
import { queryKeys } from "@/lib/api/queryKeys";
import { QuoteCard } from "@/components/library/QuoteCard";

interface SummaryTabProps {
  bookId: string;
  chapterId: string | null;
}

type Scope = "chapter" | "book";
type Length = "quick" | "medium" | "detailed";
/** The 6 options the spec asks for: 30-Second/2-Minute/Full map to the
 *  "summary" view's length select; Main Ideas/Key Lessons/Important Quotes
 *  are separate views below it. */
type View = "summary" | "mainIdeas" | "keyLessons" | "quotes";

export function SummaryTab({ bookId, chapterId }: SummaryTabProps) {
  const { t } = useLanguage();
  const { result: summaryResult, isLoading: summaryLoading, generate } = useSmartSummary(bookId);
  const { run, result: aiResult, isRunning: aiRunning } = useLibraryAiAssistant();
  const [scope, setScope] = useState<Scope>("chapter");
  const [length, setLength] = useState<Length>("medium");
  const [view, setView] = useState<View>("summary");

  const scopeDisabled = scope === "chapter" && !chapterId;

  const quotesQuery = useQuery({
    queryKey: queryKeys.library.quotesByBook(bookId),
    queryFn: () => fetchQuotesForBook(bookId, 5),
    enabled: view === "quotes",
  });

  const handleGenerateSummary = () => {
    setView("summary");
    void generate(scope, length, scope === "chapter" ? (chapterId ?? undefined) : undefined);
  };

  const handleMainIdeas = () => {
    setView("mainIdeas");
    void run({ mode: "key-ideas", book_id: bookId, chapter_id: scope === "chapter" ? (chapterId ?? undefined) : undefined });
  };

  const handleKeyLessons = () => {
    setView("keyLessons");
    void run({ mode: "key-lessons", book_id: bookId, chapter_id: scope === "chapter" ? (chapterId ?? undefined) : undefined });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <SelectTrigger aria-label={t("library.ai.summary.scopeLabel")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="chapter" disabled={!chapterId}>{t("library.ai.summary.scope.chapter")}</SelectItem>
            <SelectItem value="book">{t("library.ai.summary.scope.book")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={length} onValueChange={(v) => setLength(v as Length)}>
          <SelectTrigger aria-label={t("library.ai.summary.lengthLabel")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="quick">{t("library.ai.summary.length.quick")}</SelectItem>
            <SelectItem value="medium">{t("library.ai.summary.length.medium")}</SelectItem>
            <SelectItem value="detailed">{t("library.ai.summary.length.detailed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleGenerateSummary} disabled={summaryLoading || scopeDisabled} className="w-full">
        {summaryLoading ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="me-2 h-4 w-4" aria-hidden="true" />}
        {t("library.ai.summary.generate")}
      </Button>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-xs" onClick={handleMainIdeas} disabled={aiRunning || scopeDisabled}>
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {t("library.ai.summary.mainIdeas")}
        </Button>
        <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-xs" onClick={handleKeyLessons} disabled={aiRunning || scopeDisabled}>
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
          {t("library.ai.summary.keyLessons")}
        </Button>
        <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-xs" onClick={() => setView("quotes")}>
          <QuoteIcon className="h-4 w-4" aria-hidden="true" />
          {t("library.ai.summary.importantQuotes")}
        </Button>
      </div>

      {view === "summary" && summaryResult && (
        <div className="space-y-2 rounded-lg bg-muted p-3 text-sm leading-relaxed">
          <p className="whitespace-pre-line">{summaryResult.summary}</p>
          {summaryResult.cached && <Badge variant="outline" className="text-xs">{t("library.ai.summary.fromMemory")}</Badge>}
        </div>
      )}

      {view === "mainIdeas" && aiRunning && (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      )}
      {view === "mainIdeas" && !aiRunning && aiResult?.mode === "key-ideas" && (
        <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted p-3 text-sm">
          {aiResult.result.key_ideas.map((idea, i) => <li key={i}>{idea}</li>)}
        </ul>
      )}

      {view === "keyLessons" && aiRunning && (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      )}
      {view === "keyLessons" && !aiRunning && aiResult?.mode === "key-lessons" && (
        <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted p-3 text-sm">
          {aiResult.result.lessons.map((lesson, i) => <li key={i}>{lesson}</li>)}
        </ul>
      )}

      {view === "quotes" && (
        quotesQuery.isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
        ) : (quotesQuery.data?.length ?? 0) === 0 ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("library.ai.summary.quotesEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {quotesQuery.data!.map((q) => <QuoteCard key={q.id} quote={q} />)}
          </div>
        )
      )}
    </div>
  );
}
