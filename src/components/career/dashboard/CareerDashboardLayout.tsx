import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CareerDashboardProvider, useCareerDashboard } from "@/contexts/CareerDashboardContext";
import { CareerDashboardSidebar } from "./CareerDashboardSidebar";
import { CareerDashboardTopBar } from "./CareerDashboardTopBar";
import "./CareerDashboardTokens.css";

interface CareerDashboardLayoutProps {
  children: ReactNode;
}

function CareerDashboardShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { accessibility } = useCareerDashboard();

  return (
    <div
      data-career-dashboard
      data-high-contrast={accessibility.highContrast}
      data-large-text={accessibility.largeText}
      data-reduced-motion={accessibility.reducedMotion}
      className="flex h-screen flex-col overflow-hidden bg-background"
    >
      <a
        href="#career-dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t("careerDash.skipToContent")}
      </a>

      <CareerDashboardTopBar />

      <div className="flex flex-1 overflow-hidden">
        <CareerDashboardSidebar />
        <main
          id="career-dashboard-main"
          tabIndex={-1}
          role="main"
          className="flex-1 overflow-y-auto p-4 focus:outline-none sm:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function CareerDashboardLayout({ children }: CareerDashboardLayoutProps) {
  return (
    <CareerDashboardProvider>
      <CareerDashboardShell>{children}</CareerDashboardShell>
    </CareerDashboardProvider>
  );
}
