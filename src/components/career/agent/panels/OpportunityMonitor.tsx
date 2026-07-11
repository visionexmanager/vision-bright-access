import { useState } from "react";
import { Radar, Briefcase, DollarSign, Building2, Plane, Globe, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_OPPORTUNITIES } from "../mock/mockOpportunities";
import type { OpportunityKind } from "../types";

const KIND_ICON: Record<OpportunityKind, LucideIcon> = {
  newJob: Briefcase,
  salaryChange: DollarSign,
  hiringCompany: Building2,
  visaOpportunity: Plane,
  remoteOpportunity: Globe,
  emergingSkill: Sparkles,
};

const KINDS: OpportunityKind[] = ["newJob", "salaryChange", "hiringCompany", "visaOpportunity", "remoteOpportunity", "emergingSkill"];

export function OpportunityMonitor() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<OpportunityKind | "all">("all");
  const filtered = filter === "all" ? MOCK_OPPORTUNITIES : MOCK_OPPORTUNITIES.filter((o) => o.kind === filter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-primary" aria-hidden="true" />
        <div>
          <h1 className="type-heading mb-1">{t("agentUI.nav.opportunities")}</h1>
          <p className="text-sm text-muted-foreground">{t("agentUI.opportunities.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("agentUI.opportunities.filterLabel")}>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${filter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
        >
          {t("agentUI.opportunities.all")}
        </button>
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setFilter(kind)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${filter === kind ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            {t(`agentUI.opportunities.kind.${kind}`)}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2.5">
        {filtered.map((op) => {
          const Icon = KIND_ICON[op.kind];
          return (
            <li key={op.id} className="agent-glass flex items-start gap-3 rounded-2xl p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{op.title}</p>
                <p className="text-xs text-muted-foreground">{op.detail}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{op.date}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
