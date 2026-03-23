import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "light" | "dark" | "high-contrast";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

export const useThemeToggle = () => useContext(ThemeContext);

const THEMES: Theme[] = ["light", "dark", "high-contrast"];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("visionex-theme") as Theme | null;
      if (stored && THEMES.includes(stored)) return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "high-contrast");
    root.classList.add(theme);
    localStorage.setItem("visionex-theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => {
      const idx = THEMES.indexOf(t);
      return THEMES[(idx + 1) % THEMES.length];
    });

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
