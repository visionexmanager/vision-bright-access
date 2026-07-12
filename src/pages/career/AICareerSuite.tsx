// Still mock — the AI modules here need to call the already-deployed
// career-ai-* edge functions (resume, roadmap, salary, visa, etc.) rather
// than a simple table swap; profile data it references (dashboard/mock/
// mockProfile) is real via useCareerProfile in Phase 1, but the AI
// generation itself is a separate, larger phase.
import { lazy, Suspense, useState, type LazyExoticComponent } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnimatedSection, scaleFade } from "@/components/AnimatedSection";
import { AIChatInterface } from "@/components/career/ai/AIChatInterface";
import { AIModuleCard } from "@/components/career/ai/AIModuleCard";
import { AIModuleDialog, AIModuleFallback } from "@/components/career/ai/AIModuleDialog";
import { AI_MODULES } from "@/components/career/ai/data";
import type { AIModuleId } from "@/components/career/ai/types";
import "@/components/career/ai/AICareerSuiteTokens.css";

const MODULE_COMPONENTS: Record<AIModuleId, LazyExoticComponent<() => JSX.Element>> = {
  resumeBuilder: lazy(() => import("@/components/career/ai/modules/AIResumeBuilder").then((m) => ({ default: m.AIResumeBuilder }))),
  resumeAnalyzer: lazy(() => import("@/components/career/ai/modules/AIResumeAnalyzer").then((m) => ({ default: m.AIResumeAnalyzer }))),
  coverLetter: lazy(() => import("@/components/career/ai/modules/AICoverLetter").then((m) => ({ default: m.AICoverLetter }))),
  interviewSimulator: lazy(() => import("@/components/career/ai/modules/AIInterviewSimulator").then((m) => ({ default: m.AIInterviewSimulator }))),
  jobMatching: lazy(() => import("@/components/career/ai/modules/AIJobMatching").then((m) => ({ default: m.AIJobMatching }))),
  salaryPredictor: lazy(() => import("@/components/career/ai/modules/AISalaryPredictor").then((m) => ({ default: m.AISalaryPredictor }))),
  careerCoach: lazy(() => import("@/components/career/ai/modules/AICareerCoach").then((m) => ({ default: m.AICareerCoach }))),
  careerRoadmap: lazy(() => import("@/components/career/ai/modules/AICareerRoadmap").then((m) => ({ default: m.AICareerRoadmap }))),
  visaAssistant: lazy(() => import("@/components/career/ai/modules/AIVisaAssistant").then((m) => ({ default: m.AIVisaAssistant }))),
  healthScore: lazy(() => import("@/components/career/ai/modules/AICareerHealthScore").then((m) => ({ default: m.AICareerHealthScore }))),
};

export default function AICareerSuite() {
  const { t } = useLanguage();
  const [openModuleId, setOpenModuleId] = useState<AIModuleId | null>(null);
  const activeModule = AI_MODULES.find((m) => m.id === openModuleId);
  const ActiveComponent = openModuleId ? MODULE_COMPONENTS[openModuleId] : null;

  return (
    <Layout>
      <div data-ai-suite className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="ai-orb absolute -top-24 start-1/4 h-72 w-72 rounded-full bg-[hsl(var(--ai-neon)/0.18)] blur-3xl" />
          <div className="ai-orb absolute top-40 end-1/4 h-72 w-72 rounded-full bg-[hsl(var(--ai-neon-2)/0.16)] blur-3xl" style={{ animationDelay: "3s" }} />
        </div>

        <section className="section-container relative z-10 py-16">
          <AnimatedSection variants={scaleFade} className="mx-auto mb-10 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
              {t("aiSuite.badge")}
            </div>
            <h1 className="type-display mb-3 text-balance">
              <span className="ai-neon-text">{t("aiSuite.title")}</span>
            </h1>
            <p className="text-muted-foreground leading-relaxed">{t("aiSuite.subtitle")}</p>
          </AnimatedSection>

          <AIChatInterface onOpenModule={setOpenModuleId} />

          <div className="mx-auto mt-14 max-w-6xl">
            <h2 className="type-heading mb-6 text-center">{t("aiSuite.modulesTitle")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {AI_MODULES.map((module) => (
                <AIModuleCard key={module.id} module={module} onOpen={setOpenModuleId} />
              ))}
            </div>
          </div>
        </section>
      </div>

      <AIModuleDialog
        open={Boolean(openModuleId)}
        onOpenChange={(open) => !open && setOpenModuleId(null)}
        title={activeModule ? t(activeModule.titleKey) : ""}
        icon={activeModule ? <activeModule.icon className="h-5 w-5 text-primary" aria-hidden="true" /> : null}
      >
        {ActiveComponent && (
          <Suspense fallback={<AIModuleFallback />}>
            <ActiveComponent />
          </Suspense>
        )}
      </AIModuleDialog>
    </Layout>
  );
}
