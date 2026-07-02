import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type {
  FinancePermission,
  FinanceSettings,
} from "@/lib/types/finance";
import { useAuth } from "@/contexts/AuthContext";

interface FinanceContextValue {
  // Permissions
  hasPermission: (p: FinancePermission) => boolean;

  // User settings
  settings: FinanceSettings;
  updateSettings: (partial: Partial<FinanceSettings>) => void;

  // UI state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const defaultSettings: FinanceSettings = {
  defaultCurrency: "USD",
  showChangePercent: true,
  compactView: false,
  refreshInterval: 60,
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<FinanceSettings>(defaultSettings);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const hasPermission = useCallback(
    (permission: FinancePermission): boolean => {
      if (!user) return permission === "finance.view";
      // finance.admin requires the platform admin role (enforced by AdminRoute).
      if (permission === "finance.admin") {
        return (user as { role?: string }).role === "admin";
      }
      return true;
    },
    [user]
  );

  const updateSettings = useCallback((partial: Partial<FinanceSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <FinanceContext.Provider
      value={{
        hasPermission,
        settings,
        updateSettings,
        sidebarCollapsed,
        toggleSidebar,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used inside <FinanceProvider>");
  return ctx;
}
