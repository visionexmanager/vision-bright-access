import { useState } from "react";
import { useParams } from "react-router-dom";
import { Layers, Plus, Trash2, RotateCw, CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useFlashcardStudyDeck } from "@/hooks/library/useFlashcardStudyDeck";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { cn } from "@/lib/utils";

const QUALITY_LEVELS = [0, 1, 2, 3, 4, 5];

export default function LibraryFlashcardStudyDeck() {
  const { deckId } = useParams<{ deckId: string }>();
  const { t } = useLanguage();
  const { deck, cards, dueCards, isLoading, sessionId, addCard, removeCard, startSession, endSession, review } = useFlashcardStudyDeck(deckId);
  const [addOpen, setAddOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [studyIndex, setStudyIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useDocumentHead({ title: deck?.title ?? t("library.flashcards.title") });

  const inSession = !!sessionId;
  const currentCard = dueCards[studyIndex];

  const handleStartSession = async () => {
    setStudyIndex(0);
    setIsFlipped(false);
    await startSession();
  };

  const handleRate = async (quality: number) => {
    if (!currentCard) return;
    await review(currentCard.id, quality);
    setIsFlipped(false);
    if (studyIndex + 1 < dueCards.length) {
      setStudyIndex((i) => i + 1);
    } else {
      await endSession();
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <LibraryLayout title={t("library.flashcards.title")} breadcrumb={[{ label: t("library.flashcards.title"), to: "/library/flashcards" }]}>
          <SkeletonLoader variant="detail" />
        </LibraryLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <LibraryLayout
        title={deck?.title ?? t("library.flashcards.title")}
        breadcrumb={[{ label: t("library.flashcards.title"), to: "/library/flashcards" }, { label: deck?.title ?? "" }]}
        headerActions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t("library.flashcards.cardCount").replace("{count}", String(cards.length))}</Badge>
            <Badge variant="secondary">{t("library.flashcards.dueCount").replace("{count}", String(dueCards.length))}</Badge>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.flashcards.addCard")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("library.flashcards.addCard")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label htmlFor="card-front">{t("library.flashcards.front")}</Label><Textarea id="card-front" value={front} onChange={(e) => setFront(e.target.value)} rows={2} /></div>
                  <div><Label htmlFor="card-back">{t("library.flashcards.back")}</Label><Textarea id="card-back" value={back} onChange={(e) => setBack(e.target.value)} rows={2} /></div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={!front.trim() || !back.trim()}
                    onClick={async () => { await addCard(front, back); setAddOpen(false); setFront(""); setBack(""); }}
                  >
                    {t("library.flashcards.addCard")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      >
        {inSession ? (
          currentCard ? (
            <div className="mx-auto max-w-lg space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                {t("library.flashcards.progressLabel").replace("{current}", String(studyIndex + 1)).replace("{total}", String(dueCards.length))}
              </p>
              <Card
                className="flex min-h-[220px] cursor-pointer items-center justify-center p-8 text-center"
                onClick={() => setIsFlipped((f) => !f)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsFlipped((f) => !f); }}
                aria-label={isFlipped ? currentCard.back : currentCard.front}
              >
                {currentCard.image_url && !isFlipped && <img src={currentCard.image_url} alt="" className="mb-3 max-h-32 rounded-md" />}
                {currentCard.audio_url && !isFlipped && <audio controls src={currentCard.audio_url} className="mb-3" onClick={(e) => e.stopPropagation()} />}
                <p className="text-lg font-medium">{isFlipped ? currentCard.back : currentCard.front}</p>
              </Card>
              {!isFlipped ? (
                <Button className="w-full gap-1.5" onClick={() => setIsFlipped(true)}>
                  <RotateCw className="h-4 w-4" aria-hidden="true" /> {t("library.flashcards.showAnswer")}
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-center text-sm text-muted-foreground">{t("library.flashcards.rateRecall")}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {QUALITY_LEVELS.map((q) => (
                      <Button key={q} variant="outline" size="sm" onClick={() => void handleRate(q)}>
                        {t(`library.flashcards.quality.${q}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title={t("library.flashcards.sessionComplete")} className="py-12" />
          )
        ) : (
          <div className="space-y-6">
            {dueCards.length > 0 && (
              <Button size="lg" className="gap-1.5" onClick={() => void handleStartSession()}>
                <Layers className="h-4 w-4" aria-hidden="true" /> {t("library.flashcards.startSession")}
              </Button>
            )}
            {dueCards.length === 0 && cards.length > 0 && (
              <p className="text-sm text-muted-foreground">{t("library.flashcards.allCaughtUp")}</p>
            )}
            {cards.length === 0 ? (
              <EmptyState icon={<Layers className="h-8 w-8" />} title={t("library.flashcards.empty")} className="py-8" />
            ) : (
              <ul className="space-y-2">
                {cards.map((card) => (
                  <li key={card.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{card.front}</p>
                      <p className="text-sm text-muted-foreground">{card.back}</p>
                      <Badge variant="outline" className={cn("mt-1 text-xs", card.due_at <= new Date().toISOString() && "border-primary text-primary")}>
                        {t(`library.flashcards.difficulty.${card.difficulty}`)}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => void removeCard(card.id)} aria-label={t("library.reviews.delete")}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
