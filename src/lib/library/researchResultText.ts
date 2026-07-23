import type { LibraryResearchMode, LibraryResearchResult } from "@/services/library/researchAssistant";

/** Flattens any research-assistant result shape into plain text for export/copy. */
export function researchResultToText(mode: LibraryResearchMode, result: LibraryResearchResult): string {
  if (mode === "summarize_multiple" && "summary" in result) {
    const highlights = result.per_source_highlights.map((h) => `- [${h.book_title}] ${h.highlight}`).join("\n");
    return `${result.summary}\n\n${highlights}`;
  }
  if (mode === "compare_books" && "common_themes" in result) {
    return [
      result.overall_comparison,
      "", "Common themes:", ...result.common_themes.map((x) => `- ${x}`),
      "", "Agreements:", ...result.agreements.map((x) => `- ${x}`),
      "", "Contradictions:", ...result.contradictions.map((x) => `- ${x}`),
    ].join("\n");
  }
  if (mode === "compare_authors" && "authors" in result) {
    const sections = result.authors.map((a) => `${a.author_name}\n${a.style_summary}\nThemes: ${a.recurring_themes.join(", ")}`);
    return `${result.overall_comparison}\n\n${sections.join("\n\n")}`;
  }
  if (mode === "literature_review" && "introduction" in result) {
    const sections = result.thematic_sections.map((s) => `## ${s.heading}\n${s.content}`).join("\n\n");
    return `${result.introduction}\n\n${sections}\n\nConclusion:\n${result.conclusion}`;
  }
  if (mode === "research_outline" && "working_title" in result) {
    const sections = result.sections.map((s) => `${s.heading}\n${s.sub_points.map((sp) => `  - ${sp}`).join("\n")}`).join("\n\n");
    return `${result.working_title}\n\n${sections}`;
  }
  if (mode === "knowledge_gaps" && "covered_topics" in result) {
    const gaps = result.gaps.map((g) => `- ${g.gap}: ${g.why_it_matters}`).join("\n");
    return `Covered topics: ${result.covered_topics.join(", ")}\n\nGaps:\n${gaps}`;
  }
  if (mode === "suggest_references" && "references" in result) {
    return result.references.map((r) => `- ${r.title} — ${r.library_authors?.name ?? "Unknown"}`).join("\n");
  }
  return JSON.stringify(result, null, 2);
}
