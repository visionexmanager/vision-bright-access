import { Link } from "react-router-dom";
import { Menu, Bell, Moon, Sun } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeToggle } from "@/contexts/ThemeContext";
import { useAgent } from "@/contexts/AgentContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MOCK_NOTIFICATIONS } from "./mock/mockNotifications";

export function AgentTopBar() {
  const { t } = useLanguage();
  const { theme, setTheme } = useThemeToggle();
  const { identity, setActiveSection, setMobileSidebarOpen } = useAgent();
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/70 px-4 backdrop-blur-md" role="banner">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setMobileSidebarOpen(true)} aria-label={t("agentUI.nav.open")}>
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Link to="/career/dashboard" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-base"
            style={{ backgroundColor: `${identity.avatarColor}22` }}
            aria-hidden="true"
          >
            {identity.avatarEmoji}
          </span>
          <span className="hidden font-semibold sm:inline">{identity.name}</span>
          <span className="relative hidden h-2 w-2 sm:inline-flex" aria-hidden="true">
            <span className="agent-status-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("agentUI.topbar.toggleTheme")}>
          {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label={t("agentUI.nav.notifications")} onClick={() => setActiveSection("notifications")}>
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="ms-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={t("agentUI.topbar.menu")}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full text-base" style={{ backgroundColor: `${identity.avatarColor}22` }}>
                {identity.avatarEmoji}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-sm font-semibold">{identity.name}</div>
            <div className="px-2 pb-1.5 text-xs text-muted-foreground">{t(`agentUI.personality.${identity.personality}`)}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActiveSection("settings")}>{t("agentUI.nav.settings")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/career/dashboard">{t("agentUI.topbar.backToDashboard")}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
