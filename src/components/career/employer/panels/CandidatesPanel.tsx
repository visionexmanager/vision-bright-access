import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MOCK_CANDIDATES } from "../mock/mockCandidates";
import { CandidateList } from "./candidates/CandidateList";
import { HiringPipeline } from "./candidates/HiringPipeline";
import { CandidateProfile } from "./candidates/CandidateProfile";
import { TalentSearch } from "./candidates/TalentSearch";
import type { Candidate, CandidateNote, PipelineStage } from "../types";

export function CandidatesPanel() {
  const { t } = useLanguage();
  const [candidates, setCandidates] = useState<Candidate[]>(MOCK_CANDIDATES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "pipeline">("pipeline");

  const selected = useMemo(() => candidates.find((c) => c.id === selectedId) ?? null, [candidates, selectedId]);

  const handleStageChange = (candidateId: string, stage: PipelineStage) => {
    setCandidates((prev) => prev.map((c) => (c.id === candidateId ? { ...c, stage } : c)));
  };

  const handleAddNote = (candidateId: string, note: CandidateNote) => {
    setCandidates((prev) => prev.map((c) => (c.id === candidateId ? { ...c, notes: [...c.notes, note] } : c)));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("employerDash.nav.candidates")}</h1>
        <p className="text-sm text-muted-foreground">{t("employerDash.candidates.subtitle")}</p>
      </div>

      <Tabs defaultValue="applicants">
        <TabsList>
          <TabsTrigger value="applicants">{t("employerDash.candidates.applicantsTab")}</TabsTrigger>
          <TabsTrigger value="talentSearch">{t("employerDash.candidates.talentSearchTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="applicants" className="mt-4 flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView("pipeline")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${view === "pipeline" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {t("employerDash.candidates.pipelineView")}
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${view === "list" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {t("employerDash.candidates.listView")}
            </button>
          </div>

          {view === "pipeline" ? (
            <HiringPipeline candidates={candidates} onOpen={setSelectedId} onStageChange={handleStageChange} />
          ) : (
            <CandidateList candidates={candidates} onOpen={setSelectedId} />
          )}
        </TabsContent>

        <TabsContent value="talentSearch" className="mt-4">
          <TalentSearch onOpen={setSelectedId} />
        </TabsContent>
      </Tabs>

      <CandidateProfile
        candidate={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onStageChange={handleStageChange}
        onAddNote={handleAddNote}
      />
    </div>
  );
}
