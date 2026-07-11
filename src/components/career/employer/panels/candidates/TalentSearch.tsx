import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAiSimulation } from "@/components/career/ai/useAiSimulation";
import { AIThinkingIndicator } from "@/components/career/ai/AIThinkingIndicator";
import { MOCK_CANDIDATES } from "../../mock/mockCandidates";
import { CandidateList } from "./CandidateList";
import type { Candidate } from "../../types";

interface TalentSearchProps {
  onOpen: (id: string) => void;
}

interface SearchFilters {
  query: string;
  location: string;
  minExperience: string;
}

function searchTalentPool(filters: SearchFilters): Candidate[] {
  const q = filters.query.toLowerCase();
  return MOCK_CANDIDATES.filter((c) => {
    if (q && !(c.skills.some((s) => s.toLowerCase().includes(q)) || c.headline.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))) return false;
    if (filters.location && !c.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.minExperience) {
      const min = parseInt(filters.minExperience, 10);
      if (Number.isFinite(min) && c.experienceYears < min) return false;
    }
    return true;
  }).sort((a, b) => b.matchScore - a.matchScore);
}

export function TalentSearch({ onOpen }: TalentSearchProps) {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<SearchFilters>({ query: "", location: "", minExperience: "" });
  const { loading, result, run } = useAiSimulation(() => searchTalentPool(filters), 1300);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("employerDash.talentSearch.desc")}</p>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="ts-query" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.talentSearch.skillsOrKeyword")}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="ts-query" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} className="ps-8" />
          </div>
        </div>
        <div>
          <Label htmlFor="ts-location" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.talentSearch.location")}</Label>
          <Input id="ts-location" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ts-exp" className="mb-1.5 block text-xs text-muted-foreground">{t("employerDash.talentSearch.minExperience")}</Label>
          <Input id="ts-exp" type="number" min={0} value={filters.minExperience} onChange={(e) => setFilters({ ...filters, minExperience: e.target.value })} />
        </div>
      </div>

      <Button onClick={run} disabled={loading} className="self-start">
        <Sparkles className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
        {t("employerDash.talentSearch.run")}
      </Button>

      {loading && <AIThinkingIndicator label={t("employerDash.talentSearch.thinking")} />}

      {result && !loading && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">{t("employerDash.talentSearch.resultCount").replace("{count}", String(result.length))}</p>
          <CandidateList candidates={result} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
}
