import { Link } from "react-router-dom";
import { Menu, Moon, Sun, Globe2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { Button } from "@/components/ui/button";
import { MOCK_PROFESSIONAL_PROFILE } from "./mock/mockProfile";

export function NetworkTopBar() {
  const { t } = useLanguage();
  const { theme, setTheme } = useThemeToggle();
  const { setActiveSection, setMobileSidebarOpen } = useNetwork();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/70 px-4 backdrop-blur-md" role="banner">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setMobileSidebarOpen(true)} aria-label={t("networkUI.nav.open")}>
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Link to="/careers" className="flex items-center gap-2 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <Globe2 className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">{t("networkUI.title")}</span>
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("networkUI.topbar.toggleTheme")}>
          {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <button
          type="button"
          onClick={() => setActiveSection("profile")}
          aria-label={t("networkUI.topbar.myProfile")}
          className="ms-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ backgroundColor: MOCK_PROFESSIONAL_PROFILE.avatarColor }}
        >
          {MOCK_PROFESSIONAL_PROFILE.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </button>
      </div>
    </header>
  );
}
