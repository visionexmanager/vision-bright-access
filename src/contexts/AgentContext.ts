import { createContext, useContext } from "react";
import type { AgentAccessibilitySettings, AgentIdentity, AgentMemory, AgentSection } from "@/components/career/agent/types";

// The provider lives in ./AgentProvider. Keeping the context and its hook in a
// module that exports no components is what lets both halves hot-reload.

export interface AgentContextValue {
  activeSection: AgentSection;
  setActiveSection: (section: AgentSection) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  identity: AgentIdentity;
  updateIdentity: (partial: Partial<AgentIdentity>) => void;

  memory: AgentMemory;
  updateMemory: (partial: Partial<AgentMemory>) => void;

  accessibility: AgentAccessibilitySettings;
  updateAccessibility: (partial: Partial<AgentAccessibilitySettings>) => void;
}

export const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used inside <AgentProvider>");
  return ctx;
}
