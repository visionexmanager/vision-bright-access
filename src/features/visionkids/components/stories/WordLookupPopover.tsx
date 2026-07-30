import { useState } from "react";
import { BookOpenText, Languages, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface ExplainWordResult {
  definition: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
}

/**
 * Dictionary + Translation for the story reader. Reuses the existing
 * library-ai-assistant edge function's "explain-word"/"translate-paragraph"
 * modes (see that function: TEXT_MODES don't require book_id at all, so it
 * works standalone here) rather than standing up a second AI endpoint.
 */
export function WordLookupPopover({ selectedText }: { selectedText?: string }) {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState(selectedText ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplainWordResult | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    if (!word.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setTranslation(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("library-ai-assistant", {
        body: { mode: "explain-word", text: word.trim() },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setResult(data.result as ExplainWordResult);
    } catch {
      setError(t("kids.reader.lookupError"));
    } finally {
      setLoading(false);
    }
  };

  const translate = async () => {
    if (!word.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("library-ai-assistant", {
        body: { mode: "translate-paragraph", text: word.trim(), targetLanguage: lang },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setTranslation((data.result as { translated_text: string }).translated_text);
    } catch {
      setError(t("kids.reader.lookupError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <BookOpenText className="h-4 w-4" aria-hidden="true" />
          {t("kids.reader.dictionary")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="flex flex-col gap-3">
          <label htmlFor="kids-word-lookup" className="text-sm font-semibold">{t("kids.reader.lookupPrompt")}</label>
          <div className="flex gap-2">
            <Input
              id="kids-word-lookup"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder={t("kids.reader.lookupPlaceholder")}
            />
            <Button size="icon" variant="outline" onClick={lookup} disabled={loading} aria-label={t("kids.reader.lookUp")}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BookOpenText className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <Button size="icon" variant="outline" onClick={translate} disabled={loading} aria-label={t("kids.reader.translate")}>
              <Languages className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          {result && (
            <div className="rounded-lg bg-muted p-3 text-sm" aria-live="polite">
              <p className="font-semibold">{result.definition}</p>
              {result.example && <p className="mt-1 italic text-muted-foreground">"{result.example}"</p>}
              {result.synonyms?.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{t("kids.reader.synonyms")}: {result.synonyms.join(", ")}</p>
              )}
            </div>
          )}

          {translation && (
            <div className="rounded-lg bg-kids-secondary/10 p-3 text-sm" aria-live="polite">
              {translation}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
