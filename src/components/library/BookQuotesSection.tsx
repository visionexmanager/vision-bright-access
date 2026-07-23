import { useEffect, useRef, useState } from "react";
import { Bookmark, Copy, Loader2, Pause, Play, Quote, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedQuotes } from "@/hooks/library/useSavedQuotes";
import { synthesizeSpeech } from "@/lib/library/textToSpeech";
import { cn } from "@/lib/utils";

interface BookQuotesSectionProps {
  bookId: string;
}

export function BookQuotesSection({ bookId }: BookQuotesSectionProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { quotes, isLoading, isSaved, toggleSave } = useSavedQuotes(bookId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t("library.quotes.copied") });
    } catch {
      toast({ title: t("library.share.failed"), variant: "destructive" });
    }
  };

  const handleShare = async (text: string, bookTitle: string) => {
    const shareText = `"${text}" — ${bookTitle}`;
    if (navigator.share) {
      try { await navigator.share({ text: shareText }); } catch { /* cancelled */ }
      return;
    }
    await handleCopy(shareText);
  };

  const handleListen = async (quoteId: string, text: string) => {
    if (playingId === quoteId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    setLoadingAudioId(quoteId);
    try {
      const objectUrl = await synthesizeSpeech(text);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = objectUrl;
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = objectUrl;
      audioRef.current.onended = () => setPlayingId(null);
      await audioRef.current.play();
      setPlayingId(quoteId);
    } catch (err) {
      toast({ title: t("library.quotes.listenFailed"), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoadingAudioId(null);
    }
  };

  if (isLoading) return <SkeletonLoader variant="grid" count={3} />;
  if (quotes.length === 0) return <EmptyState icon={<Quote className="h-8 w-8" />} title={t("library.quotes.noneForBook")} className="py-8" />;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {quotes.map((quote) => (
        <Card key={quote.id} className="flex flex-col gap-3 p-5">
          <Quote className="h-6 w-6 text-primary/50" aria-hidden="true" />
          <p className="flex-1 text-sm italic leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">{quote.like_count} {t("library.quotes.likes")}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(quote.text)} aria-label={t("library.quotes.copy")}>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleShare(quote.text, quote.book_title)} aria-label={t("library.actions.share")}>
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleListen(quote.id, quote.text)}
                disabled={loadingAudioId === quote.id}
                aria-label={playingId === quote.id ? t("library.quotes.pause") : t("library.quotes.listen")}
              >
                {loadingAudioId === quote.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : playingId === quote.id ? (
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </Button>
              {user && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleSave(quote.id)}
                  aria-pressed={isSaved(quote.id)}
                  aria-label={isSaved(quote.id) ? t("library.quotes.unsave") : t("library.quotes.save")}
                >
                  <Bookmark className={cn("h-3.5 w-3.5", isSaved(quote.id) && "fill-current")} aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
