import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLibraryAiAssistant } from "@/hooks/library/useLibraryAiAssistant";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";
import type { LibraryAiMode } from "@/services/library/aiAssistant";

interface AiAssistantPanelProps {
  bookId: string;
  chapterId: string | null;
  /** Pre-filled from HighlightSelectionPopover's "AI explain" action, if any. */
  initialSelectedText?: string;
}

const MODES: LibraryAiMode[] = [
  "summarize-chapter", "explain-paragraph", "explain-word", "translate-paragraph",
  "answer-question", "key-ideas", "flashcards", "quiz", "mind-map",
];
const TEXT_MODES: LibraryAiMode[] = ["explain-paragraph", "explain-word", "translate-paragraph"];

/**
 * Compact, context-aware AI panel for the reader — auto-fills the current
 * chapter/selection rather than asking the user to type/pick everything, so
 * it's a different component than the Book Details page's BookDetailsAI.tsx
 * (which is tightly bound to that page's own always-visible-labels layout).
 * Reuses useLibraryAiAssistant / runLibraryAiAssistant as-is — same backend,
 * same 9 modes, no new edge function.
 */
export function AiAssistantPanel({ bookId, chapterId, initialSelectedText }: AiAssistantPanelProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { run, result, isRunning, error } = useLibraryAiAssistant();
  const [mode, setMode] = useState<LibraryAiMode>(initialSelectedText ? "explain-paragraph" : "summarize-chapter");
  const [text, setText] = useState(initialSelectedText ?? "");
  const [question, setQuestion] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");

  useEffect(() => {
    if (initialSelectedText) {
      setText(initialSelectedText);
      setMode("explain-paragraph");
    }
  }, [initialSelectedText]);

  const handleRun = async () => {
    if (mode === "answer-question" && !question.trim()) return;
    if (TEXT_MODES.includes(mode) && !text.trim()) return;
    if (mode === "translate-paragraph" && !targetLanguage.trim()) return;

    await run({
      mode,
      book_id: mode === "answer-question" ? bookId : mode === "summarize-chapter" ? bookId : ["key-ideas", "flashcards", "quiz", "mind-map"].includes(mode) ? bookId : undefined,
      chapter_id: mode === "summarize-chapter" ? (chapterId ?? undefined) : undefined,
      text: TEXT_MODES.includes(mode) ? text : undefined,
      question: mode === "answer-question" ? question : undefined,
      targetLanguage: mode === "translate-paragraph" ? targetLanguage : undefined,
    });
    void logLibraryAnalyticsEvent("ai_assistant_used", { userId: user?.id ?? null, entityType: "book", entityId: bookId, metadata: { mode } });
  };

  return (
    <div className="space-y-3">
      <Select value={mode} onValueChange={(v) => setMode(v as LibraryAiMode)}>
        <SelectTrigger aria-label={t("library.ai.modeLabel")}><SelectValue /></SelectTrigger>
        <SelectContent>
          {MODES.map((m) => (
            <SelectItem key={m} value={m}>{t(`library.ai.mode.${m}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(TEXT_MODES.includes(mode) || mode === "answer-question") && (
        <Textarea
          value={mode === "answer-question" ? question : text}
          onChange={(e) => (mode === "answer-question" ? setQuestion(e.target.value) : setText(e.target.value))}
          rows={4}
          placeholder={mode === "answer-question" ? t("library.ai.questionLabel") : t("library.ai.textLabel")}
        />
      )}
      {mode === "translate-paragraph" && (
        <input
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          placeholder="English"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      )}

      <Button onClick={() => void handleRun()} disabled={isRunning} className="w-full">
        {isRunning ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="me-2 h-4 w-4" aria-hidden="true" />}
        {t("library.ai.run")}
      </Button>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {result && <CompactAiResult result={result} />}
    </div>
  );
}

function CompactAiResult({ result }: { result: NonNullable<ReturnType<typeof useLibraryAiAssistant>["result"]> }) {
  switch (result.mode) {
    case "summarize-book":
    case "summarize-chapter":
      return <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">{result.result.summary}</p>;
    case "key-ideas":
      return (
        <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted p-3 text-sm">
          {result.result.key_ideas.map((idea, i) => <li key={i}>{idea}</li>)}
        </ul>
      );
    case "flashcards":
      return (
        <div className="space-y-2">
          {result.result.flashcards.map((card, i) => (
            <div key={i} className="rounded-lg border p-2.5 text-sm">
              <p className="font-medium">{card.front}</p>
              <p className="mt-1 text-muted-foreground">{card.back}</p>
            </div>
          ))}
        </div>
      );
    case "quiz":
      return (
        <div className="space-y-3">
          {result.result.questions.map((q, i) => (
            <div key={i} className="rounded-lg border p-2.5 text-sm">
              <p className="font-medium">{i + 1}. {q.question}</p>
              <ul className="mt-1.5 space-y-0.5">
                {q.options.map((opt, oi) => (
                  <li key={oi} className={oi === q.correct_index ? "font-medium text-primary" : "text-muted-foreground"}>{opt}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case "mind-map":
      return (
        <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
          <p className="font-semibold">{result.result.central_topic}</p>
          {result.result.branches.map((b, i) => (
            <div key={i}>
              <p className="font-medium">{b.topic}</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {b.subtopics.map((s, si) => <li key={si}>{s}</li>)}
              </ul>
            </div>
          ))}
        </div>
      );
    case "answer-question":
      return <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">{result.result.answer}</p>;
    case "explain-paragraph":
      return <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">{result.result.explanation}</p>;
    case "explain-word":
      return (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p>{result.result.definition}</p>
          <p className="mt-1 italic text-muted-foreground">{result.result.example_usage}</p>
        </div>
      );
    case "translate-paragraph":
      return <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">{result.result.translated_text}</p>;
    default:
      return null;
  }
}
