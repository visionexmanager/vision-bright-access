import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryResearchMode, LibraryResearchResult } from "@/services/library/researchAssistant";

interface ResearchResultViewProps {
  mode: LibraryResearchMode;
  result: LibraryResearchResult;
}

export function ResearchResultView({ mode, result }: ResearchResultViewProps) {
  const { t } = useLanguage();

  if (mode === "summarize_multiple" && "summary" in result) {
    return (
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.summary}</p>
        {result.per_source_highlights.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("library.researchAssistant.perSourceHighlights")}</h3>
            {result.per_source_highlights.map((h, i) => (
              <Card key={i} className="p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">{h.book_title}</p>
                <p className="text-sm">{h.highlight}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (mode === "compare_books" && "common_themes" in result) {
    return (
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.overall_comparison}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <h3 className="mb-1.5 text-sm font-semibold">{t("library.researchAssistant.commonThemes")}</h3>
            <ul className="space-y-1 text-sm">{result.common_themes.map((x, i) => <li key={i} className="rounded bg-muted px-2 py-1">{x}</li>)}</ul>
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t("library.researchAssistant.agreements")}</h3>
            <ul className="space-y-1 text-sm">{result.agreements.map((x, i) => <li key={i} className="rounded bg-emerald-500/10 px-2 py-1">{x}</li>)}</ul>
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">{t("library.researchAssistant.contradictions")}</h3>
            <ul className="space-y-1 text-sm">{result.contradictions.map((x, i) => <li key={i} className="rounded bg-amber-500/10 px-2 py-1">{x}</li>)}</ul>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "compare_authors" && "authors" in result) {
    return (
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.overall_comparison}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.authors.map((a, i) => (
            <Card key={i} className="p-3">
              <p className="mb-1 text-sm font-semibold">{a.author_name}</p>
              <p className="mb-2 text-sm text-muted-foreground">{a.style_summary}</p>
              <div className="flex flex-wrap gap-1">{a.recurring_themes.map((th, j) => <Badge key={j} variant="outline">{th}</Badge>)}</div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "literature_review" && "introduction" in result) {
    return (
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.introduction}</p>
        {result.thematic_sections.map((s, i) => (
          <div key={i}>
            <h3 className="mb-1 text-sm font-semibold">{s.heading}</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{s.content}</p>
          </div>
        ))}
        <div>
          <h3 className="mb-1 text-sm font-semibold">{t("library.researchAssistant.conclusion")}</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.conclusion}</p>
        </div>
      </div>
    );
  }

  if (mode === "research_outline" && "working_title" in result) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold">{result.working_title}</h3>
        {result.sections.map((s, i) => (
          <div key={i}>
            <p className="text-sm font-medium">{s.heading}</p>
            <ul className="ms-4 list-disc text-sm text-muted-foreground">{s.sub_points.map((sp, j) => <li key={j}>{sp}</li>)}</ul>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "knowledge_gaps" && "covered_topics" in result) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">{t("library.researchAssistant.coveredTopics")}</h3>
          <div className="flex flex-wrap gap-1.5">{result.covered_topics.map((x, i) => <Badge key={i} variant="secondary">{x}</Badge>)}</div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("library.researchAssistant.gaps")}</h3>
          {result.gaps.map((g, i) => (
            <Card key={i} className="p-3">
              <p className="text-sm font-medium">{g.gap}</p>
              <p className="text-xs text-muted-foreground">{g.why_it_matters}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "suggest_references" && "references" in result) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {result.references.map((ref) => (
          <Link key={ref.id} to={`/library/books/${ref.id}`}>
            <Card className="p-3 hover:shadow-md">
              <p className="line-clamp-1 text-sm font-medium">{ref.title}</p>
              <p className="text-xs text-muted-foreground">{ref.library_authors?.name}</p>
            </Card>
          </Link>
        ))}
      </div>
    );
  }

  return null;
}
