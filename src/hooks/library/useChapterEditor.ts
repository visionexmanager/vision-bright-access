/**
 * useChapterEditor — wraps a Tiptap editor instance for one chapter:
 * loads content_json on mount, autosaves (debounced, coalesced into the
 * existing autosave version row when <2 minutes old), exposes a manual
 * "save version" action, and derives the Automatic TOC from the live
 * document. Undo/redo come for free from StarterKit's bundled History
 * extension — no separate wiring needed here.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Mathematics } from "@tiptap/extension-mathematics";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { fetchChapterForEdit, updateChapterContent } from "@/services/library/chapters";
import { saveVersion, fetchLatestAutosave } from "@/services/library/versions";
import { flattenTiptapDocToText, extractHeadingsFromDoc, type ExtractedHeading } from "@/lib/library/tiptapUtils";
import { FootnoteRef, FootnoteDefinition } from "@/components/library/studio/editor/extensions/footnoteExtension";

const AUTOSAVE_DEBOUNCE_MS = 2500;
const AUTOSAVE_COALESCE_MS = 2 * 60 * 1000;

/** Words-per-minute heuristic feeding the reader's reading_time_minutes
 *  estimate — the same order-of-magnitude figure used industry-wide for
 *  "estimated reading time" features. */
const WORDS_PER_MINUTE = 200;

export function useChapterEditor(bookId: string | undefined, chapterId: string | undefined) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [toc, setToc] = useState<ExtractedHeading[]>([]);
  const [wordCount, setWordCount] = useState(0);

  const lastAutosaveAtRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit,
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Start writing this chapter…" }),
      CharacterCount,
      Mathematics,
      FootnoteRef,
      FootnoteDefinition,
    ],
    []
  );

  const editor = useEditor({
    extensions,
    content: "",
    onUpdate: ({ editor: ed }) => {
      setToc(extractHeadingsFromDoc(ed.getJSON()));
      setWordCount(ed.storage.characterCount?.words?.() ?? 0);
      scheduleAutosave();
    },
  });

  // Load the chapter's saved content once both the editor and chapter id
  // are ready.
  useEffect(() => {
    if (!editor || !chapterId) return;
    let cancelled = false;
    setIsLoading(true);
    void fetchChapterForEdit(chapterId).then((chapter) => {
      if (cancelled || !chapter) return;
      const doc = (chapter.content_json as JSONContent | null) ?? { type: "doc", content: [] };
      editor.commands.setContent(doc, false);
      setToc(extractHeadingsFromDoc(doc));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when switching chapters, not on every editor re-render
  }, [editor, chapterId]);

  function scheduleAutosave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runAutosave(), AUTOSAVE_DEBOUNCE_MS);
  }

  async function runAutosave() {
    if (!editor || !bookId || !chapterId || !user) return;
    setIsSaving(true);
    try {
      const json = editor.getJSON();
      const text = flattenTiptapDocToText(json as Parameters<typeof flattenTiptapDocToText>[0]);
      await updateChapterContent(chapterId, json as Record<string, unknown>, text);

      const now = Date.now();
      if (now - lastAutosaveAtRef.current > AUTOSAVE_COALESCE_MS) {
        await saveVersion({ book_id: bookId, chapter_id: chapterId, content_json: json as Record<string, unknown>, content_text: text, is_autosave: true, created_by: user.id });
        lastAutosaveAtRef.current = now;
      }
      setLastSavedAt(new Date());
    } catch (err) {
      console.error("Autosave failed:", err);
    } finally {
      setIsSaving(false);
    }
  }

  /** Explicit "Save version" action — always inserts a new named version,
   *  bypassing the autosave coalesce window. */
  const saveNamedVersion = async (note: string) => {
    if (!editor || !bookId || !chapterId || !user) return;
    const json = editor.getJSON();
    const text = flattenTiptapDocToText(json as Parameters<typeof flattenTiptapDocToText>[0]);
    await updateChapterContent(chapterId, json as Record<string, unknown>, text);
    await saveVersion({ book_id: bookId, chapter_id: chapterId, content_json: json as Record<string, unknown>, content_text: text, is_autosave: false, version_note: note, created_by: user.id });
    lastAutosaveAtRef.current = Date.now();
    setLastSavedAt(new Date());
    toast({ title: "Version saved" });
  };

  // Seed the coalesce timer from the last real autosave already on the
  // server, so reopening a chapter doesn't immediately spam a new version
  // row on the very first debounce tick.
  useEffect(() => {
    if (!chapterId) return;
    void fetchLatestAutosave(chapterId).then((latest) => {
      if (latest) lastAutosaveAtRef.current = new Date(latest.created_at).getTime();
    });
  }, [chapterId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const estimatedReadingMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

  return { editor, isLoading, isSaving, lastSavedAt, toc, wordCount, estimatedReadingMinutes, saveNamedVersion };
}
