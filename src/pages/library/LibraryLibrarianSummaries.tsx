import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, BookOpen, GraduationCap, Award } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/library/EmptyState";
import { useLibrarianSummaries } from "@/hooks/library/useLibrarianSummaries";
import type { LibrarySummaryPeriod } from "@/services/library/librarianSummaries";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

const PERIODS: LibrarySummaryPeriod[] = ["daily", "weekly", "monthly", "yearly"];

export default function LibraryLibrarianSummaries() {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<LibrarySummaryPeriod>("weekly");
  const { summaries, isLoading, isGenerating, generate } = useLibrarianSummaries(period);

  useDocumentHead({ title: t("library.librarian.summaries.title") });

  return (
    <Layout>
      <LibraryLayout
        title={t("library.librarian.summaries.title")}
        breadcrumb={[{ label: t("library.librarian.title"), to: "/library/librarian" }, { label: t("library.librarian.summaries.title") }]}
        headerActions={
          <Button size="sm" className="gap-1.5" disabled={isGenerating} onClick={() => void generate()}>
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            {t("library.librarian.summaries.generate")}
          </Button>
        }
      >
        <Tabs value={period} onValueChange={(v) => setPeriod(v as LibrarySummaryPeriod)} className="mb-4">
          <TabsList>
            {PERIODS.map((p) => <TabsTrigger key={p} value={p}>{t(`library.librarian.summaries.period.${p}`)}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
        ) : summaries.length === 0 ? (
          <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("library.librarian.summaries.empty")} className="py-12" />
        ) : (
          <div className="space-y-4">
            {summaries.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{s.period_start} — {s.period_end}</p>
                </div>
                <p className="mb-3 text-sm font-medium">{s.summary_text}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex items-start gap-1.5 text-sm">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{s.reading_insights}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-sm">
                    <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{s.learning_insights}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-sm">
                    <Award className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{s.skill_insights}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
