import { type ReactNode } from "react";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { FinanceSidebar } from "./FinanceSidebar";
import { FinanceTopBar } from "./FinanceTopBar";
import { FinanceBreadcrumbs } from "./FinanceBreadcrumbs";
import { FreeAccessBanner } from "@/components/FreeAccessBanner";
import "./FinanceDesignTokens.css";

interface FinanceLayoutProps {
  children: ReactNode;
}

export function FinanceLayout({ children }: FinanceLayoutProps) {
  return (
    <FinanceProvider>
      {/* Scope all finance design tokens */}
      <div data-finance className="flex h-screen flex-col overflow-hidden bg-background">
        {/* Skip link for keyboard users */}
        <a
          href="#finance-main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
        >
          Skip to main content
        </a>

        {/* Free access banner (admin / new user 30-day period) */}
        <FreeAccessBanner serviceName="Visionex Finance" />

        {/* Top bar */}
        <FinanceTopBar />

        {/* Body: sidebar + main */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — hidden on mobile, shown on md+ */}
          <div className="hidden md:flex">
            <FinanceSidebar />
          </div>

          {/* Main content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <FinanceBreadcrumbs />
            <main
              id="finance-main"
              tabIndex={-1}
              className="flex-1 overflow-y-auto p-4 md:p-6 focus:outline-none"
              role="main"
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </FinanceProvider>
  );
}
