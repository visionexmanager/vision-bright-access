import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface TopNavProps {
  onOpenSidebar: () => void;
}

export function TopNav({ onOpenSidebar }: TopNavProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/kids/stories?q=${encodeURIComponent(q)}`);
  };

  const initials = (user?.email ?? "K").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenSidebar}
        aria-label={t("kids.nav.openSidebar")}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Link to="/kids" className="flex items-center gap-2 font-heading text-lg font-extrabold" aria-label={t("kids.brand.home")}>
        <span aria-hidden="true" className="text-2xl">🌈</span>
        <span className="bg-gradient-to-r from-kids-primary via-kids-pink to-kids-accent bg-clip-text text-transparent">
          VisionKids
        </span>
      </Link>

      <form onSubmit={handleSearch} role="search" className="ms-2 hidden max-w-sm flex-1 items-center gap-2 sm:flex">
        <label htmlFor="kids-search" className="sr-only">{t("kids.nav.search")}</label>
        <div className="relative w-full">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="kids-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("kids.nav.searchPlaceholder")}
            className="ps-9"
          />
        </div>
      </form>

      <div className="ms-auto flex items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" className="sm:hidden" aria-label={t("kids.nav.search")} onClick={() => navigate("/kids/stories")}>
          <Search className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("kids.nav.notifications")} className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-kids-pink" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>{t("kids.nav.notifications")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm text-muted-foreground" disabled>
              {t("kids.nav.noNotifications")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <LanguageSwitcher />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("kids.nav.profile")}>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-kids-primary/15 text-kids-primary">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {user ? (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/profile">{t("kids.nav.profile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/kids/settings">{t("kids.nav.settings")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/">{t("kids.nav.backToVisionex")}</Link>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem asChild>
                <Link to="/login">{t("nav.login")}</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
