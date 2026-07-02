import { Newspaper, UserCircle, Users, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NetworkSection } from "./types";

const NAV_ITEMS: { id: NetworkSection; labelKey: string; icon: typeof Newspaper }[] = [
  { id: "feed", labelKey: "networkUI.nav.feed", icon: Newspaper },
  { id: "profile", labelKey: "networkUI.nav.profile", icon: UserCircle },
  { id: "connections", labelKey: "networkUI.nav.connections", icon: Users },
];

function SidebarContent({ collapsed, active, onSelect }: { collapsed: boolean; active: NetworkSection; onSelect: (id: NetworkSection) => void }) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t("networkUI.nav.label")} className="flex-1 overflow-y-auto py-3">
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

export function NetworkSidebar() {
  const { t } = useLanguage();
  const { activeSection, setActiveSection, sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useNetwork();

  const handleSelect = (id: NetworkSection) => {
    setActiveSection(id);
    setMobileSidebarOpen(false);
  };

  return (
    <>
      <aside
        aria-label={t("networkUI.nav.label")}
        className={cn(
          "hidden md:flex flex-col border-e bg-card/60 backdrop-blur-md transition-all duration-200",
          sidebarCollapsed ? "w-[var(--net-sidebar-width-collapsed)]" : "w-[var(--net-sidebar-width)]"
        )}
      >
        <div className="flex h-14 items-center justify-end border-b px-2">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label={t(sidebarCollapsed ? "networkUI.nav.expand" : "networkUI.nav.collapse")} aria-expanded={!sidebarCollapsed} className="h-8 w-8">
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
        <SidebarContent collapsed={sidebarCollapsed} active={activeSection} onSelect={handleSelect} />
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label={t("networkUI.nav.close")} className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside aria-label={t("networkUI.nav.label")} className="absolute inset-y-0 start-0 flex w-72 flex-col bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="font-bold">{t("networkUI.title")}</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(false)} aria-label={t("networkUI.nav.close")} className="h-8 w-8">
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
