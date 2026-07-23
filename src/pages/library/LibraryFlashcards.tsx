import { useState } from "react";
import { Link } from "react-router-dom";
import { Layers, Plus, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useFlashcardDecks } from "@/hooks/library/useFlashcardDecks";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryFlashcards() {
  const { t } = useLanguage();
  const { decks, isLoading, createDeck } = useFlashcardDecks();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  useDocumentHead({ title: t("library.flashcards.title") });

  return (
    <Layout>
      <LibraryLayout
        title={t("library.flashcards.title")}
        breadcrumb={[{ label: t("library.flashcards.title") }]}
        headerActions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" aria-hidden="true" /> {t("library.flashcards.createDeck")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("library.flashcards.createDeck")}</DialogTitle></DialogHeader>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("library.flashcards.deckNamePlaceholder")} />
              <DialogFooter>
                <Button
                  disabled={!title.trim()}
                  onClick={async () => {
                    const deck = await createDeck(title.trim());
                    if (deck) { setOpen(false); setTitle(""); }
                  }}
                >
                  {t("library.flashcards.createDeck")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {isLoading ? (
          <SkeletonLoader variant="grid" />
        ) : decks.length === 0 ? (
          <EmptyState icon={<Layers className="h-8 w-8" />} title={t("library.flashcards.empty")} className="py-8" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <Link key={deck.id} to={`/library/flashcards/${deck.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Layers className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                      <span className="line-clamp-1">{deck.title}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={deck.is_ai_generated ? "secondary" : "outline"} className="gap-1">
                      {deck.is_ai_generated && <Sparkles className="h-3 w-3" aria-hidden="true" />}
                      {deck.is_ai_generated ? t("library.flashcards.aiDeck") : t("library.flashcards.manualDeck")}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
