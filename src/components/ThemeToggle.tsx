import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeToggle();
  const { t } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? (t("nav.lightMode") || "Switch to light mode") : (t("nav.darkMode") || "Switch to dark mode")}
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}
