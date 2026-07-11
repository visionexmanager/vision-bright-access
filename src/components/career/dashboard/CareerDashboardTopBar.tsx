import { Link } from "react-router-dom";
import { Menu, Bell, Briefcase } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCareerDashboard } from "@/contexts/CareerDashboardContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MOCK_NOTIFICATIONS } from "./mock/mockNotifications";
import { MOCK_PROFILE } from "./mock/mockProfile";

export function CareerDashboardTopBar() {
  const { t } = useLanguage();
  const { setActiveSection, setMobileSidebarOpen } = useCareerDashboard();
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;
  const initials = MOCK_PROFILE.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/80 px-4 backdrop-blur-md" role="banner">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label={t("careerDash.nav.open")}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Link to="/careers" className="flex items-center gap-2 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
          <Briefcase className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">{t("careerDash.title")}</span>
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={t("careerDash.nav.notifications")}
          onClick={() => setActiveSection("notifications")}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ms-1 flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={t("careerDash.topbar.accountMenu")}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-sm font-semibold">{MOCK_PROFILE.fullName}</div>
            <div className="px-2 pb-1.5 text-xs text-muted-foreground">{MOCK_PROFILE.headline}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActiveSection("profile")}>{t("careerDash.nav.profile")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveSection("settings")}>{t("careerDash.nav.settings")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/careers">{t("careerDash.topbar.backToCareers")}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
