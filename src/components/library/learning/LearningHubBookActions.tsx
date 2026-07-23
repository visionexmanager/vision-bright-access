import { useNavigate } from "react-router-dom";
import { Layers, Loader2, ClipboardCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFlashcardDecks } from "@/hooks/library/useFlashcardDecks";
import { useLearningQuizzes } from "@/hooks/library/useLearningQuizzes";

interface LearningHubBookActionsProps {
  bookId: string;
  bookTitle: string;
}

/** Learning Hub AI-generation entry points surfaced from the book detail
 *  page (where book context already exists) — distinct from the ephemeral
 *  reader-sidebar AI flashcards/quiz, these persist into real Learning Hub
 *  study systems (spaced-repetition decks, structured practice exams). */
export function LearningHubBookActions({ bookId, bookTitle }: LearningHubBookActionsProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isGenerating, generateFromBook } = useFlashcardDecks();
  const { isGenerating: isGeneratingExam, generate: generateExam } = useLearningQuizzes(bookId);

  const handleGenerateFlashcards = async () => {
    const deckId = await generateFromBook(bookId, null, `${bookTitle} — Flashcards`);
    if (deckId) navigate(`/library/flashcards/${deckId}`);
  };

  const handleGenerateExam = async () => {
    const quizId = await generateExam({ title: `${bookTitle} — Practice Exam` });
    if (quizId) navigate(`/library/quizzes/${quizId}`);
  };

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Layers className="h-4 w-4" aria-hidden="true" /> {t("library.learningHub.title")}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" disabled={isGenerating} onClick={() => void handleGenerateFlashcards()}>
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Layers className="h-3.5 w-3.5" aria-hidden="true" />}
          {t("library.flashcards.aiGenerate")}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={isGeneratingExam} onClick={() => void handleGenerateExam()}>
          {isGeneratingExam ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />}
          {t("library.quizzes.aiGenerate")}
        </Button>
      </div>
    </Card>
  );
}
