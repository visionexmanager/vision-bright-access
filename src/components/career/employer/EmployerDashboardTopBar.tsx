import { Link } from "react-router-dom";
import { Menu, Bell, Moon, Sun, Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useEmployerDashboard } from "@/contexts/EmployerDashboardContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MOCK_COMPANY_PROFILE } from "./mock/mockCompany";

export function EmployerDashboardTopBar() {
  const { t } = useLanguage();
  const { theme, setTheme } = useThemeToggle();
  const { setActiveSection, setMobileSidebarOpen } = useEmployerDashboard();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/80 px-4 backdrop-blur-md" role="banner">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setMobileSidebarOpen(true)} aria-label={t("employerDash.nav.open")}>
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Link to="/career/employer" className="flex items-center gap-2 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <Building2 className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">{t("employerDash.title")}</span>
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={t("employerDash.topbar.toggleTheme")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("employerDash.nav.notifications")} onClick={() => setActiveSection("messages")}>
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="ms-1 flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={t("employerDash.topbar.accountMenu")}>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: MOCK_COMPANY_PROFILE.logoColor }}>
                  {MOCK_COMPANY_PROFILE.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-sm font-semibold">{MOCK_COMPANY_PROFILE.name}</div>
            <div className="px-2 pb-1.5 text-xs text-muted-foreground">{MOCK_COMPANY_PROFILE.industry}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActiveSection("settings")}>{t("employerDash.nav.settings")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/careers">{t("employerDash.topbar.backToCareers")}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
