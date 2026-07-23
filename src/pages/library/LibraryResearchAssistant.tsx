import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Loader2, History, Trash2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/library/EmptyState";
import { BookMultiPicker } from "@/components/library/research/BookMultiPicker";
import { AuthorMultiPicker } from "@/components/library/research/AuthorMultiPicker";
import { ResearchResultView } from "@/components/library/research/ResearchResultView";
import { useResearchAssistant } from "@/hooks/library/useResearchAssistant";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import type { LibraryResearchMode } from "@/services/library/researchAssistant";
import type { LibraryBookSearchHit, LibraryAuthorSearchHit } from "@/services/library/researchWorkspace";

const MODES: LibraryResearchMode[] = [
  "compare_books", "summarize_multiple", "compare_authors",
  "literature_review", "research_outline", "suggest_references", "knowledge_gaps",
];

const BOOK_MODES: LibraryResearchMode[] = ["compare_books", "summarize_multiple", "literature_review", "knowledge_gaps"];
const TOPIC_ONLY_MODES: LibraryResearchMode[] = ["research_outline", "suggest_references"];

export default function LibraryResearchAssistant() {
  const { t } = useLanguage();
  const { mode, setMode, isRunning, result, run, analyses, remove } = useResearchAssistant();
  const [books, setBooks] = useState<LibraryBookSearchHit[]>([]);
  const [authors, setAuthors] = useState<LibraryAuthorSearchHit[]>([]);
  const [topic, setTopic] = useState("");

  useDocumentHead({ title: t("library.researchAssistant.title") });

  const usesBooks = BOOK_MODES.includes(mode);
  const usesAuthors = mode === "compare_authors";
  const usesTopicOnly = TOPIC_ONLY_MODES.includes(mode);
  const minBooks = mode === "compare_books" ? 2 : 1;

  const canRun = usesAuthors ? authors.length >= 2
    : usesTopicOnly ? topic.trim().length > 0
    : books.length >= minBooks;

  const handleRun = () => {
    void run({
      bookIds: usesBooks ? books.map((b) => b.id) : undefined,
      authorIds: usesAuthors ? authors.map((a) => a.id) : undefined,
      topic: usesTopicOnly || !usesAuthors ? topic.trim() || undefined : undefined,
    });
  };

  return (
    <Layout>
      <LibraryLayout title={t("library.researchAssistant.title")} breadcrumb={[{ label: t("library.researchAssistant.title") }]}>
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <Card className="space-y-4 p-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{t("library.researchAssistant.mode")}</label>
                <Select value={mode} onValueChange={(v) => setMode(v as LibraryResearchMode)}>
                  <SelectTrigger aria-label={t("library.researchAssistant.mode")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => <SelectItem key={m} value={m}>{t(`library.researchAssistant.modeLabel.${m}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{t(`library.researchAssistant.modeDescription.${mode}`)}</p>
              </div>

              {usesBooks && <BookMultiPicker selected={books} onChange={setBooks} minSelections={minBooks} />}
              {usesAuthors && <AuthorMultiPicker selected={authors} onChange={setAuthors} minSelections={2} />}
              {(usesTopicOnly || usesBooks) && (
                <div>
                  <label htmlFor="research-topic-input" className="mb-1.5 block text-sm font-medium">
                    {usesTopicOnly ? t("library.researchAssistant.topic") : t("library.researchAssistant.topicOptional")}
                  </label>
                  <Textarea id="research-topic-input" value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} placeholder={t("library.researchAssistant.topicPlaceholder")} />
                </div>
              )}

              <Button onClick={handleRun} disabled={!canRun || isRunning} className="gap-1.5">
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {t("library.researchAssistant.run")}
              </Button>
            </Card>

            {isRunning && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              </div>
            )}

            {!isRunning && result && (
              <Card className="p-4">
                <ResearchResultView mode={mode} result={result} />
              </Card>
            )}
          </div>

          <div>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <History className="h-4 w-4" aria-hidden="true" /> {t("library.researchAssistant.pastAnalyses")}
            </h2>
            {analyses.length === 0 ? (
              <EmptyState icon={<History className="h-8 w-8" />} title={t("library.researchAssistant.noPastAnalyses")} className="py-8" />
            ) : (
              <ul className="space-y-2">
                {analyses.map((a) => (
                  <li key={a.id}>
                    <Card className="p-3">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <Link to={`/library/research-assistant/${a.id}`} className="line-clamp-2 text-sm font-medium hover:underline">{a.title}</Link>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => void remove(a.id)} aria-label={t("library.reviews.delete")}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                      <Badge variant="outline" className="text-xs">{t(`library.researchAssistant.modeLabel.${a.analysis_type}`)}</Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
