// ZIP, TAR and GZIP in the browser — one implementation shared with the Edge
// Functions. It uses only web-standard APIs (CompressionStream, DataView), so
// the WhatsApp assistant writes a Word document with the same ZIP writer File
// Studio uses, rather than a second one that could disagree with it.
export * from "../../../../supabase/functions/_shared/archiveFormats.ts";
