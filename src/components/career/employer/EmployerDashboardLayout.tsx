import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { EmployerDashboardProvider, useEmployerDashboard } from "@/contexts/EmployerDashboardContext";
import { EmployerDashboardSidebar } from "./EmployerDashboardSidebar";
import { EmployerDashboardTopBar } from "./EmployerDashboardTopBar";
import "./EmployerDashboardTokens.css";

function EmployerDashboardShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { accessibility } = useEmployerDashboard();

  return (
    <div
      data-employer-dashboard
      data-high-contrast={accessibility.highContrast}
      data-large-text={accessibility.largeText}
      data-reduced-motion={accessibility.reducedMotion}
      className="flex h-screen flex-col overflow-hidden bg-background"
    >
      <a
        href="#employer-dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t("employerDash.skipToContent")}
      </a>

      <EmployerDashboardTopBar />

      <div className="flex flex-1 overflow-hidden">
        <EmployerDashboardSidebar />
        <main id="employer-dashboard-main" tabIndex={-1} role="main" className="flex-1 overflow-y-auto p-4 focus:outline-none sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function EmployerDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <EmployerDashboardProvider>
      <EmployerDashboardShell>{children}</EmployerDashboardShell>
    </EmployerDashboardProvider>
  );
}
