import { NavLink } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { kidsNavItems } from "@/features/visionkids/data/navItems";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useLanguage();
  return (
    <nav aria-label={t("kids.nav.sidebarLabel")}>
      <ul className="flex flex-col gap-1">
        {kidsNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <NavLink
                to={item.to}
                end={item.to === "/kids"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-kids-primary/10 text-kids-primary"
                      : "text-foreground/80 hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{t(item.labelKey)}</span>
                    {isActive && <span className="sr-only">{t("kids.nav.currentPage")}</span>}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  const { t, dir } = useLanguage();

  return (
    <>
      {/* Desktop — persistent rail */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-e border-border bg-background/60 p-4 lg:block">
        <SidebarNav />
      </aside>

      {/* Mobile — slide-over drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-72 p-4">
          <SheetTitle className="mb-2 font-heading text-base">{t("kids.nav.sidebarLabel")}</SheetTitle>
          <SidebarNav onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
