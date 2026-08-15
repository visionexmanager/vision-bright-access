import { useState, useCallback, type ReactNode } from "react";
import type { EmployerSection } from "@/components/career/employer/types";
import { EmployerDashboardContext, type EmployerAccessibilitySettings } from "./EmployerDashboardContext";

const defaultAccessibility: EmployerAccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  screenReaderOptimizedTables: true,
};

export function EmployerDashboardProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<EmployerSection>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accessibility, setAccessibility] = useState<EmployerAccessibilitySettings>(defaultAccessibility);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((prev) => !prev), []);
  const updateAccessibility = useCallback((partial: Partial<EmployerAccessibilitySettings>) => {
    setAccessibility((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <EmployerDashboardContext.Provider
      value={{
        activeSection,
        setActiveSection,
        sidebarCollapsed,
        toggleSidebar,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        accessibility,
        updateAccessibility,
      }}
    >
      {children}
    </EmployerDashboardContext.Provider>
  );
}
