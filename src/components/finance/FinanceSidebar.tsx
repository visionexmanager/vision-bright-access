import { Link, useLocation } from "react-router-dom";
import { useFinance } from "@/contexts/FinanceContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Star,
  Bot,
  CalendarDays,
  Newspaper,
  Users,
  Scale,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  DollarSign,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  children?: { to: string; label: string; icon: React.ElementType }[];
}

function useNavItems(): NavItem[] {
  const { t } = useLanguage();
  return [
    { to: "/finance", label: t("finance.nav.dashboard") || "Dashboard", icon: LayoutDashboard },
    {
      to: "/finance/markets",
      label: t("finance.nav.markets") || "Markets",
      icon: TrendingUp,
      children: [
        { to: "/finance/markets/stocks", label: t("finance.nav.stocks") || "Stocks", icon: BarChart2 },
        { to: "/finance/markets/currencies", label: t("finance.nav.currencies") || "Currencies", icon: DollarSign },
        { to: "/finance/markets/commodities", label: t("finance.nav.commodities") || "Commodities", icon: Package },
      ],
    },
    { to: "/finance/portfolio", label: t("finance.nav.portfolio") || "Portfolio", icon: Briefcase },
    { to: "/finance/watchlist", label: t("finance.nav.watchlist") || "Watchlist", icon: Star },
    { to: "/finance/ai-analyst", label: t("finance.nav.aiAnalyst") || "AI Analyst", icon: Bot },
    { to: "/finance/calendar", label: t("finance.nav.calendar") || "Economic Calendar", icon: CalendarDays },
    { to: "/finance/news", label: t("finance.nav.news") || "Market News", icon: Newspaper },
    { to: "/finance/brokers", label: t("finance.nav.brokers") || "Broker Comparison", icon: Scale },
    { to: "/finance/affiliate", label: t("finance.nav.affiliate") || "Affiliate Center", icon: Users },
    { to: "/finance/academy", label: t("finance.nav.academy") || "Finance Academy", icon: GraduationCap },
  ];
}

export function FinanceSidebar() {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useFinance();
  const items = useNavItems();

  const isActive = (to: string) =>
    to === "/finance"
      ? location.pathname === "/finance"
      : location.pathname.startsWith(to);

  return (
    <aside
      aria-label="Finance navigation"
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Collapse toggle */}
      <div className="flex h-14 items-center justify-end border-b px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          className="h-8 w-8"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Nav items */}
      <nav aria-label="Finance sections" className="flex-1 overflow-y-auto py-3">
        <ul role="list" className="space-y-0.5 px-2">
          {items.map((item) => (
            <li key={item.to}>
              <SidebarItem
                item={item}
                collapsed={sidebarCollapsed}
                active={isActive(item.to)}
                pathname={location.pathname}
              />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function SidebarItem({
  item,
  collapsed,
  active,
  pathname,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  pathname: string;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  return (
    <>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      ) : (
        link
      )}

      {/* Sub-items (only when expanded) */}
      {!collapsed && item.children && active && (
        <ul role="list" className="mt-0.5 space-y-0.5 pl-7">
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            const childActive = pathname.startsWith(child.to);
            return (
              <li key={child.to}>
                <Link
                  to={child.to}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    childActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <ChildIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
