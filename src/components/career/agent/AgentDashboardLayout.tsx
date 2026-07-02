import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AgentProvider, useAgent } from "@/contexts/AgentContext";
import { AgentSidebar } from "./AgentSidebar";
import { AgentTopBar } from "./AgentTopBar";
import "./AgentTokens.css";

function AgentShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { accessibility } = useAgent();

  return (
    <div
      data-agent
      data-high-contrast={accessibility.highContrast}
      data-large-text={accessibility.largeText}
      data-reduced-motion={accessibility.reducedMotion}
      className="flex h-screen flex-col overflow-hidden bg-background"
    >
      <a
        href="#agent-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t("agentUI.skipToContent")}
      </a>

      <AgentTopBar />

      <div className="flex flex-1 overflow-hidden">
        <AgentSidebar />
        <main id="agent-main" tabIndex={-1} role="main" className="flex-1 overflow-y-auto p-4 focus:outline-none sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AgentDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AgentProvider>
      <AgentShell>{children}</AgentShell>
    </AgentProvider>
  );
}
