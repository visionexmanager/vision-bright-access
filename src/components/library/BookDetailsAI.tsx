import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibraryAiAssistant } from "@/hooks/library/useLibraryAiAssistant";
import { TRANSLATION_LANGUAGES } from "@/lib/library/translationLanguages";
import type { LibraryAiMode } from "@/services/library/aiAssistant";
import type { LibraryChapterRow } from "@/lib/types/library-book";

interface BookDetailsAIProps {
  bookId: string;
  chapters: LibraryChapterRow[];
}

// character-explorer/concepts-explorer/timeline/key-lessons (Phase 8) had no
// frontend caller anywhere before this — the backend modes existed but were
// unreachable, which meant "explain characters"/"explain scientific
// concepts" had no actual UI path despite the backend supporting both.
const BOOK_SCOPED_MODES: LibraryAiMode[] = [
  "summarize-book", "key-ideas", "key-lessons", "flashcards", "quiz", "mind-map",
  "timeline", "character-explorer", "concepts-explorer",
];
const CHAPTER_MODE: LibraryAiMode = "summarize-chapter";
const QUESTION_MODE: LibraryAiMode = "answer-question";
const TEXT_MODES: LibraryAiMode[] = ["explain-paragraph", "explain-word", "translate-paragraph"];
const ALL_MODES: LibraryAiMode[] = [...BOOK_SCOPED_MODES, CHAPTER_MODE, QUESTION_MODE, ...TEXT_MODES];

export function BookDetailsAI({ bookId, chapters }: BookDetailsAIProps) {
  const { t } = useLanguage();
  const { run, result, isRunning, error } = useLibraryAiAssistant();
  const [mode, setMode] = useState<LibraryAiMode>("summarize-book");
  const [chapterId, setChapterId] = useState<string>("");
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");

  const handleRun = async () => {
    if (mode === CHAPTER_MODE && !chapterId) return;
    if (mode === QUESTION_MODE && !question.trim()) return;
    if (TEXT_MODES.includes(mode) && !text.trim()) return;
    if (mode === "translate-paragraph" && !targetLanguage.trim()) return;

    await run({
      mode,
      // This page is always scoped to one book, so book_id is always known
      // — sent for every mode (including translate-paragraph/explain-
      // paragraph) so their history/activity log entries attach to it.
      book_id: bookId,
      chapter_id: mode === CHAPTER_MODE ? chapterId : undefined,
      text: TEXT_MODES.includes(mode) ? text : undefined,
      question: mode === QUESTION_MODE ? question : undefined,
      targetLanguage: mode === "translate-paragraph" ? targetLanguage : undefined,
    });
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t("library.ai.title")}</h2>
      </div>

      <div>
        <label htmlFor="ai-mode" className="mb-1.5 block text-sm font-medium">{t("library.ai.modeLabel")}</label>
        <Select value={mode} onValueChange={(v) => setMode(v as LibraryAiMode)}>
          <SelectTrigger id="ai-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_MODES.map((m) => (
              <SelectItem key={m} value={m}>{t(`library.ai.mode.${m}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === CHAPTER_MODE && (
        <div>
          <label htmlFor="ai-chapter" className="mb-1.5 block text-sm font-medium">{t("library.bookDetails.chapters")}</label>
          <Select value={chapterId} onValueChange={setChapterId}>
            <SelectTrigger id="ai-chapter">
              <SelectValue placeholder={t("library.ai.chapterPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {chapters.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title || `${t("library.bookDetails.chapter")} ${c.chapter_number}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {mode === QUESTION_MODE && (
        <div>
          <label htmlFor="ai-question" className="mb-1.5 block text-sm font-medium">{t("library.ai.questionLabel")}</label>
          <Textarea id="ai-question" value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} />
        </div>
      )}

      {TEXT_MODES.includes(mode) && (
        <div>
          <label htmlFor="ai-text" className="mb-1.5 block text-sm font-medium">{t("library.ai.textLabel")}</label>
          <Textarea id="ai-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        </div>
      )}

      {mode === "translate-paragraph" && (
        <div>
          <label htmlFor="ai-target-lang" className="mb-1.5 block text-sm font-medium">{t("library.ai.targetLanguageLabel")}</label>
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger id="ai-target-lang"><SelectValue placeholder={t("library.ai.targetLanguageLabel")} /></SelectTrigger>
            <SelectContent>
              {TRANSLATION_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.name}>{lang.nativeName} ({lang.name})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button onClick={handleRun} disabled={isRunning}>
        {isRunning ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="me-2 h-4 w-4" aria-hidden="true" />}
        {t("library.ai.run")}
      </Button>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {result && <AiResultView result={result} />}
    </Card>
  );
}

function AiResultView({ result }: { result: NonNullable<ReturnType<typeof useLibraryAiAssistant>["result"]> }) {
  const { t } = useLanguage();

  switch (result.mode) {
    case "summarize-book":
    case "summarize-chapter":
      return <p className="rounded-lg bg-muted p-4 text-sm leading-relaxed">{result.result.summary}</p>;
    case "key-ideas":
      return (
        <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted p-4 text-sm">
          {result.result.key_ideas.map((idea, i) => <li key={i}>{idea}</li>)}
        </ul>
      );
    case "key-lessons":
      return (
        <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted p-4 text-sm">
          {result.result.lessons.map((lesson, i) => <li key={i}>{lesson}</li>)}
        </ul>
      );
    case "timeline":
      return result.result.applicable ? (
        <ol className="space-y-3 rounded-lg bg-muted p-4 text-sm">
          {result.result.events.map((e, i) => (
            <li key={i} className="border-s-2 border-primary/40 ps-3">
              <p className="text-xs text-muted-foreground">{e.date_or_period} — {e.chapter_reference}</p>
              <p className="font-medium">{e.title}</p>
              <p className="text-muted-foreground">{e.description}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{t("library.ai.timeline.notApplicable")}</p>
      );
    case "character-explorer":
      return result.result.applicable ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.result.characters.map((c, i) => (
            <div key={i} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{c.name}</p>
              <p className="mt-1 text-muted-foreground">{c.description}</p>
              {c.relationships.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {c.relationships.map((r, ri) => <li key={ri}>{r.with} — {r.type}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{t("library.ai.characters.notApplicable")}</p>
      );
    case "concepts-explorer":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {result.result.concepts.map((c, i) => (
            <div key={i} className="rounded-lg border p-3 text-sm">
              <Badge variant="outline" className="mb-1 text-xs">{c.category}</Badge>
              <p className="font-medium">{c.term}</p>
              <p className="mt-1 text-muted-foreground">{c.definition}</p>
            </div>
          ))}
        </div>
      );
    case "flashcards":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {result.result.flashcards.map((card, i) => (
            <div key={i} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{card.front}</p>
              <p className="mt-1 text-muted-foreground">{card.back}</p>
            </div>
          ))}
        </div>
      );
    case "quiz":
      return (
        <div className="space-y-4">
          {result.result.questions.map((q, i) => (
            <div key={i} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{i + 1}. {q.question}</p>
              <ul className="mt-2 space-y-1">
                {q.options.map((opt, oi) => (
                  <li key={oi} className={oi === q.correct_index ? "font-medium text-primary" : "text-muted-foreground"}>
                    {opt}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>
            </div>
          ))}
        </div>
      );
    case "mind-map":
      return (
        <div className="rounded-lg bg-muted p-4 text-sm">
          <Badge className="mb-2">{result.result.central_topic}</Badge>
          <div className="grid gap-2 sm:grid-cols-2">
            {result.result.branches.map((b, i) => (
              <div key={i} className="rounded-lg border bg-background p-3">
                <p className="font-medium">{b.topic}</p>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">
                  {b.subtopics.map((s, si) => <li key={si}>{s}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    case "answer-question":
      return <p className="rounded-lg bg-muted p-4 text-sm leading-relaxed">{result.result.answer}</p>;
    case "explain-paragraph":
      return <p className="rounded-lg bg-muted p-4 text-sm leading-relaxed">{result.result.explanation}</p>;
    case "explain-word":
      return (
        <div className="rounded-lg bg-muted p-4 text-sm">
          <p>{result.result.definition}</p>
          <p className="mt-1 italic text-muted-foreground">{result.result.example_usage}</p>
        </div>
      );
    case "translate-paragraph":
      return <p className="rounded-lg bg-muted p-4 text-sm leading-relaxed">{result.result.translated_text}</p>;
    default:
      return null;
  }
}
