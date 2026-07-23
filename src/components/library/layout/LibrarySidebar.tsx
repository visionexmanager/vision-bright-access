import { useRef, useState, KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, LayoutGrid, Compass, Headphones, Users2, Library as LibraryIcon, ListChecks,
  Heart, BookOpenCheck, Download, Star, MessagesSquare, LayoutDashboard,
  ShieldCheck, ChevronLeft, ChevronRight, PenLine, Gift, Network, Inbox, Layers, UserCircle, Trophy, Calendar, Award,
  Route, Brain, Gauge, GraduationCap, Clock, Sparkles, Microscope, FolderKanban, Lightbulb, Bot, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

function useNavItems(userId: string | undefined): NavItem[] {
  const { t } = useLanguage();
  return [
    { to: "/library", label: t("library.nav.home"), icon: Home },
    { to: "/library/librarian", label: t("library.librarian.title"), icon: Bot, requiresAuth: true },
    { to: "/library/categories", label: t("library.nav.categories"), icon: LayoutGrid },
    { to: "/library/books", label: t("library.explorer.title"), icon: Compass },
    { to: "/library/audiobooks", label: t("library.nav.audiobooks"), icon: Headphones },
    { to: "/library/authors", label: t("library.nav.authors"), icon: Users2 },
    { to: `/library/profile/${userId ?? ""}`, label: t("library.profile.title"), icon: UserCircle, requiresAuth: true },
    { to: "/library/my-library", label: t("library.nav.myLibrary"), icon: LibraryIcon, requiresAuth: true },
    { to: "/library/reading-lists", label: t("library.nav.readingLists"), icon: ListChecks, requiresAuth: true },
    { to: "/library/favorites", label: t("library.nav.favorites"), icon: Heart, requiresAuth: true },
    { to: "/library/wishlist", label: t("library.nav.wishlist"), icon: Gift, requiresAuth: true },
    { to: "/library/continue-reading", label: t("library.nav.continueReading"), icon: BookOpenCheck, requiresAuth: true },
    { to: "/library/downloads", label: t("library.nav.downloads"), icon: Download, requiresAuth: true },
    { to: "/library/reviews", label: t("library.nav.reviews"), icon: Star, requiresAuth: true },
    { to: "/library/community", label: t("library.nav.community"), icon: MessagesSquare, requiresAuth: true },
    { to: "/library/clubs", label: t("library.clubs.title"), icon: Users2 },
    { to: "/library/challenges", label: t("library.challenge.pageTitle"), icon: Trophy },
    { to: "/library/events", label: t("library.events.title"), icon: Calendar },
    { to: "/library/leaderboard", label: t("library.leaderboard.title"), icon: Award },
    { to: "/library/learning-paths", label: t("library.learningPaths.title"), icon: Route },
    { to: "/library/flashcards", label: t("library.flashcards.title"), icon: Layers, requiresAuth: true },
    { to: "/library/study-assistant", label: t("library.studyAssistant.title"), icon: Brain, requiresAuth: true },
    { to: "/library/learning-analytics", label: t("library.analytics.title"), icon: Gauge, requiresAuth: true },
    { to: "/library/certificates", label: t("library.certificates.title"), icon: GraduationCap, requiresAuth: true },
    { to: "/library/dashboard", label: t("library.nav.dashboard"), icon: LayoutDashboard, requiresAuth: true },
    { to: "/library/studio", label: t("library.nav.studio"), icon: PenLine, requiresAuth: true },
    { to: "/library/knowledge-graph", label: t("library.knowledgeGraph.title"), icon: Network },
    { to: "/library/timelines", label: t("library.timelines.title"), icon: Clock },
    { to: "/library/ai-search", label: t("library.aiSearch.title"), icon: Sparkles },
    { to: "/library/research-assistant", label: t("library.researchAssistant.title"), icon: Microscope, requiresAuth: true },
    { to: "/library/research-projects", label: t("library.researchProjects.title"), icon: FolderKanban, requiresAuth: true },
    { to: "/library/ai-insights", label: t("library.aiInsights.title"), icon: Lightbulb },
    { to: "/library/organizations", label: t("library.enterprise.title"), icon: Building2, requiresAuth: true },
    { to: "/library/import-review", label: t("library.importReview.title"), icon: Inbox, adminOnly: true },
    { to: "/library/collections-admin", label: t("library.collectionsAdmin.title"), icon: Layers, adminOnly: true },
    { to: "/library/admin", label: t("library.nav.admin"), icon: ShieldCheck, adminOnly: true },
  ];
}

export function LibrarySidebar() {
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const allItems = useNavItems(user?.id);
  const items = allItems.filter((item) => (item.adminOnly ? isAdmin : item.requiresAuth ? !!user : true));

  const isActive = (to: string) => (to === "/library" ? location.pathname === "/library" : location.pathname.startsWith(to));

  const handleKeyDown = (e: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    const links = listRef.current?.querySelectorAll<HTMLElement>("a");
    if (!links) return;
    const count = links.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      links[(index + 1) % count]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      links[(index - 1 + count) % count]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      links[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      links[count - 1]?.focus();
    }
  };

  return (
    <aside
      aria-label={t("library.nav.sectionNav")}
      className={cn("flex shrink-0 flex-col border-e bg-card transition-all duration-200", collapsed ? "w-16" : "w-60")}
    >
      <div className="flex h-12 items-center justify-end border-b px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? t("library.nav.expandSidebar") : t("library.nav.collapseSidebar")}
          aria-expanded={!collapsed}
          className="h-8 w-8"
        >
          {collapsed ? <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
        </Button>
      </div>
      <nav aria-label={t("library.nav.sectionNav")} className="flex-1 overflow-y-auto py-2">
        <ul ref={listRef} role="list" className="space-y-0.5 px-2">
          {items.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            const link = (
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
            return (
              <li key={item.to}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
