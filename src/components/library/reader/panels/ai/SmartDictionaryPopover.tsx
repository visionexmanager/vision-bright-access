import { useEffect, useState } from "react";
import { Loader2, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibraryAiAssistant } from "@/hooks/library/useLibraryAiAssistant";
import { synthesizeSpeech } from "@/lib/library/textToSpeech";

interface SmartDictionaryPopoverProps {
  word: string;
  /** The sentence the word was double-clicked in, if available — gives the
   *  model context so it defines the word as actually used here. */
  sentenceContext?: string;
  onClose: () => void;
}

/** Tap-a-word lookup: meaning/pronunciation/examples/synonyms/antonyms.
 *  Reuses the widened explain-word mode for the text side and the existing
 *  text-to-speech edge function (unmodified) for pronunciation — same
 *  helper Phase 6's quote read-aloud already uses. */
export function SmartDictionaryPopover({ word, sentenceContext, onClose }: SmartDictionaryPopoverProps) {
  const { t } = useLanguage();
  const { run, result, isRunning, error } = useLibraryAiAssistant();
  const [isPronouncing, setIsPronouncing] = useState(false);

  useEffect(() => {
    void run({ mode: "explain-word", text: sentenceContext ? `${word}\n\nContext: "${sentenceContext}"` : word });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  const handlePronounce = async () => {
    setIsPronouncing(true);
    try {
      const url = await synthesizeSpeech(word);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // Non-critical — pronunciation is a nice-to-have, silently ignore failures.
    } finally {
      setIsPronouncing(false);
    }
  };

  return (
    <div role="dialog" aria-label={t("library.ai.dictionary.title")} className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl border bg-popover p-4 shadow-lg sm:inset-x-auto">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{word}</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void handlePronounce()} disabled={isPronouncing} aria-label={t("library.ai.dictionary.pronounce")}>
            {isPronouncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label={t("library.common.cancel")}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      {isRunning && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {result && result.mode === "explain-word" && (
        <div className="space-y-2 text-sm">
          <p>{result.result.definition}</p>
          <p className="italic text-muted-foreground">{result.result.example_usage}</p>
          {result.result.synonyms.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">{t("library.ai.dictionary.synonyms")}: </span>
              {result.result.synonyms.map((s) => <Badge key={s} variant="outline" className="me-1 text-xs">{s}</Badge>)}
            </div>
          )}
          {result.result.antonyms.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">{t("library.ai.dictionary.antonyms")}: </span>
              {result.result.antonyms.map((a) => <Badge key={a} variant="outline" className="me-1 text-xs">{a}</Badge>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
