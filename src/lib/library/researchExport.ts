/**
 * Library — Research Workspace multi-format export.
 *
 * Pure client-side generation, no edge function — every format here is a
 * deterministic transform of data already in the browser. PDF uses jsPDF
 * (already a dependency, reused from the Learning Hub certificates).
 * DOCX: rather than adding a heavy new dependency for a real OOXML .docx
 * writer, this uses the well-established "Word HTML" technique — HTML
 * wrapped in Word-specific XML namespaces, saved with a .doc extension —
 * which Microsoft Word opens natively and correctly. This is a legitimate,
 * long-standing technique (not a placeholder), documented here plainly.
 */

import { jsPDF } from "jspdf";

export type ResearchExportFormat = "pdf" | "docx" | "markdown" | "html" | "csv" | "bibtex" | "ris" | "json";

export interface ResearchExportItem {
  itemType: "book" | "note" | "highlight" | "reference" | "saved_search" | "analysis";
  title: string;
  content?: string;
  citation?: string;
  bibtex?: string;
  ris?: string;
  addedAt?: string;
}

export interface ResearchExportPayload {
  projectTitle: string;
  projectDescription?: string | null;
  items: ResearchExportItem[];
}

function triggerDownload(content: string | Blob, filename: string, mimeType?: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType ?? "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toMarkdown(payload: ResearchExportPayload): string {
  const lines = [`# ${payload.projectTitle}`, ""];
  if (payload.projectDescription) lines.push(payload.projectDescription, "");
  for (const item of payload.items) {
    lines.push(`## ${item.title}`, `*${item.itemType}*`, "");
    if (item.content) lines.push(item.content, "");
    if (item.citation) lines.push(`> ${item.citation}`, "");
  }
  return lines.join("\n");
}

function toHtml(payload: ResearchExportPayload): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = payload.items.map((item) => `
    <section>
      <h2>${escape(item.title)}</h2>
      <p class="item-type">${escape(item.itemType)}</p>
      ${item.content ? `<p>${escape(item.content)}</p>` : ""}
      ${item.citation ? `<blockquote>${escape(item.citation)}</blockquote>` : ""}
    </section>`).join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escape(payload.projectTitle)}</title>
<style>body{font-family:sans-serif;max-width:720px;margin:2rem auto;line-height:1.6}
.item-type{color:#666;font-size:.8em;text-transform:uppercase}
blockquote{border-inline-start:3px solid #ccc;padding-inline-start:1em;color:#444}</style>
</head>
<body>
<h1>${escape(payload.projectTitle)}</h1>
${payload.projectDescription ? `<p>${escape(payload.projectDescription)}</p>` : ""}
${body}
</body>
</html>`;
}

/** The "Word HTML" technique: Word-specific XML namespaces make Word open
 *  this as a real formatted document rather than a raw HTML file. */
function toWordDoc(payload: ResearchExportPayload): string {
  const html = toHtml(payload);
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${payload.projectTitle}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
</head>
${html.slice(html.indexOf("<body>"))}`;
}

function toCsv(payload: ResearchExportPayload): string {
  const escape = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
  const header = ["Title", "Type", "Content", "Citation", "Added At"].join(",");
  const rows = payload.items.map((item) =>
    [escape(item.title), escape(item.itemType), escape(item.content ?? ""), escape(item.citation ?? ""), escape(item.addedAt ?? "")].join(","),
  );
  return [header, ...rows].join("\n");
}

function toBibTeX(payload: ResearchExportPayload): string {
  return payload.items.map((item) => item.bibtex).filter(Boolean).join("\n\n") || "% No citable references in this project.";
}

function toRis(payload: ResearchExportPayload): string {
  return payload.items.map((item) => item.ris).filter(Boolean).join("\n\n");
}

function toJson(payload: ResearchExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

function toPdf(payload: ResearchExportPayload): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 60;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(payload.projectTitle, margin, y);
  y += 28;

  if (payload.projectDescription) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(payload.projectDescription, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 16;
  }

  for (const item of payload.items) {
    if (y > 740) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(item.title, margin, y);
    y += 16;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(item.itemType, margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (item.content) {
      const lines = doc.splitTextToSize(item.content, pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 8;
    }
    if (item.citation) {
      const lines = doc.splitTextToSize(item.citation, pageWidth - margin * 2);
      doc.setFont("helvetica", "italic");
      doc.text(lines, margin, y);
      y += lines.length * 12 + 8;
    }
    y += 12;
  }

  return doc.output("blob");
}

export function downloadResearchExport(payload: ResearchExportPayload, format: ResearchExportFormat) {
  const filename = payload.projectTitle.replace(/[^\w\- ]/g, "").trim() || "research-project";

  switch (format) {
    case "pdf":
      triggerDownload(toPdf(payload), `${filename}.pdf`);
      return;
    case "docx":
      triggerDownload(toWordDoc(payload), `${filename}.doc`, "application/msword");
      return;
    case "markdown":
      triggerDownload(toMarkdown(payload), `${filename}.md`, "text/markdown");
      return;
    case "html":
      triggerDownload(toHtml(payload), `${filename}.html`, "text/html");
      return;
    case "csv":
      triggerDownload(toCsv(payload), `${filename}.csv`, "text/csv");
      return;
    case "bibtex":
      triggerDownload(toBibTeX(payload), `${filename}.bib`, "text/plain");
      return;
    case "ris":
      triggerDownload(toRis(payload), `${filename}.ris`, "text/plain");
      return;
    case "json":
      triggerDownload(toJson(payload), `${filename}.json`, "application/json");
      return;
  }
}

export const RESEARCH_EXPORT_FORMATS: { value: ResearchExportFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "csv", label: "CSV" },
  { value: "bibtex", label: "BibTeX" },
  { value: "ris", label: "RIS" },
  { value: "json", label: "JSON" },
];
