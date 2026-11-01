// What the server's document engine will convert, for the page's menu.
//
// A copy of the matrix in services/media-processor/src/docconvert.mjs, kept in
// step by `file-studio-documents.test.ts`, which reads the service's own file
// and fails if they differ. The page needs it to decide what to offer before a
// visitor waits; the service remains the authority and refuses anything else.

export const SERVER_DOC_FAMILY: Readonly<Record<string, "pdf" | "text" | "sheet" | "slides">> = Object.freeze({
  pdf: "pdf",
  docx: "text", doc: "text", odt: "text", rtf: "text", txt: "text", html: "text",
  xlsx: "sheet", xls: "sheet", ods: "sheet", csv: "sheet",
  pptx: "slides", ppt: "slides", odp: "slides",
});

export const SERVER_DOC_OUTPUTS: Readonly<Record<"pdf" | "text" | "sheet" | "slides", readonly string[]>> = Object.freeze({
  pdf: ["docx", "odt", "txt"],
  text: ["pdf", "docx", "odt", "rtf", "txt", "html"],
  sheet: ["pdf", "xlsx", "ods", "csv"],
  slides: ["pdf", "pptx", "odp"],
});

/** The formats a file of this extension can become on the server, never its own. */
export function serverDocumentTargets(inputFormat: string): readonly string[] {
  const family = SERVER_DOC_FAMILY[inputFormat];
  return family ? SERVER_DOC_OUTPUTS[family].filter((target) => target !== inputFormat) : [];
}

export const serverCanConvertDocument = (from: string, to: string): boolean =>
  serverDocumentTargets(from).includes(to);
