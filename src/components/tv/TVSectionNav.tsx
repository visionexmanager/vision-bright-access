/**
 * TVSectionNav
 *
 * Persistent sub-navigation bar for all /services/live-tv/* pages.
 * Shows: Browse · Favorites · Search · Playlists
 */

import { Link, useLocation } from "react-router-dom";
import { Tv, Heart, Search, List, Clapperboard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/services/live-tv",            en: "Browse",    ar: "تصفح",    icon: Tv,     exact: true  },
  { path: "/services/live-tv/favorites",  en: "Favorites", ar: "المفضلة", icon: Heart,  exact: false },
  { path: "/services/live-tv/search",     en: "Search",    ar: "بحث",     icon: Search, exact: false },
  { path: "/services/live-tv/playlists",  en: "Playlists", ar: "قوائمي",  icon: List,   exact: false },
  { path: "/services/live-tv/streaming",  en: "Movies & Series", ar: "أفلام ومسلسلات", icon: Clapperboard, exact: false },
] as const;

export function TVSectionNav() {
  const { pathname } = useLocation();
  const { dir }      = useLanguage();
  const isRTL        = dir === "rtl";

  const isActive = (item: typeof NAV[number]) =>
    item.exact ? pathname === item.path : pathname.startsWith(item.path);

  return (
    <nav
      className="flex gap-1 overflow-x-auto py-0.5"
      style={{ scrollbarWidth: "none" }}
      aria-label={isRTL ? "قسم التلفزيون" : "TV sections"}
    >
      {NAV.map(item => {
        const Icon   = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
              active
                ? "bg-blue-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {isRTL ? item.ar : item.en}
          </Link>
        );
      })}
    </nav>
  );
}
