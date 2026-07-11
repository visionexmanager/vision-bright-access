import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { AGENT_INSIGHTS } from "../mock/mockAgentInsights";
import type { InsightCard } from "../types";

const TONE_COLOR: Record<InsightCard["tone"], string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-amber-600 dark:text-amber-400",
  warning: "text-red-600 dark:text-red-400",
};

export function AIInsights() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("agentUI.nav.insights")}</h1>
        <p className="text-sm text-muted-foreground">{t("agentUI.insights.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_INSIGHTS.map((insight) => {
          const Icon = insight.icon;
          return (
            <div key={insight.id} className="agent-glass flex flex-col gap-3 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className={`text-xl font-black ${TONE_COLOR[insight.tone]}`}>{insight.value}</span>
              </div>
              <p className="text-sm font-bold">{t(insight.titleKey)}</p>
              <Progress value={insight.value} aria-label={t(insight.titleKey)} />
              <p className="text-xs text-muted-foreground">{t(insight.descKey)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
