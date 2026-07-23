import { useState } from "react";
import { Loader2, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibraryAiAssistant } from "@/hooks/library/useLibraryAiAssistant";
import { useAiReadingPreferences } from "@/hooks/library/useAiReadingPreferences";
import { useLibraryAiHistory } from "@/hooks/library/useLibraryAiHistory";
import { TRANSLATION_LANGUAGES } from "@/lib/library/translationLanguages";

interface TranslateTabProps {
  bookId: string;
  /** The active chapter's own content_text, already loaded client-side by
   *  the reader — "chapter" granularity translates this directly rather
   *  than needing a chapter_id round trip, since translate-paragraph is a
   *  plain-text mode server-side (see library-ai-assistant's TEXT_MODES),
   *  not a content-fetching one. */
  chapterContent: string | null;
  initialText?: string;
}

type Granularity = "word" | "sentence" | "paragraph" | "chapter";

/** Word/sentence/paragraph/chapter all go through the same
 *  translate-paragraph mode with whatever text applies — the model
 *  preserves formatting as much as possible regardless of granularity, so
 *  one mode covers all four; only the source text differs. */
export function TranslateTab({ bookId, chapterContent, initialText }: TranslateTabProps) {
  const { t } = useLanguage();
  const { run, result, isRunning, error } = useLibraryAiAssistant();
  const { lastTranslationLanguage, setLastTranslationLanguage } = useAiReadingPreferences();
  const { items: historyItems } = useLibraryAiHistory(bookId);
  const [granularity, setGranularity] = useState<Granularity>("paragraph");
  const [text, setText] = useState(initialText ?? "");
  const [targetLanguage, setTargetLanguage] = useState(lastTranslationLanguage ?? "");

  const recentTranslations = historyItems.filter((item) => item.type === "translation").slice(0, 5);

  const handleTranslate = () => {
    if (!targetLanguage.trim()) return;
    const sourceText = granularity === "chapter" ? (chapterContent ?? "") : text;
    if (!sourceText.trim()) return;
    void run({ mode: "translate-paragraph", book_id: bookId, text: sourceText, targetLanguage });
    setLastTranslationLanguage(targetLanguage);
  };

  return (
    <div className="space-y-3">
      <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
        <SelectTrigger aria-label={t("library.ai.translate.granularityLabel")}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="word">{t("library.ai.translate.word")}</SelectItem>
          <SelectItem value="sentence">{t("library.ai.translate.sentence")}</SelectItem>
          <SelectItem value="paragraph">{t("library.ai.translate.paragraph")}</SelectItem>
          <SelectItem value="chapter" disabled={!chapterContent}>{t("library.ai.translate.chapter")}</SelectItem>
        </SelectContent>
      </Select>

      {granularity !== "chapter" && (
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={t("library.ai.textLabel")} />
      )}

      <Select value={targetLanguage} onValueChange={setTargetLanguage}>
        <SelectTrigger aria-label={t("library.ai.targetLanguageLabel")}>
          <SelectValue placeholder={t("library.ai.targetLanguageLabel")} />
        </SelectTrigger>
        <SelectContent>
          {TRANSLATION_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.name}>
              {lang.nativeName} ({lang.name})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button onClick={handleTranslate} disabled={isRunning || !targetLanguage.trim() || (granularity === "chapter" ? !chapterContent : !text.trim())} className="w-full">
        {isRunning ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Languages className="me-2 h-4 w-4" aria-hidden="true" />}
        {t("library.ai.translate.action")}
      </Button>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result && result.mode === "translate-paragraph" && (
        <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed">{result.result.translated_text}</p>
      )}

      {recentTranslations.length > 0 && (
        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">{t("library.ai.translate.recent")}</p>
          <ul className="space-y-1">
            {recentTranslations.map((item) => (
              <li key={item.id} className="truncate text-xs text-muted-foreground">{item.title} — {item.snippet}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
