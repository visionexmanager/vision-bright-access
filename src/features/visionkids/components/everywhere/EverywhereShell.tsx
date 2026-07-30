import { Link, NavLink } from "react-router-dom";
import { ChevronLeft, Wifi, WifiOff, RefreshCw, Home, GraduationCap, Gamepad2, Palette, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConnection } from "@/features/visionkids/everywhere/useConnection";
import type { SyncStatus } from "@/features/visionkids/types/everywhere.types";

export function EverywhereHeader({
  emoji, title, subtitle, backTo = "/kids/everywhere", backLabelKey = "kids.everywhere.heroTitle",
}: { emoji: string; title: string; subtitle?: string; backTo?: string; backLabelKey?: string }) {
  const { t } = useLanguage();
  return (
    <div>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t(backLabelKey)}
      </Link>
      <h1 className="font-heading text-3xl font-extrabold sm:text-4xl"><span aria-hidden="true">{emoji}</span> {title}</h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Kid-friendly connection status pill. Optionally reflects a sync status. */
export function ConnectionBadge({ sync = "idle" }: { sync?: SyncStatus }) {
  const { t } = useLanguage();
  const { online } = useConnection();

  if (sync === "syncing") {
    return <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-kids-accent/40 bg-kids-accent/10 px-3 py-1 text-xs font-bold text-kids-accent"><RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> {t("kids.everywhere.status.syncing")}</span>;
  }
  if (!online) {
    return <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground"><WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.everywhere.status.offline")}</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-kids-green/40 bg-kids-green/10 px-3 py-1 text-xs font-bold text-kids-green"><Wifi className="h-3.5 w-3.5" aria-hidden="true" /> {t("kids.everywhere.status.online")}</span>;
}

const BOTTOM_ITEMS = [
  { to: "/kids", icon: Home, key: "kids.everywhere.tab.home", end: true },
  { to: "/kids/academy", icon: GraduationCap, key: "kids.everywhere.tab.learn" },
  { to: "/kids/games", icon: Gamepad2, key: "kids.everywhere.tab.play" },
  { to: "/kids/stem/design3d", icon: Palette, key: "kids.everywhere.tab.create" },
  { to: "/kids/settings", icon: User, key: "kids.everywhere.tab.profile" },
];

/** Mobile bottom navigation with kid-sized (56px) touch targets. A layout can
 *  render this on small screens; it's provided as a reusable component. */
export function BottomNav() {
  const { t } = useLanguage();
  return (
    <nav aria-label={t("kids.everywhere.bottomNav")} className="sticky bottom-0 z-20 flex items-stretch justify-around border-t-2 border-border bg-card sm:hidden">
      {BOTTOM_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end}
          className={({ isActive }) => `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold ${isActive ? "text-kids-primary" : "text-muted-foreground"}`}>
          <item.icon className="h-6 w-6" aria-hidden="true" />
          {t(item.key)}
        </NavLink>
      ))}
    </nav>
  );
}
