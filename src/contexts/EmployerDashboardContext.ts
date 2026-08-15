import { createContext, useContext } from "react";
import type { EmployerSection } from "@/components/career/employer/types";

// The provider lives in ./EmployerDashboardProvider. Keeping the context and
// its hook in a module that exports no components is what lets both halves
// hot-reload.

export interface EmployerAccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  screenReaderOptimizedTables: boolean;
}

export interface EmployerDashboardContextValue {
  activeSection: EmployerSection;
  setActiveSection: (section: EmployerSection) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  accessibility: EmployerAccessibilitySettings;
  updateAccessibility: (partial: Partial<EmployerAccessibilitySettings>) => void;
}

export const EmployerDashboardContext = createContext<EmployerDashboardContextValue | null>(null);

export function useEmployerDashboard() {
  const ctx = useContext(EmployerDashboardContext);
  if (!ctx) throw new Error("useEmployerDashboard must be used inside <EmployerDashboardProvider>");
  return ctx;
}
