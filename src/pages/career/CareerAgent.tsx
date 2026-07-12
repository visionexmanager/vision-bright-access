// Still mock — the AI Career Agent panels (briefing/journal/productivity/
// opportunity monitor/recommendations) read like AI-generated content, not
// raw CRUD; real backing needs the career-ai-* edge functions plus
// ai_interactions/career_analytics_events, not a simple table swap. Future phase.
import { lazy, Suspense, type LazyExoticComponent } from "react";
import { AgentDashboardLayout } from "@/components/career/agent/AgentDashboardLayout";
import { useAgent } from "@/contexts/AgentContext";
import { SkeletonCard } from "@/components/career/jobs/SkeletonCard";
import type { AgentSection } from "@/components/career/agent/types";

const AgentHome = lazy(() => import("@/components/career/agent/panels/AgentHome").then((m) => ({ default: m.AgentHome })));
const DailyBriefing = lazy(() => import("@/components/career/agent/panels/DailyBriefing").then((m) => ({ default: m.DailyBriefing })));
const CareerGoals = lazy(() => import("@/components/career/agent/panels/CareerGoals").then((m) => ({ default: m.CareerGoals })));
const OpportunityMonitor = lazy(() => import("@/components/career/agent/panels/OpportunityMonitor").then((m) => ({ default: m.OpportunityMonitor })));
const RecommendationEngine = lazy(() => import("@/components/career/agent/panels/RecommendationEngine").then((m) => ({ default: m.RecommendationEngine })));
const ApplicationAssistant = lazy(() => import("@/components/career/agent/panels/ApplicationAssistant").then((m) => ({ default: m.ApplicationAssistant })));
const InterviewAssistant = lazy(() => import("@/components/career/agent/panels/InterviewAssistant").then((m) => ({ default: m.InterviewAssistant })));
const NegotiationAssistant = lazy(() => import("@/components/career/agent/panels/NegotiationAssistant").then((m) => ({ default: m.NegotiationAssistant })));
const CareerJournal = lazy(() => import("@/components/career/agent/panels/CareerJournal").then((m) => ({ default: m.CareerJournal })));
const ProductivityCenter = lazy(() => import("@/components/career/agent/panels/ProductivityCenter").then((m) => ({ default: m.ProductivityCenter })));
const AIInsights = lazy(() => import("@/components/career/agent/panels/AIInsights").then((m) => ({ default: m.AIInsights })));
const SmartNotifications = lazy(() => import("@/components/career/agent/panels/SmartNotifications").then((m) => ({ default: m.SmartNotifications })));
const AgentSettings = lazy(() => import("@/components/career/agent/panels/AgentSettings").then((m) => ({ default: m.AgentSettings })));

const PANEL_COMPONENTS: Record<AgentSection, LazyExoticComponent<() => JSX.Element>> = {
  home: AgentHome,
  briefing: DailyBriefing,
  goals: CareerGoals,
  opportunities: OpportunityMonitor,
  recommendations: RecommendationEngine,
  application: ApplicationAssistant,
  interview: InterviewAssistant,
  negotiation: NegotiationAssistant,
  journal: CareerJournal,
  productivity: ProductivityCenter,
  insights: AIInsights,
  notifications: SmartNotifications,
  settings: AgentSettings,
};

function ActivePanel() {
  const { activeSection } = useAgent();
  const Panel = PANEL_COMPONENTS[activeSection];

  return (
    <Suspense fallback={<SkeletonCard count={3} />}>
      <Panel />
    </Suspense>
  );
}

export default function CareerAgent() {
  return (
    <AgentDashboardLayout>
      <ActivePanel />
    </AgentDashboardLayout>
  );
}
