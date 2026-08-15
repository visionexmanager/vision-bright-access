import { useState, useCallback, type ReactNode } from "react";
import type { AccessibilitySettings, CareerSection, GeneralSettings } from "@/components/career/dashboard/types";
import { CareerDashboardContext } from "./CareerDashboardContext";

const defaultAccessibility: AccessibilitySettings = {
  screenReaderMode: false,
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  brailleDisplayReady: false,
  voiceNavigation: false,
};

const defaultGeneralSettings: GeneralSettings = {
  timezone: "UTC",
  currency: "USD",
  emailNotifications: true,
  pushNotifications: true,
  profileVisibility: "employersOnly",
};

export function CareerDashboardProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<CareerSection>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>(defaultAccessibility);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(defaultGeneralSettings);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((prev) => !prev), []);

  const updateAccessibility = useCallback((partial: Partial<AccessibilitySettings>) => {
    setAccessibility((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateGeneralSettings = useCallback((partial: Partial<GeneralSettings>) => {
    setGeneralSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <CareerDashboardContext.Provider
      value={{
        activeSection,
        setActiveSection,
        sidebarCollapsed,
        toggleSidebar,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        accessibility,
        updateAccessibility,
        generalSettings,
        updateGeneralSettings,
      }}
    >
      {children}
    </CareerDashboardContext.Provider>
  );
}
