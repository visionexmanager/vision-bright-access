import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ResearchResultView } from "@/components/library/research/ResearchResultView";
import { fetchResearchAnalysis, type LibraryResearchAnalysisRow } from "@/services/library/researchAssistant";
import { researchResultToText } from "@/lib/library/researchResultText";
import { downloadResearchExport, RESEARCH_EXPORT_FORMATS, type ResearchExportFormat } from "@/lib/library/researchExport";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryResearchAnalysisDetail() {
  const { t } = useLanguage();
  const { analysisId } = useParams<{ analysisId: string }>();
  const [analysis, setAnalysis] = useState<LibraryResearchAnalysisRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<ResearchExportFormat>("pdf");

  useDocumentHead({ title: analysis?.title ?? t("library.researchAssistant.title") });

  useEffect(() => {
    if (!analysisId) return;
    setIsLoading(true);
    void fetchResearchAnalysis(analysisId).then((row) => { setAnalysis(row); setIsLoading(false); });
  }, [analysisId]);

  const handleExport = () => {
    if (!analysis) return;
    downloadResearchExport(
      {
        projectTitle: analysis.title,
        items: [{ itemType: "analysis", title: analysis.title, content: researchResultToText(analysis.analysis_type, analysis.result), addedAt: analysis.created_at }],
      },
      exportFormat,
    );
  };

  return (
    <Layout>
      <LibraryLayout title={analysis?.title ?? t("library.researchAssistant.title")} breadcrumb={[{ label: t("library.researchAssistant.title"), to: "/library/research-assistant" }, { label: analysis?.title ?? "" }]}>
        <Link to="/library/research-assistant" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("library.researchAssistant.title")}
        </Link>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        )}

        {!isLoading && analysis && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{analysis.title}</h2>
                <Badge variant="outline">{t(`library.researchAssistant.modeLabel.${analysis.analysis_type}`)}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ResearchExportFormat)}>
                  <SelectTrigger className="w-32" aria-label={t("library.researchAssistant.export")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESEARCH_EXPORT_FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.researchAssistant.export")}
                </Button>
              </div>
            </div>
            <Card className="p-4">
              <ResearchResultView mode={analysis.analysis_type} result={analysis.result} />
            </Card>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
