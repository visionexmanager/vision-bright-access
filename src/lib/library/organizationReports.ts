/**
 * Organization Reports — PDF/Excel/CSV, all pure client-side generation
 * (no edge function), mirroring researchExport.ts's approach exactly. PDF
 * via jsPDF (already a dependency); Excel via the new `xlsx` (SheetJS)
 * dependency — genuinely real .xlsx output, unlike the "Word HTML as .doc"
 * technique researchExport.ts uses for DOCX (there is no equivalent trick
 * for real spreadsheet software, so a real library was added instead).
 */

import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

export type OrganizationReportFormat = "pdf" | "xlsx" | "csv";

export interface OrganizationReportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface OrganizationReportPayload {
  organizationName: string;
  reportTitle: string;
  generatedAt: string;
  tables: OrganizationReportTable[];
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

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(payload: OrganizationReportPayload): string {
  const lines = [`${payload.reportTitle} — ${payload.organizationName}`, `Generated: ${payload.generatedAt}`, ""];
  for (const table of payload.tables) {
    lines.push(table.title);
    lines.push(table.columns.map(escapeCsvCell).join(","));
    for (const row of table.rows) lines.push(row.map(escapeCsvCell).join(","));
    lines.push("");
  }
  return lines.join("\n");
}

function toXlsx(payload: OrganizationReportPayload): Blob {
  const workbook = XLSX.utils.book_new();
  for (const table of payload.tables) {
    const sheetData = [table.columns, ...table.rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    const sheetName = table.title.replace(/[[\]*/\\?:]/g, "").slice(0, 31) || "Sheet";
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }
  const arrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function toPdf(payload: OrganizationReportPayload): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(payload.reportTitle, margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${payload.organizationName} — Generated ${payload.generatedAt}`, margin, y);
  y += 30;

  for (const table of payload.tables) {
    if (y > 700) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(table.title, margin, y);
    y += 16;

    doc.setFontSize(9);
    const colWidth = (pageWidth - margin * 2) / Math.max(table.columns.length, 1);
    doc.text(table.columns, margin, y, { maxWidth: pageWidth - margin * 2 });
    y += 14;
    doc.setFont("helvetica", "normal");
    for (const row of table.rows) {
      if (y > 740) { doc.addPage(); y = 50; }
      row.forEach((cell, i) => doc.text(String(cell), margin + i * colWidth, y));
      y += 14;
    }
    y += 20;
  }

  return doc.output("blob");
}

export function downloadOrganizationReport(payload: OrganizationReportPayload, format: OrganizationReportFormat) {
  const filename = `${payload.organizationName}-${payload.reportTitle}`.replace(/[^\w\- ]/g, "").trim() || "organization-report";
  if (format === "pdf") triggerDownload(toPdf(payload), `${filename}.pdf`);
  else if (format === "xlsx") triggerDownload(toXlsx(payload), `${filename}.xlsx`);
  else triggerDownload(toCsv(payload), `${filename}.csv`, "text/csv");
}

export const ORGANIZATION_REPORT_FORMATS: { value: OrganizationReportFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "xlsx", label: "Excel" },
  { value: "csv", label: "CSV" },
];
