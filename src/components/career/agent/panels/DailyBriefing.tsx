import type { ReactNode } from "react";
import { Sunrise, Briefcase, Sparkles, TrendingUp, AlertTriangle, UserCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CompanyAvatar } from "@/components/career/jobs/CompanyAvatar";
import { BRIEFING_TOP_JOBS, BRIEFING_SUGGESTED_SKILLS, BRIEFING_MARKET_CHANGES, BRIEFING_ALERTS, BRIEFING_PROFILE_SUGGESTIONS } from "../mock/mockBriefing";

function BriefingCard({ icon: Icon, title, children }: { icon: typeof Sunrise; title: string; children: ReactNode }) {
  return (
    <div className="agent-glass rounded-2xl p-5">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Icon className="h-4 w-4 text-primary" aria-hidden="true" />{title}</p>
      {children}
    </div>
  );
}

export function DailyBriefing() {
  const { t } = useLanguage();
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1 flex items-center gap-2"><Sunrise className="h-5 w-5 text-primary" aria-hidden="true" />{t("agentUI.briefing.title")}</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      <BriefingCard icon={Briefcase} title={t("agentUI.briefing.topJobs")}>
        <ul className="flex flex-col gap-2">
          {BRIEFING_TOP_JOBS.map((j) => (
            <li key={j.id} className="flex items-center gap-3 rounded-xl border border-border/50 p-3 text-sm">
              <CompanyAvatar name={j.company} color="#6366f1" size="sm" />
              <div className="flex-1">
                <p className="font-semibold">{j.title}</p>
                <p className="text-xs text-muted-foreground">{j.company}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{j.match}%</span>
            </li>
          ))}
        </ul>
      </BriefingCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <BriefingCard icon={Sparkles} title={t("agentUI.briefing.suggestedSkills")}>
          <div className="flex flex-wrap gap-2">
            {BRIEFING_SUGGESTED_SKILLS.map((s) => <span key={s} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">{s}</span>)}
          </div>
        </BriefingCard>

        <BriefingCard icon={TrendingUp} title={t("agentUI.briefing.marketChanges")}>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {BRIEFING_MARKET_CHANGES.map((m) => <li key={m}>• {m}</li>)}
          </ul>
        </BriefingCard>

        <BriefingCard icon={AlertTriangle} title={t("agentUI.briefing.alerts")}>
          <ul className="flex flex-col gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            {BRIEFING_ALERTS.map((a) => <li key={a}>• {a}</li>)}
          </ul>
        </BriefingCard>

        <BriefingCard icon={UserCheck} title={t("agentUI.briefing.profileSuggestions")}>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {BRIEFING_PROFILE_SUGGESTIONS.map((p) => <li key={p}>• {p}</li>)}
          </ul>
        </BriefingCard>
      </div>
    </div>
  );
}
