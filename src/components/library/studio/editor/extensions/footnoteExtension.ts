/**
 * Footnote support for the Studio editor — a small in-repo custom Tiptap
 * Node pair rather than a third-party package: no verified free,
 * currently-maintained standalone Tiptap footnote extension exists to
 * depend on (Tiptap's own footnote/comment tooling lives behind their paid
 * Cloud offering). `footnoteRef` is an inline, atomic superscript marker
 * inserted at the cursor; `footnoteDefinition` is a block node holding the
 * footnote's text, rendered in a "Footnotes" panel at the chapter's end
 * (both in the editor and the reader — see FootnotesPanel.tsx). Numbering
 * is NOT stored on the node — it's derived from document order every time
 * the panel renders, so reordering/deleting footnotes never leaves stale
 * numbers behind.
 */

import { Node, mergeAttributes, type Editor } from "@tiptap/core";

export interface FootnoteRefAttributes {
  refId: string;
}

export const FootnoteRef = Node.create({
  name: "footnoteRef",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      refId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote-ref]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes, { "data-footnote-ref": "", class: "footnote-ref" })];
  },
});

export const FootnoteDefinition = Node.create({
  name: "footnoteDefinition",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      refId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-footnote-definition]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-footnote-definition": "", class: "footnote-definition" }), 0];
  },
});

/** Inserts a new footnote at the current selection: a footnoteRef marker
 *  inline, plus an empty footnoteDefinition appended at the end of the
 *  document for the author to fill in. Returns the shared refId linking
 *  the two, so the caller can focus the new definition afterward. */
export function insertFootnote(editor: Editor): string {
  const refId = crypto.randomUUID();
  editor.chain().focus().insertContent({ type: "footnoteRef", attrs: { refId } }).run();
  editor.chain().focus("end").insertContent({ type: "footnoteDefinition", attrs: { refId }, content: [] }).run();
  return refId;
}
