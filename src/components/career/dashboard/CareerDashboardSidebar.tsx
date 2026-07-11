import {
  LayoutDashboard, User, FileText, LayoutGrid, FileStack, Bookmark, Sparkles,
  CalendarClock, MessageCircle, Bell, Award, ClipboardCheck, Route, Coins,
  Trophy, Settings, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCareerDashboard } from "@/contexts/CareerDashboardContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CareerSection, SidebarNavItem } from "./types";

const NAV_ITEMS: SidebarNavItem[] = [
  { id: "overview", labelKey: "careerDash.nav.overview", icon: LayoutDashboard },
  { id: "profile", labelKey: "careerDash.nav.profile", icon: User },
  { id: "resume", labelKey: "careerDash.nav.resume", icon: FileText },
  { id: "portfolio", labelKey: "careerDash.nav.portfolio", icon: LayoutGrid },
  { id: "applications", labelKey: "careerDash.nav.applications", icon: FileStack },
  { id: "savedJobs", labelKey: "careerDash.nav.savedJobs", icon: Bookmark },
  { id: "recommendedJobs", labelKey: "careerDash.nav.recommendedJobs", icon: Sparkles },
  { id: "interviews", labelKey: "careerDash.nav.interviews", icon: CalendarClock },
  { id: "messages", labelKey: "careerDash.nav.messages", icon: MessageCircle },
  { id: "notifications", labelKey: "careerDash.nav.notifications", icon: Bell },
  { id: "certificates", labelKey: "careerDash.nav.certificates", icon: Award },
  { id: "skillTests", labelKey: "careerDash.nav.skillTests", icon: ClipboardCheck },
  { id: "careerRoadmap", labelKey: "careerDash.nav.careerRoadmap", icon: Route },
  { id: "salaryInsights", labelKey: "careerDash.nav.salaryInsights", icon: Coins },
  { id: "achievements", labelKey: "careerDash.nav.achievements", icon: Trophy },
  { id: "settings", labelKey: "careerDash.nav.settings", icon: Settings },
];

interface SidebarContentProps {
  collapsed: boolean;
  activeSection: CareerSection;
  onSelect: (id: CareerSection) => void;
}

function SidebarContent({ collapsed, activeSection, onSelect }: SidebarContentProps) {
  const { t } = useLanguage();

  return (
    <nav aria-label={t("careerDash.nav.label")} className="flex-1 overflow-y-auto py-3">
      <ul role="list" className="space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeSection;
          const button = (
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
            </button>
          );
          return (
            <li key={item.id}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
                </Tooltip>
              ) : (
                button
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function CareerDashboardSidebar() {
  const { t } = useLanguage();
  const { activeSection, setActiveSection, sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useCareerDashboard();

  const handleSelect = (id: CareerSection) => {
    setActiveSection(id);
    setMobileSidebarOpen(false);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        aria-label={t("careerDash.nav.label")}
        className={cn(
          "hidden md:flex flex-col border-e bg-card transition-all duration-200",
          sidebarCollapsed ? "w-[var(--career-sidebar-width-collapsed)]" : "w-[var(--career-sidebar-width)]"
        )}
      >
        <div className="flex h-14 items-center justify-end border-b px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label={t(sidebarCollapsed ? "careerDash.nav.expand" : "careerDash.nav.collapse")}
            aria-expanded={!sidebarCollapsed}
            className="h-8 w-8"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
        <SidebarContent collapsed={sidebarCollapsed} activeSection={activeSection} onSelect={handleSelect} />
      </aside>

      {/* Mobile drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={t("careerDash.nav.close")}
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside
            aria-label={t("careerDash.nav.label")}
            className="absolute inset-y-0 start-0 flex w-72 flex-col bg-card shadow-xl"
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="font-bold">{t("careerDash.title")}</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(false)} aria-label={t("careerDash.nav.close")} className="h-8 w-8">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <SidebarContent collapsed={false} activeSection={activeSection} onSelect={handleSelect} />
          </aside>
        </div>
      )}
    </>
  );
}
