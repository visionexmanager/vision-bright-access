import { createContext, useContext } from "react";
import type { AccessibilitySettings, CareerSection, GeneralSettings } from "@/components/career/dashboard/types";

// The provider lives in ./CareerDashboardProvider. Keeping the context and its
// hook in a module that exports no components is what lets both halves
// hot-reload.

export interface CareerDashboardContextValue {
  activeSection: CareerSection;
  setActiveSection: (section: CareerSection) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  accessibility: AccessibilitySettings;
  updateAccessibility: (partial: Partial<AccessibilitySettings>) => void;

  generalSettings: GeneralSettings;
  updateGeneralSettings: (partial: Partial<GeneralSettings>) => void;
}

export const CareerDashboardContext = createContext<CareerDashboardContextValue | null>(null);

export function useCareerDashboard() {
  const ctx = useContext(CareerDashboardContext);
  if (!ctx) throw new Error("useCareerDashboard must be used inside <CareerDashboardProvider>");
  return ctx;
}
