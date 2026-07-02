import { UserCheck, TrendingUp, Users, Sparkles, AlertTriangle, Rocket } from "lucide-react";
import type { InsightCard } from "../types";

export const AGENT_INSIGHTS: InsightCard[] = [
  { id: "ins-1", icon: UserCheck, titleKey: "agentUI.insights.profileStrength", value: 82, descKey: "agentUI.insights.profileStrengthDesc", tone: "positive" },
  { id: "ins-2", icon: TrendingUp, titleKey: "agentUI.insights.marketPosition", value: 76, descKey: "agentUI.insights.marketPositionDesc", tone: "positive" },
  { id: "ins-3", icon: Users, titleKey: "agentUI.insights.competitionLevel", value: 64, descKey: "agentUI.insights.competitionLevelDesc", tone: "neutral" },
  { id: "ins-4", icon: Sparkles, titleKey: "agentUI.insights.futureOpportunities", value: 88, descKey: "agentUI.insights.futureOpportunitiesDesc", tone: "positive" },
  { id: "ins-5", icon: AlertTriangle, titleKey: "agentUI.insights.riskAlerts", value: 22, descKey: "agentUI.insights.riskAlertsDesc", tone: "warning" },
  { id: "ins-6", icon: Rocket, titleKey: "agentUI.insights.growthPotential", value: 91, descKey: "agentUI.insights.growthPotentialDesc", tone: "positive" },
];
