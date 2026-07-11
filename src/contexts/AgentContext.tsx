import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { AgentAccessibilitySettings, AgentIdentity, AgentMemory, AgentSection } from "@/components/career/agent/types";

interface AgentContextValue {
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

const defaultIdentity: AgentIdentity = {
  name: "Nova",
  avatarEmoji: "✨",
  avatarColor: "#6366f1",
  personality: "friendly",
};

const defaultMemory: AgentMemory = {
  knownSkills: ["React", "TypeScript", "Accessibility"],
  careerInterests: ["Frontend Engineering", "AI Products"],
  preferredCountries: ["Remote", "Canada", "Germany"],
  preferredIndustries: ["Technology", "Healthcare"],
  preferredSalaryMin: 90000,
  preferredJobTypes: ["Full-time", "Remote"],
};

const defaultAccessibility: AgentAccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
};

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<AgentSection>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [identity, setIdentity] = useState<AgentIdentity>(defaultIdentity);
  const [memory, setMemory] = useState<AgentMemory>(defaultMemory);
  const [accessibility, setAccessibility] = useState<AgentAccessibilitySettings>(defaultAccessibility);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((prev) => !prev), []);
  const updateIdentity = useCallback((partial: Partial<AgentIdentity>) => setIdentity((prev) => ({ ...prev, ...partial })), []);
  const updateMemory = useCallback((partial: Partial<AgentMemory>) => setMemory((prev) => ({ ...prev, ...partial })), []);
  const updateAccessibility = useCallback((partial: Partial<AgentAccessibilitySettings>) => setAccessibility((prev) => ({ ...prev, ...partial })), []);

  return (
    <AgentContext.Provider
      value={{
        activeSection, setActiveSection,
        sidebarCollapsed, toggleSidebar,
        mobileSidebarOpen, setMobileSidebarOpen,
        identity, updateIdentity,
        memory, updateMemory,
        accessibility, updateAccessibility,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used inside <AgentProvider>");
  return ctx;
}
