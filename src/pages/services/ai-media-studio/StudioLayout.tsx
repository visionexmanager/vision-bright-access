import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FolderOpen,
  Mic,
  AudioWaveform,
  Cpu,
  Video,
  LayoutTemplate,
  Library,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lock,
  CreditCard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WalletCard } from "./components/billing/WalletCard";
import { TrialBanner } from "./components/billing/TrialBanner";
import { useBillingInit } from "@/hooks/useBilling";

interface NavItem {
  label: string;
  icon: React.ElementType;
  to?: string;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",     icon: LayoutDashboard, to: "/services/ai-media-studio" },
  { label: "Projects",      icon: FolderOpen,       to: "/services/ai-media-studio/projects" },
  { label: "Speech Studio", icon: Mic,              to: "/services/ai-media-studio/speech" },
  { label: "Voice Studio",  icon: AudioWaveform,    to: "/services/ai-media-studio/voice" },
  { label: "Video Studio",  icon: Video,            to: "/services/ai-media-studio/video" },
  { label: "Provider Hub",  icon: Cpu,              to: "/services/ai-media-studio/provider-hub" },
  { label: "Billing",       icon: CreditCard,       to: "/services/ai-media-studio/billing" },
  { label: "Templates",     icon: LayoutTemplate,   to: "/services/ai-media-studio/templates" },
  { label: "Assets",        icon: Library,          to: "/services/ai-media-studio/assets" },
  { label: "Settings",      icon: Settings,         to: "/services/ai-media-studio/settings" },
  { label: "Help",          icon: HelpCircle,       to: "/services/ai-media-studio/help" },
];

interface StudioLayoutProps {
  children: React.ReactNode;
}

export function StudioLayout({ children }: StudioLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();

  useBillingInit();

  return (
    <Layout>
      <div className="flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Trial countdown banner (only shows when trial < 24h) */}
        <TrialBanner onUpgrade={() => navigate("/services/ai-media-studio/billing")} />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            "hidden md:flex flex-col border-r bg-card/50 transition-all duration-200 shrink-0",
            collapsed ? "w-16" : "w-56"
          )}
        >
          {/* Studio brand */}
          <div className={cn("flex items-center gap-2 px-4 py-5 border-b", collapsed && "justify-center px-2")}>
            {!collapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-semibold truncate">AI Media Studio</span>
              </div>
            )}
            {collapsed && <Sparkles className="h-5 w-5 text-primary" />}
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-3 px-2 space-y-0.5" aria-label="Studio navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.to ? location.pathname === item.to : false;

              if (item.comingSoon) {
                return (
                  <Tooltip key={item.label} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-not-allowed opacity-50",
                          collapsed && "justify-center px-2"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {!collapsed && (
                          <span className="flex-1 truncate">{item.label}</span>
                        )}
                        {!collapsed && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Lock className="h-2.5 w-2.5" />Soon
                          </Badge>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label} — Coming Soon
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Tooltip key={item.label} delayDuration={collapsed ? 0 : 800}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.to!}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
                        collapsed && "justify-center px-2",
                        isActive ? "bg-primary/10 text-primary" : "text-foreground/80"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>

          {/* Wallet balance chip */}
          {!collapsed && (
            <div className="px-3 pb-2 border-t pt-2">
              <WalletCard compact onBuyCredits={() => navigate("/services/ai-media-studio/billing")} />
            </div>
          )}

          {/* Collapse toggle */}
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="icon"
              className="w-full h-8"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
      </div>
    </Layout>
  );
}
