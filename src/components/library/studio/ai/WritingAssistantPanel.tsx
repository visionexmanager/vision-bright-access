import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibraryWritingAssistant } from "@/hooks/library/useLibraryWritingAssistant";
import { TRANSLATION_LANGUAGES } from "@/lib/library/translationLanguages";
import type { LibraryWritingAiMode } from "@/services/library/writingAssistant";

interface WritingAssistantPanelProps {
  bookId: string;
  editor: Editor;
}

const TEXT_MODES: LibraryWritingAiMode[] = ["grammar-correction", "rewrite", "expand", "shorten", "translate", "writing-style-suggestions", "academic-assistant", "citation-suggestions"];
const PROMPT_MODES: LibraryWritingAiMode[] = ["generate-chapters", "generate-titles", "generate-descriptions", "generate-keywords", "generate-cover-ideas", "character-builder", "story-ideas"];
const ALL_MODES: LibraryWritingAiMode[] = [...TEXT_MODES, ...PROMPT_MODES];

/** Docks into the Studio editor shell. Text-transform modes default to the
 *  current editor selection (grammar-correction/rewrite/expand/shorten/
 *  translate/style-suggestions/academic/citations) and can insert the
 *  result back in place of that selection; generate-* modes work from a
 *  freeform prompt instead, since they invent new material rather than
 *  transforming existing text. */
export function WritingAssistantPanel({ editor }: WritingAssistantPanelProps) {
  const { t } = useLanguage();
  const { run, result, isRunning, error } = useLibraryWritingAssistant();
  const [mode, setMode] = useState<LibraryWritingAiMode>("grammar-correction");
  const [text, setText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState("");
  const [theme, setTheme] = useState("");

  const useSelection = () => {
    const { from, to } = editor.state.selection;
    setText(editor.state.doc.textBetween(from, to, " "));
  };

  const handleRun = async () => {
    if (TEXT_MODES.includes(mode)) {
      if (!text.trim()) return;
      if (mode === "translate" && !targetLanguage) return;
      await run({ mode, text, targetLanguage: mode === "translate" ? targetLanguage : undefined });
    } else {
      if (!prompt.trim()) return;
      await run({ mode, prompt, genre: mode === "story-ideas" ? genre : undefined, theme: mode === "story-ideas" ? theme : undefined });
    }
  };

  const insertResult = (value: string) => {
    const { from, to } = editor.state.selection;
    editor.chain().focus().insertContentAt({ from, to }, value).run();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{t("library.studio.ai.title")}</h3>
      </div>

      <Select value={mode} onValueChange={(v) => setMode(v as LibraryWritingAiMode)}>
        <SelectTrigger aria-label={t("library.studio.ai.title")}><SelectValue /></SelectTrigger>
        <SelectContent>
          {ALL_MODES.map((m) => <SelectItem key={m} value={m}>{t(`library.studio.ai.mode.${m}`)}</SelectItem>)}
        </SelectContent>
      </Select>

      {TEXT_MODES.includes(mode) ? (
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={useSelection}>
            <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("library.studio.ai.useSelection")}
          </Button>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={t("library.studio.ai.textPlaceholder")} />
          {mode === "translate" && (
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger aria-label={t("library.ai.targetLanguageLabel")}><SelectValue placeholder={t("library.ai.targetLanguageLabel")} /></SelectTrigger>
              <SelectContent>
                {TRANSLATION_LANGUAGES.map((lang) => <SelectItem key={lang.code} value={lang.name}>{lang.nativeName} ({lang.name})</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder={t("library.studio.ai.promptPlaceholder")} />
          {mode === "story-ideas" && (
            <div className="grid grid-cols-2 gap-2">
              <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder={t("library.studio.ai.genrePlaceholder")} />
              <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={t("library.studio.ai.themePlaceholder")} />
            </div>
          )}
        </div>
      )}

      <Button onClick={() => void handleRun()} disabled={isRunning} className="w-full">
        {isRunning ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="me-2 h-4 w-4" aria-hidden="true" />}
        {t("library.studio.ai.run")}
      </Button>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result && <WritingAiResultView result={result} onInsert={insertResult} />}
    </div>
  );
}

function WritingAiResultView({ result, onInsert }: { result: NonNullable<ReturnType<typeof useLibraryWritingAssistant>["result"]>; onInsert: (text: string) => void }) {
  const { t } = useLanguage();

  const InsertButton = ({ value }: { value: string }) => (
    <Button variant="ghost" size="sm" className="mt-1.5 h-7 px-2 text-xs" onClick={() => onInsert(value)}>
      {t("library.studio.ai.insertIntoEditor")}
    </Button>
  );

  switch (result.mode) {
    case "grammar-correction":
      return (
        <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
          <p className="whitespace-pre-line">{result.result.corrected_text}</p>
          <InsertButton value={result.result.corrected_text} />
          {result.result.changes.length > 0 && (
            <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
              {result.result.changes.map((c, i) => <li key={i}>"{c.original}" → "{c.corrected}" — {c.reason}</li>)}
            </ul>
          )}
        </div>
      );
    case "rewrite":
    case "expand":
    case "shorten":
      return (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="whitespace-pre-line">{result.result.result_text}</p>
          <InsertButton value={result.result.result_text} />
        </div>
      );
    case "translate":
      return (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="whitespace-pre-line">{result.result.translated_text}</p>
          <InsertButton value={result.result.translated_text} />
        </div>
      );
    case "generate-chapters":
      return (
        <ul className="space-y-2 rounded-lg bg-muted p-3 text-sm">
          {result.result.chapters.map((c, i) => (
            <li key={i}><span className="font-medium">{i + 1}. {c.title}</span> — {c.summary}</li>
          ))}
        </ul>
      );
    case "generate-titles":
      return (
        <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted p-3 text-sm">
          {result.result.titles.map((title, i) => <li key={i}>{title}</li>)}
        </ul>
      );
    case "generate-descriptions":
      return (
        <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
          <p><span className="font-medium">{t("library.studio.ai.shortDescription")}:</span> {result.result.short_description}</p>
          <p className="whitespace-pre-line"><span className="font-medium">{t("library.studio.ai.longDescription")}:</span> {result.result.long_description}</p>
        </div>
      );
    case "generate-keywords":
      return (
        <div className="flex flex-wrap gap-1.5 rounded-lg bg-muted p-3">
          {result.result.keywords.map((k, i) => <Badge key={i} variant="outline">{k}</Badge>)}
        </div>
      );
    case "generate-cover-ideas":
      return (
        <ul className="space-y-2 rounded-lg bg-muted p-3 text-sm">
          {result.result.prompts.map((p, i) => (
            <li key={i} className="rounded border bg-background p-2"><p className="font-medium">{p.prompt}</p><p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p></li>
          ))}
        </ul>
      );
    case "writing-style-suggestions":
      return (
        <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted p-3 text-sm">
          {result.result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      );
    case "character-builder":
      return (
        <div className="grid gap-2 rounded-lg bg-muted p-3 sm:grid-cols-2">
          {result.result.characters.map((c, i) => (
            <div key={i} className="rounded border bg-background p-2 text-sm">
              <p className="font-medium">{c.name} <span className="font-normal text-muted-foreground">— {c.role}</span></p>
              <p className="mt-1 text-muted-foreground">{c.description}</p>
              <div className="mt-1 flex flex-wrap gap-1">{c.traits.map((tr, ti) => <Badge key={ti} variant="outline" className="text-[10px]">{tr}</Badge>)}</div>
            </div>
          ))}
        </div>
      );
    case "story-ideas":
      return (
        <ul className="space-y-2 rounded-lg bg-muted p-3 text-sm">
          {result.result.ideas.map((idea, i) => <li key={i}><span className="font-medium">{idea.title}</span> — {idea.logline}</li>)}
        </ul>
      );
    case "academic-assistant":
      return (
        <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
          <p className="whitespace-pre-line">{result.result.answer}</p>
          {result.result.notes && <p className="border-t pt-1 text-xs text-muted-foreground">{result.result.notes}</p>}
        </div>
      );
    case "citation-suggestions":
      return (
        <ul className="space-y-1.5 rounded-lg bg-muted p-3 text-sm">
          {result.result.citations.map((c, i) => (
            <li key={i}><Badge variant="outline" className="me-1.5 text-[10px]">{c.style}</Badge>{c.text}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}
