import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Menu, X, Zap, Heart, User, ShieldCheck, Coins } from "lucide-react";
import { useState } from "react";
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

  const navLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/marketplace", label: t("nav.marketplace") },
    { to: "/services", label: t("nav.services") },
    { to: "/content", label: t("nav.content") },
    { to: "/games", label: t("nav.games") },
    { to: "/assistive-products", label: t("nav.assistiveProducts") },
    { to: "/contact", label: t("nav.contact") },
    { to: "/community", label: t("nav.community") },
    { to: "/news", label: t("nav.news") },
  ];

  return (
    <nav
      className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-2xl font-bold tracking-tight"
          aria-label="Visionex home"
        >
          <Zap className="h-7 w-7 text-primary" aria-hidden="true" />
          <span>Visionex</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex" role="menubar">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              role="menuitem"
              className={`rounded-lg px-4 py-2 text-base font-medium transition-colors hover:bg-muted focus-visible:ring-2 ${
                location.pathname === link.to
                  ? "bg-primary/10 text-primary"
                  : "text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <LanguageSwitcher />
          <CartDrawer />
          {user && <NotificationBell />}
          {user && (
            <>
              <Link to="/wishlist">
                <Button variant="ghost" size="icon" aria-label={t("nav.wishlist")}>
                  <Heart className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="icon" aria-label={t("nav.profile")}>
                  <User className="h-5 w-5" />
                </Button>
              </Link>
            </>
          )}
          {user ? (
            <>
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="outline" size="icon" aria-label="Admin Panel">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </Button>
                </Link>
              )}
              <Link to="/dashboard">
                <Button size="lg" className="text-base font-semibold">
                  {t("nav.dashboard")}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                aria-label={t("nav.signout")}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="outline" size="lg" className="text-base">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="lg" className="text-base font-semibold">
                  {t("nav.signup")}
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t bg-card px-4 pb-4 pt-2 md:hidden" role="menu">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              role="menuitem"
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
          <div className="mt-3 flex flex-col gap-2">
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMenuOpen(false)}>
                    <Button variant="outline" size="lg" className="w-full text-base">
                      <ShieldCheck className="me-2 h-5 w-5 text-primary" /> Admin Panel
                    </Button>
                  </Link>
                )}
                <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                  <Button size="lg" className="w-full text-base font-semibold">
                    {t("nav.dashboard")}
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="w-full text-base"
                >
                  <LogOut className="me-2 h-5 w-5" /> {t("nav.signout")}
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)}>
                  <Button variant="outline" size="lg" className="w-full text-base">
                    {t("nav.login")}
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setMenuOpen(false)}>
                  <Button size="lg" className="w-full text-base font-semibold">
                    {t("nav.signup")}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
