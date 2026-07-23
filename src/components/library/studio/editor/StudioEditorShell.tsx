import { useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { Loader2, Type, Mic, MicOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getAcademyTextScale, setAcademyTextScale, type AcademyTextScale } from "@/lib/academy/accessibilityPrefs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useChapterEditor } from "@/hooks/library/useChapterEditor";
import { useVoiceCommands } from "@/hooks/library/useVoiceCommands";
import { EditorToolbar } from "@/components/library/studio/editor/EditorToolbar";
import { ChapterManagerSidebar } from "@/components/library/studio/editor/ChapterManagerSidebar";
import { TocSidebar } from "@/components/library/studio/editor/TocSidebar";
import { VersionHistoryPanel } from "@/components/library/studio/editor/VersionHistoryPanel";
import { CollaboratorsPanel } from "@/components/library/studio/collaboration/CollaboratorsPanel";
import { CommentsPanel } from "@/components/library/studio/collaboration/CommentsPanel";
import { SuggestionsPanel } from "@/components/library/studio/collaboration/SuggestionsPanel";
import { WritingAssistantPanel } from "@/components/library/studio/ai/WritingAssistantPanel";
import { supabase } from "@/integrations/supabase/client";

interface StudioEditorShellProps {
  bookId: string;
  chapterId: string;
}

type PanelKey = "chapters" | "toc" | "versions" | "collaborators" | "comments" | "suggestions" | "ai";
const PANELS: PanelKey[] = ["chapters", "toc", "versions", "collaborators", "comments", "suggestions", "ai"];

/** The Studio's chapter editor screen — Tiptap content area + toolbar +
 *  a side panel switching between the chapter list, automatic TOC, and
 *  version history. Dark mode needs no editor-specific code: the whole
 *  page inherits ThemeContext's light/dark/high-contrast class on <html>,
 *  and @tailwindcss/typography's `prose dark:prose-invert` (already
 *  installed) styles the content region automatically. */
export function StudioEditorShell({ bookId, chapterId }: StudioEditorShellProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { editor, isLoading, isSaving, lastSavedAt, toc, wordCount, estimatedReadingMinutes, saveNamedVersion } = useChapterEditor(bookId, chapterId);
  const [panel, setPanel] = useState<PanelKey>("chapters");
  const [textScale, setTextScaleState] = useState<AcademyTextScale>(() => getAcademyTextScale());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cycleTextScale = () => {
    const next: AcademyTextScale = textScale === "normal" ? "large" : textScale === "large" ? "extra-large" : "normal";
    setAcademyTextScale(next);
    setTextScaleState(next);
  };

  const { supported: voiceCommandsSupported, isListening: isListeningForCommands, toggle: toggleVoiceCommands } = useVoiceCommands({
    lang: "en-US",
    commands: {
      save: () => void saveNamedVersion("Voice command save"),
      undo: () => editor?.chain().focus().undo().run(),
      redo: () => editor?.chain().focus().redo().run(),
    },
  });

  const handleInsertImage = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor || !user) return;
    const path = `${bookId}/content/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("library-book-gallery").upload(path, file);
    if (error) return;
    const { data } = supabase.storage.from("library-book-gallery").getPublicUrl(path);
    editor.chain().focus().setImage({ src: data.publicUrl }).run();
  };

  if (isLoading || !editor) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <EditorToolbar editor={editor} onInsertImage={handleInsertImage} />
          <div className="flex shrink-0 gap-1.5">
            {voiceCommandsSupported && (
              <Button
                variant={isListeningForCommands ? "default" : "outline"}
                size="sm"
                onClick={toggleVoiceCommands}
                aria-pressed={isListeningForCommands}
                aria-label={isListeningForCommands ? t("library.ai.voiceCommands.stop") : t("library.ai.voiceCommands.start")}
              >
                {isListeningForCommands ? <Mic className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <MicOff className="h-4 w-4" aria-hidden="true" />}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={cycleTextScale} aria-label={t("library.studio.editor.textScale").replace("{scale}", t(`library.studio.editor.textScale.${textScale}`))}>
              <Type className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFileSelected(e)} />

        <div className="rounded-md border p-4">
          <EditorContent editor={editor} className="prose prose-sm dark:prose-invert max-w-none focus:outline-none sm:prose-base" />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground" aria-live="polite">
          <span>{t("library.studio.editor.wordCount").replace("{count}", String(wordCount)).replace("{minutes}", String(estimatedReadingMinutes))}</span>
          <span>
            {isSaving
              ? t("library.studio.editor.saving")
              : lastSavedAt
                ? t("library.studio.editor.savedAt").replace("{time}", lastSavedAt.toLocaleTimeString())
                : ""}
          </span>
        </div>
      </div>

      <aside className="space-y-3">
        <Select value={panel} onValueChange={(v) => setPanel(v as PanelKey)}>
          <SelectTrigger aria-label={t("library.studio.editor.panelLabel")}><SelectValue /></SelectTrigger>
          <SelectContent>
            {PANELS.map((key) => (
              <SelectItem key={key} value={key}>{t(`library.studio.editor.panel.${key}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {panel === "chapters" && <ChapterManagerSidebar bookId={bookId} activeChapterId={chapterId} />}
        {panel === "toc" && <TocSidebar editor={editor} toc={toc} />}
        {panel === "versions" && <VersionHistoryPanel chapterId={chapterId} />}
        {panel === "collaborators" && <CollaboratorsPanel bookId={bookId} />}
        {panel === "comments" && <CommentsPanel bookId={bookId} chapterId={chapterId} />}
        {panel === "suggestions" && <SuggestionsPanel bookId={bookId} chapterId={chapterId} editor={editor} />}
        {panel === "ai" && <WritingAssistantPanel bookId={bookId} editor={editor} />}
      </aside>
    </div>
  );
}
