import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useSound } from "@/contexts/SoundContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { LogOut, Menu, X, Heart, User, ShieldCheck, Coins, Settings, Volume2, VolumeX } from "lucide-react";
import logo from "@/assets/logo.png";
import { usePoints } from "@/hooks/usePoints";
import { useState, useRef, useEffect, useCallback } from "react";
import { CartDrawer } from "@/components/CartDrawer";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";

export function Navbar() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { enabled: soundEnabled, setEnabled: setSoundEnabled, playSound } = useSound();
  const { totalPoints } = usePoints();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menubarRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Focus first menu item when mobile menu opens
  useEffect(() => {
    if (menuOpen) {
      const first = mobileMenuRef.current?.querySelector<HTMLElement>("a, button");
      first?.focus();
    }
  }, [menuOpen]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    toggleRef.current?.focus();
  }, []);

  const handleMobileMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    }
  }, [closeMenu]);

  const handleMenubarKeyDown = useCallback((e: React.KeyboardEvent<HTMLAnchorElement>, index: number) => {
    const items = menubarRef.current?.querySelectorAll<HTMLElement>("a");
    if (!items) return;
    const count = items.length;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      items[(index + 1) % count]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      items[(index - 1 + count) % count]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[count - 1]?.focus();
    }
  }, []);

  // Desktop: keep only the most important links to avoid overcrowding
  const primaryNavLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/bazaar", label: "VXBazaar" },
    { to: "/services", label: t("nav.services") },
    { to: "/finance", label: t("nav.finance") },
    { to: "/services/ai-media-studio", label: t("nav.aiStudio") },
    { to: "/content", label: t("nav.content") },
    { to: "/games", label: t("nav.games") },
    { to: "/news", label: t("nav.news") },
  ];

  const secondaryNavLinks: { to: string; label: string }[] = [];

  const navLinks = [...primaryNavLinks, ...secondaryNavLinks];

  // Grouped structure for mobile menu with visual separators
  const mobileNavGroups = [
    {
      label: null,
      links: [
        { to: "/", label: t("nav.home") },
        { to: "/bazaar", label: "VXBazaar" },
        { to: "/services", label: t("nav.services") },
        { to: "/finance", label: t("nav.finance") },
        { to: "/services/ai-media-studio", label: t("nav.aiStudio") },
        { to: "/assistive-products", label: t("nav.assistiveProducts") },
      ],
    },
    {
      label: t("nav.explore"),
      links: [
        { to: "/content", label: t("nav.content") },
        { to: "/games", label: t("nav.games") },
        { to: "/community", label: t("nav.community") },
      ],
    },
    {
      label: t("nav.more"),
      links: [
        { to: "/professional-tools", label: t("nav.professionalTools") },
        { to: "/news", label: t("nav.news") },
        { to: "/contact-us", label: t("nav.contact") },
        { to: "/profile", label: t("nav.profile") },
      ],
    },
  ];


  return (
    <nav
      className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      role="navigation"
      aria-label={t("nav.mainNavigation")}
    >
      <div className="section-container flex items-center justify-between py-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-2xl font-bold tracking-tight rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t("nav.visionexHome")}
        >
          <img src={logo} alt="VisionEx logo" className="h-10 w-auto object-contain" width={240} height={160} />
          <span>VisionEx</span>
        </Link>

        {/* Desktop nav */}
        <div ref={menubarRef} className="hidden items-center gap-0.5 lg:flex">
          {navLinks.map((link, index) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={location.pathname === link.to ? "page" : undefined}
              className={`rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-2 xl:px-3.5 xl:text-base ${
                location.pathname === link.to
                  ? "bg-primary/10 text-primary"
                  : "text-foreground"
              }`}
              onKeyDown={(e) => handleMenubarKeyDown(e, index)}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSoundEnabled(!soundEnabled); }}
            aria-label={soundEnabled ? t("nav.muteSounds") : t("nav.unmuteSounds")}
            className="hidden xl:inline-flex"
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
          </Button>
          <ThemeToggle />
          <LanguageSwitcher />
          <CartDrawer />
          {user && <NotificationBell />}
          {user && (
            <Link to="/coins-store" className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors xl:flex">
              <Coins className="h-4 w-4" aria-hidden="true" />
              <span>{totalPoints.toLocaleString()} VX</span>
            </Link>
          )}
          {user ? (
            <>
              {isAdmin && (
                <Button asChild variant="outline" size="icon">
                  <Link to="/admin" aria-label={t("nav.adminPanel")}>
                    <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                  </Link>
                </Button>
              )}
              <Button asChild size="lg" className="text-base font-semibold">
                <Link to="/dashboard">
                  {t("nav.dashboard")}
                </Link>
              </Button>
              {/* Profile dropdown — consolidates Profile, Wishlist, Settings, Logout */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("nav.profile")}>
                    <User className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="h-4 w-4" aria-hidden="true" /> {t("nav.profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/wishlist" className="flex items-center gap-2 cursor-pointer">
                      <Heart className="h-4 w-4" aria-hidden="true" /> {t("nav.wishlist")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" aria-hidden="true" /> {t("nav.settings")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" /> {t("nav.signout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="lg" className="text-base">
                <Link to="/login">
                  {t("nav.login")}
                </Link>
              </Button>
              <Button asChild size="lg" className="text-base font-semibold">
                <Link to="/signup">
                  {t("nav.signup")}
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <ThemeToggle />
          <LanguageSwitcher />
          {user && (
            <Link to="/profile" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="icon" aria-label={t("nav.profile")}>
                <User className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Link>
          )}
          <Button
            ref={toggleRef}
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          ref={mobileMenuRef}
          id="mobile-nav"
          className="border-t bg-card px-4 pb-4 pt-2 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.mainNavigation")}
          onKeyDown={handleMobileMenuKeyDown}
        >
          {mobileNavGroups.map((group, groupIdx) => (
            <div key={groupIdx} role="none">
              {groupIdx > 0 && (
                <hr className="my-2 border-border" />
              )}
              {group.label && (
                <p className="mb-1 px-4 pt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground" aria-hidden="true">
                  {group.label}
                </p>
              )}
              {group.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={location.pathname === link.to ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-lg px-4 py-3 text-lg font-medium transition-colors hover:bg-muted ${
                    location.pathname === link.to
                      ? "bg-primary/10 text-primary"
                      : "text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="mt-3 flex flex-col gap-2">
            {user ? (
              <>
                {/* VX Balance in mobile */}
                <Link to="/coins-store" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors justify-center">
                  <Coins className="h-4 w-4" aria-hidden="true" />
                  {totalPoints.toLocaleString()} VX
                </Link>
                {isAdmin && (
                  <Button asChild variant="outline" size="lg" className="w-full text-base">
                    <Link to="/admin" onClick={() => setMenuOpen(false)}>
                      <ShieldCheck className="me-2 h-5 w-5 text-primary" aria-hidden="true" /> {t("nav.adminPanel")}
                    </Link>
                  </Button>
                )}
                <Button asChild size="lg" className="w-full text-base font-semibold">
                  <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                    {t("nav.dashboard")}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full text-base">
                  <Link to="/settings" onClick={() => setMenuOpen(false)}>
                    <Settings className="me-2 h-5 w-5" aria-hidden="true" /> {t("nav.settings")}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="w-full text-base"
                >
                  <LogOut className="me-2 h-5 w-5" aria-hidden="true" /> {t("nav.signout")}
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" size="lg" className="w-full text-base">
                  <Link to="/login" onClick={() => setMenuOpen(false)}>
                    {t("nav.login")}
                  </Link>
                </Button>
                <Button asChild size="lg" className="w-full text-base font-semibold">
                  <Link to="/signup" onClick={() => setMenuOpen(false)}>
                    {t("nav.signup")}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
