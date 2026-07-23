import { useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/library/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFlashcardDeck } from "@/hooks/library/useFlashcardDeck";

interface FlashcardsTabProps {
  bookId: string;
  chapterId: string | null;
}

export function FlashcardsTab({ bookId, chapterId }: FlashcardsTabProps) {
  const { t } = useLanguage();
  const { savedCards, isLoading, generated, isGenerating, generate, saveGenerated, toggleMastered, remove } = useFlashcardDeck(bookId, chapterId ?? undefined);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <Button onClick={() => void generate()} disabled={isGenerating} className="w-full">
        {isGenerating ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="me-2 h-4 w-4" aria-hidden="true" />}
        {t("library.ai.flashcards.generate")}
      </Button>

      {generated && generated.length > 0 && (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">{t("library.ai.flashcards.newBatch")}</p>
          {generated.map((c, i) => (
            <div key={i} className="rounded-lg bg-muted p-2.5 text-sm">
              <p className="font-medium">{c.front}</p>
              <p className="mt-1 text-muted-foreground">{c.back}</p>
            </div>
          ))}
          <Button size="sm" onClick={() => void saveGenerated()} className="w-full">{t("library.ai.flashcards.save")}</Button>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">{t("library.ai.flashcards.yourDeck")}</p>
        {isLoading ? null : savedCards.length === 0 ? (
          <EmptyState title={t("library.ai.flashcards.empty")} className="py-6" />
        ) : (
          <ul className="space-y-2">
            {savedCards.map((card, i) => (
              <li key={card.id} className="rounded-lg border p-2.5 text-sm">
                <button
                  type="button"
                  onClick={() => setFlippedIndex(flippedIndex === i ? null : i)}
                  className="w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {flippedIndex === i ? card.back : card.front}
                </button>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={card.mastered} onCheckedChange={(checked) => void toggleMastered(card.id, checked === true)} />
                    {t("library.ai.flashcards.mastered")}
                  </label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void remove(card.id)} aria-label={t("library.reviews.delete")}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
