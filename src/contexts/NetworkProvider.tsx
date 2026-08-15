import { useState, useCallback, type ReactNode } from "react";
import type { NetworkSection } from "@/components/career/network/types";
import { NetworkContext, type NetworkAccessibilitySettings } from "./NetworkContext";

const defaultAccessibility: NetworkAccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
};

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<NetworkSection>("feed");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accessibility, setAccessibility] = useState<NetworkAccessibilitySettings>(defaultAccessibility);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((prev) => !prev), []);
  const updateAccessibility = useCallback((partial: Partial<NetworkAccessibilitySettings>) => {
    setAccessibility((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <NetworkContext.Provider
      value={{ activeSection, setActiveSection, sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen, accessibility, updateAccessibility }}
    >
      {children}
    </NetworkContext.Provider>
  );
}
