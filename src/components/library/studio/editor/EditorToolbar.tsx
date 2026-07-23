import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code,
  Table as TableIcon, Image as ImageIcon, Link as LinkIcon, Undo2, Redo2, Superscript, Sigma,
} from "lucide-react";
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@/components/ui/toolbar";
import { useLanguage } from "@/contexts/LanguageContext";
import { insertFootnote } from "@/components/library/studio/editor/extensions/footnoteExtension";

interface EditorToolbarProps {
  editor: Editor;
  onInsertImage: () => void;
}

/** Accessible editor formatting toolbar — role="toolbar" with roving
 *  tabindex comes from @radix-ui/react-toolbar for free (Radix's Toolbar
 *  primitive), not hand-rolled. Every button has an explicit aria-label
 *  since they're icon-only. */
export function EditorToolbar({ editor, onInsertImage }: EditorToolbarProps) {
  const { t } = useLanguage();

  const insertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const insertLink = () => {
    const url = window.prompt(t("library.studio.editor.linkPrompt"));
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };
  const insertMath = () => {
    const formula = window.prompt(t("library.studio.editor.mathPrompt"));
    if (formula) editor.chain().focus().insertContent({ type: "inlineMath", attrs: { latex: formula } }).run();
  };

  return (
    <Toolbar aria-label={t("library.studio.editor.toolbar")}>
      <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} aria-label={t("library.studio.editor.bold")}>
        <Bold className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label={t("library.studio.editor.italic")}>
        <Italic className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} aria-label={t("library.studio.editor.strikethrough")}>
        <Strikethrough className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label={t("library.studio.editor.heading1")}>
        <Heading1 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label={t("library.studio.editor.heading2")}>
        <Heading2 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label={t("library.studio.editor.heading3")}>
        <Heading3 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label={t("library.studio.editor.bulletList")}>
        <List className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label={t("library.studio.editor.orderedList")}>
        <ListOrdered className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label={t("library.studio.editor.blockquote")}>
        <Quote className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} aria-label={t("library.studio.editor.codeBlock")}>
        <Code className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton onClick={insertTable} aria-label={t("library.studio.editor.insertTable")}>
        <TableIcon className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton onClick={onInsertImage} aria-label={t("library.studio.editor.insertImage")}>
        <ImageIcon className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("link")} onClick={insertLink} aria-label={t("library.studio.editor.insertLink")}>
        <LinkIcon className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton onClick={() => insertFootnote(editor)} aria-label={t("library.studio.editor.insertFootnote")}>
        <Superscript className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton onClick={insertMath} aria-label={t("library.studio.editor.insertMath")}>
        <Sigma className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} aria-label={t("library.studio.editor.undo")}>
        <Undo2 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} aria-label={t("library.studio.editor.redo")}>
        <Redo2 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
    </Toolbar>
  );
}
