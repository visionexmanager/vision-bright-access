import { createContext, useContext } from "react";
import type { NetworkSection } from "@/components/career/network/types";

// The provider lives in ./NetworkProvider. Keeping the context and its hook in
// a module that exports no components is what lets both halves hot-reload.

export interface NetworkAccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
}

export interface NetworkContextValue {
  activeSection: NetworkSection;
  setActiveSection: (section: NetworkSection) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  accessibility: NetworkAccessibilitySettings;
  updateAccessibility: (partial: Partial<NetworkAccessibilitySettings>) => void;
}

export const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used inside <NetworkProvider>");
  return ctx;
}
