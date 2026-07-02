import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { EmployerSection } from "@/components/career/employer/types";

interface EmployerAccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  screenReaderOptimizedTables: boolean;
}

interface EmployerDashboardContextValue {
  activeSection: EmployerSection;
  setActiveSection: (section: EmployerSection) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  accessibility: EmployerAccessibilitySettings;
  updateAccessibility: (partial: Partial<EmployerAccessibilitySettings>) => void;
}

const defaultAccessibility: EmployerAccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  screenReaderOptimizedTables: true,
};

const EmployerDashboardContext = createContext<EmployerDashboardContextValue | null>(null);

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

export function useEmployerDashboard() {
  const ctx = useContext(EmployerDashboardContext);
  if (!ctx) throw new Error("useEmployerDashboard must be used inside <EmployerDashboardProvider>");
  return ctx;
}
