import {
  Sparkles, Sunrise, Target, Radar, Lightbulb, Send, Mic, Handshake,
  BookOpen, ListChecks, BarChart3, Bell, Settings, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAgent } from "@/contexts/AgentContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AgentSection, SidebarNavItem } from "./types";

const NAV_ITEMS: SidebarNavItem[] = [
  { id: "home", labelKey: "agentUI.nav.home", icon: Sparkles },
  { id: "briefing", labelKey: "agentUI.nav.briefing", icon: Sunrise },
  { id: "goals", labelKey: "agentUI.nav.goals", icon: Target },
  { id: "opportunities", labelKey: "agentUI.nav.opportunities", icon: Radar },
  { id: "recommendations", labelKey: "agentUI.nav.recommendations", icon: Lightbulb },
  { id: "application", labelKey: "agentUI.nav.application", icon: Send },
  { id: "interview", labelKey: "agentUI.nav.interview", icon: Mic },
  { id: "negotiation", labelKey: "agentUI.nav.negotiation", icon: Handshake },
  { id: "journal", labelKey: "agentUI.nav.journal", icon: BookOpen },
  { id: "productivity", labelKey: "agentUI.nav.productivity", icon: ListChecks },
  { id: "insights", labelKey: "agentUI.nav.insights", icon: BarChart3 },
  { id: "notifications", labelKey: "agentUI.nav.notifications", icon: Bell },
  { id: "settings", labelKey: "agentUI.nav.settings", icon: Settings },
];

function SidebarContent({ collapsed, active, onSelect }: { collapsed: boolean; active: AgentSection; onSelect: (id: AgentSection) => void }) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t("agentUI.nav.label")} className="flex-1 overflow-y-auto py-3">
      <ul role="list" className="space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          const button = (
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
              ) : button}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AgentSidebar() {
  const { t } = useLanguage();
  const { activeSection, setActiveSection, sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useAgent();

  const handleSelect = (id: AgentSection) => {
    setActiveSection(id);
    setMobileSidebarOpen(false);
  };

  return (
    <>
      <aside
        aria-label={t("agentUI.nav.label")}
        className={cn(
          "hidden md:flex flex-col border-e bg-card/60 backdrop-blur-md transition-all duration-200",
          sidebarCollapsed ? "w-[var(--agent-sidebar-width-collapsed)]" : "w-[var(--agent-sidebar-width)]"
        )}
      >
        <div className="flex h-14 items-center justify-end border-b px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label={t(sidebarCollapsed ? "agentUI.nav.expand" : "agentUI.nav.collapse")}
            aria-expanded={!sidebarCollapsed}
            className="h-8 w-8"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
        <SidebarContent collapsed={sidebarCollapsed} active={activeSection} onSelect={handleSelect} />
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label={t("agentUI.nav.close")} className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside aria-label={t("agentUI.nav.label")} className="absolute inset-y-0 start-0 flex w-72 flex-col bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="font-bold">{t("agentUI.title")}</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(false)} aria-label={t("agentUI.nav.close")} className="h-8 w-8">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <SidebarContent collapsed={false} active={activeSection} onSelect={handleSelect} />
          </aside>
        </div>
      )}
    </>
  );
}
