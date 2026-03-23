import { Button } from "@/components/ui/button";
import { Moon, Sun, Eye } from "lucide-react";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeToggle();
  const { t } = useLanguage();

  const labelMap = {
    light: t("nav.darkMode") || "Switch to dark mode",
    dark: t("nav.highContrastMode") || "Switch to high contrast mode",
    "high-contrast": t("nav.lightMode") || "Switch to light mode",
  } as const;

  const iconMap = {
    light: <Moon className="h-5 w-5" />,
    dark: <Eye className="h-5 w-5" />,
    "high-contrast": <Sun className="h-5 w-5" />,
  } as const;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={labelMap[theme]}
    >
      {iconMap[theme]}
    </Button>
  );
}
