import type { Editor } from "@tiptap/react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ExtractedHeading } from "@/lib/library/tiptapUtils";
import { cn } from "@/lib/utils";

interface TocSidebarProps {
  editor: Editor;
  toc: ExtractedHeading[];
}

/** Automatic Table of Contents — derived from the live document's heading
 *  nodes (see extractHeadingsFromDoc), not a separately-authored/stored
 *  outline. Clicking scrolls the editor to that heading. */
export function TocSidebar({ editor, toc }: TocSidebarProps) {
  const { t } = useLanguage();

  const scrollTo = (index: number) => {
    let seen = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        seen++;
        if (seen === index) {
          editor.commands.setTextSelection(pos);
          editor.commands.scrollIntoView();
          return false;
        }
      }
      return true;
    });
  };

  if (toc.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("library.studio.editor.tocEmpty")}</p>;
  }

  return (
    <nav aria-label={t("library.studio.editor.tableOfContents")}>
      <h3 className="mb-2 text-sm font-semibold">{t("library.studio.editor.tableOfContents")}</h3>
      <ul className="space-y-1 text-sm">
        {toc.map((heading, index) => (
          <li key={heading.id} style={{ paddingInlineStart: `${(heading.level - 1) * 12}px` }}>
            <button type="button" className={cn("text-start hover:underline", heading.level === 1 && "font-medium")} onClick={() => scrollTo(index)}>
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
