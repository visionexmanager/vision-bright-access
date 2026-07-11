import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { NetworkSection } from "@/components/career/network/types";

interface NetworkAccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
}

interface NetworkContextValue {
  activeSection: NetworkSection;
  setActiveSection: (section: NetworkSection) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  accessibility: NetworkAccessibilitySettings;
  updateAccessibility: (partial: Partial<NetworkAccessibilitySettings>) => void;
}

const defaultAccessibility: NetworkAccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

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

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used inside <NetworkProvider>");
  return ctx;
}
