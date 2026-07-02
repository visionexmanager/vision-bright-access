import { Bot, Sparkles, Target, Bell, ArrowRight, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAgent } from "@/contexts/AgentContext";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "@/components/career/ai/ScoreRing";
import { MOCK_GOALS } from "../mock/mockGoals";
import { MOCK_OPPORTUNITIES } from "../mock/mockOpportunities";
import { MOCK_NOTIFICATIONS } from "../mock/mockNotifications";
import type { AgentPersonality } from "../types";

const GREETING_KEY: Record<AgentPersonality, string> = {
  professional: "agentUI.home.greeting.professional",
  friendly: "agentUI.home.greeting.friendly",
  minimal: "agentUI.home.greeting.minimal",
  motivational: "agentUI.home.greeting.motivational",
  executive: "agentUI.home.greeting.executive",
};

const CAREER_HEALTH_SCORE = 78;
const WEEKLY_PROGRESS_PERCENT = 62;

export function AgentHome() {
  const { t } = useLanguage();
  const { identity, setActiveSection } = useAgent();
  const activeGoals = MOCK_GOALS.slice(0, 3);
  const opportunities = MOCK_OPPORTUNITIES.slice(0, 3);
  const notifications = MOCK_NOTIFICATIONS.filter((n) => !n.read).slice(0, 3);

  const recommendedActions = [
    "agentUI.home.action1",
    "agentUI.home.action2",
    "agentUI.home.action3",
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="agent-glass flex flex-wrap items-center gap-4 rounded-2xl p-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: `${identity.avatarColor}22` }} aria-hidden="true">
          {identity.avatarEmoji}
        </span>
        <div className="flex-1">
          <p className="text-lg font-bold">{t(GREETING_KEY[identity.personality]).replace("{name}", identity.name)}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            {t("agentUI.home.status")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="agent-glass flex items-center gap-4 rounded-2xl p-5">
          <ScoreRing value={CAREER_HEALTH_SCORE} size={88} sublabel={t("agentUI.home.careerHealth")} />
          <div>
            <p className="text-sm font-bold">{t("agentUI.home.careerHealth")}</p>
            <p className="text-xs text-muted-foreground">{t("agentUI.home.careerHealthDesc")}</p>
          </div>
        </div>
        <div className="agent-glass flex flex-col justify-center gap-2 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold"><TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.home.weeklyProgress")}</p>
            <span className="font-bold text-primary">{WEEKLY_PROGRESS_PERCENT}%</span>
          </div>
          <Progress value={WEEKLY_PROGRESS_PERCENT} aria-label={t("agentUI.home.weeklyProgress")} />
          <p className="text-xs text-muted-foreground">{t("agentUI.home.weeklyProgressDesc")}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="agent-glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold"><Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.home.todaysOpportunities")}</p>
            <button type="button" onClick={() => setActiveSection("opportunities")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              {t("agentUI.home.viewAll")} <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          <ul className="flex flex-col gap-2.5">
            {opportunities.map((op) => (
              <li key={op.id} className="rounded-xl border border-border/50 p-3 text-sm">
                <p className="font-semibold">{op.title}</p>
                <p className="text-xs text-muted-foreground">{op.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="agent-glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold"><Target className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.home.activeGoals")}</p>
            <button type="button" onClick={() => setActiveSection("goals")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              {t("agentUI.home.viewAll")} <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          <ul className="flex flex-col gap-3">
            {activeGoals.map((goal) => (
              <li key={goal.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{t(goal.titleKey)}</span>
                  <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} aria-label={t(goal.titleKey)} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="agent-glass rounded-2xl border-primary/20 p-5">
          <p className="mb-3 text-sm font-bold">{t("agentUI.home.recommendedActions")}</p>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {recommendedActions.map((key) => <li key={key}>• {t(key)}</li>)}
          </ul>
        </div>

        <div className="agent-glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold"><Bell className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.home.aiNotifications")}</p>
            <button type="button" onClick={() => setActiveSection("notifications")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              {t("agentUI.home.viewAll")} <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("agentUI.home.noNotifications")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notifications.map((n) => (
                <li key={n.id} className="rounded-xl bg-primary/5 p-3 text-sm">
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
