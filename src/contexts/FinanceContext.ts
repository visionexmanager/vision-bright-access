import { createContext, useContext } from "react";
import type { FinancePermission, FinanceSettings } from "@/lib/types/finance";

// The provider lives in ./FinanceProvider. Keeping the context and its hook in
// a module that exports no components is what lets both halves hot-reload.

export interface FinanceContextValue {
  // Permissions
  hasPermission: (p: FinancePermission) => boolean;

  // User settings
  settings: FinanceSettings;
  updateSettings: (partial: Partial<FinanceSettings>) => void;

  // UI state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const FinanceContext = createContext<FinanceContextValue | null>(null);

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used inside <FinanceProvider>");
  return ctx;
}
