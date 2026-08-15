import { createContext, useContext } from "react";

// The provider lives in ./ThemeProvider. Keeping the context and its hook in a
// module that exports no components is what lets both halves hot-reload.

export type Theme = "light" | "dark" | "high-contrast";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export const useThemeToggle = () => useContext(ThemeContext);
