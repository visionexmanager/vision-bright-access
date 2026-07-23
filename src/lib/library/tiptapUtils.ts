/**
 * Tiptap document utilities shared between the editor (autosave) and any
 * other write path that needs to keep library_chapters.content_text (the
 * plain-text mirror every RAG/search/AI-reading-assistant code path
 * already reads) in sync with content_json (the editor's source of truth) —
 * e.g. accepting a collaborator's suggestion replaces content_json without
 * going through the editor at all, so it must flatten here too.
 */

interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
  attrs?: Record<string, unknown>;
}

/** Walks a Tiptap/ProseMirror JSON document and produces a plain-text
 *  rendering — paragraph/heading/listItem boundaries become newlines, text
 *  nodes are concatenated in order. Not meant to be lossless (tables,
 *  code blocks, and math nodes are flattened to their visible text only),
 *  just a faithful-enough mirror for full-text search/RAG chunking. */
export function flattenTiptapDocToText(doc: TiptapNode | null | undefined): string {
  if (!doc) return "";
  const lines: string[] = [];
  let current = "";

  const BLOCK_TYPES = new Set(["paragraph", "heading", "listItem", "blockquote", "codeBlock", "tableRow", "footnoteDefinition"]);

  function visit(node: TiptapNode) {
    if (node.type === "text" && node.text) {
      current += node.text;
      return;
    }
    if (node.type === "hardBreak") {
      current += "\n";
      return;
    }
    const isBlock = node.type ? BLOCK_TYPES.has(node.type) : false;
    for (const child of node.content ?? []) visit(child);
    if (isBlock) {
      lines.push(current.trim());
      current = "";
    }
  }

  for (const node of doc.content ?? []) visit(node);
  if (current.trim()) lines.push(current.trim());

  return lines.filter(Boolean).join("\n\n");
}

export interface ExtractedHeading {
  id: string;
  level: number;
  text: string;
}

/** Automatic TOC — walks content_json for heading nodes (levels 1-3), no
 *  new schema, computed at read time. `id` is a stable slug derived from
 *  position + text, used for in-editor scroll-to anchors. */
export function extractHeadingsFromDoc(doc: TiptapNode | null | undefined): ExtractedHeading[] {
  if (!doc) return [];
  const headings: ExtractedHeading[] = [];
  let index = 0;

  function textOf(node: TiptapNode): string {
    if (node.type === "text") return node.text ?? "";
    return (node.content ?? []).map(textOf).join("");
  }

  for (const node of doc.content ?? []) {
    if (node.type === "heading") {
      const level = Number(node.attrs?.level ?? 1);
      if (level <= 3) {
        const text = textOf(node).trim();
        if (text) headings.push({ id: `heading-${index}`, level, text });
      }
    }
    index++;
  }
  return headings;
}
