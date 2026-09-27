/**
 * Library — Research Workspace multi-format export.
 *
 * Pure client-side generation, no edge function — every format here is a
 * deterministic transform of data already in the browser. PDF uses jsPDF
 * (already a dependency, reused from the Learning Hub certificates).
 * DOCX: a real Word document from src/lib/documents/docx.ts — the project
 * title as its Title, each item a Heading 2 — replacing the HTML-saved-as-.doc
 * this used to write, which Word opened in compatibility mode.
 */

import { jsPDF } from "jspdf";
import { enableArabicText, textInBox } from "@/lib/pdf/arabicText";
import { DOCX_MIME, buildDocx, type DocxBlock } from "@/lib/documents/docx";

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

async function toDocx(payload: ResearchExportPayload): Promise<Blob> {
  const blocks: DocxBlock[] = [];
  if (payload.projectDescription) blocks.push({ type: "paragraph", text: payload.projectDescription });
  for (const item of payload.items) {
    blocks.push({ type: "heading", level: 2, text: item.title });
    if (item.content) blocks.push({ type: "paragraph", text: item.content });
    if (item.citation) blocks.push({ type: "paragraph", text: item.citation });
  }
  const bytes = await buildDocx({ title: payload.projectTitle, blocks });
  return new Blob([bytes as unknown as BlobPart], { type: DOCX_MIME });
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

async function toPdf(payload: ResearchExportPayload): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await enableArabicText(doc, payload);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const width = pageWidth - margin * 2;
  let y = 60;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  textInBox(doc, payload.projectTitle, margin, y, width);
  y += 28;

  if (payload.projectDescription) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(payload.projectDescription, width);
    textInBox(doc, lines, margin, y, width);
    y += lines.length * 14 + 16;
  }

  for (const item of payload.items) {
    if (y > 740) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    textInBox(doc, item.title, margin, y, width);
    y += 16;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    textInBox(doc, item.itemType, margin, y, width);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (item.content) {
      const lines = doc.splitTextToSize(item.content, width);
      textInBox(doc, lines, margin, y, width);
      y += lines.length * 12 + 8;
    }
    if (item.citation) {
      const lines = doc.splitTextToSize(item.citation, width);
      doc.setFont("helvetica", "italic");
      textInBox(doc, lines, margin, y, width);
      y += lines.length * 12 + 8;
    }
    y += 12;
  }

  return doc.output("blob");
}

export async function downloadResearchExport(payload: ResearchExportPayload, format: ResearchExportFormat) {
  const filename = payload.projectTitle.replace(/[^\w\- ]/g, "").trim() || "research-project";

  switch (format) {
    case "pdf":
      triggerDownload(await toPdf(payload), `${filename}.pdf`);
      return;
    case "docx":
      triggerDownload(await toDocx(payload), `${filename}.docx`);
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
