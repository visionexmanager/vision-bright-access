import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useSound } from "@/contexts/SoundContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Menu, X, Heart, User, ShieldCheck, Coins, MessageCircle, Settings, Volume2, VolumeX, ChevronDown } from "lucide-react";
import logo from "@/assets/logo.png";
import { useUnreadCount } from "@/hooks/useMessages";
import { usePoints } from "@/hooks/usePoints";
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
  const unreadMessages = useUnreadCount();
  const { enabled: soundEnabled, setEnabled: setSoundEnabled, playSound } = useSound();
  const { totalPoints } = usePoints();

  const primaryNavLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/marketplace", label: t("nav.marketplace") },
    { to: "/services", label: t("nav.services") },
    { to: "/assistive-products", label: t("nav.assistiveProducts") },
    { to: "/content", label: t("nav.content") },
    { to: "/games", label: t("nav.games") },
  ];

  const secondaryNavLinks = [
    { to: "/community", label: t("nav.community") },
    { to: "/professional-tools", label: "Professional Tools" },
    { to: "/news", label: t("nav.news") },
    { to: "/contact", label: t("nav.contact") },
  ];

  // Grouped structure for mobile menu with visual separators
  const mobileNavGroups = [
    {
      label: null,
      links: [
        { to: "/", label: t("nav.home") },
        { to: "/marketplace", label: t("nav.marketplace") },
        { to: "/services", label: t("nav.services") },
        { to: "/assistive-products", label: t("nav.assistiveProducts") },
      ],
    },
    {
      label: t("nav.explore") || "Explore",
      links: [
        { to: "/content", label: t("nav.content") },
        { to: "/games", label: t("nav.games") },
        { to: "/community", label: t("nav.community") },
      ],
    },
    {
      label: t("nav.more") || "More",
      links: [
        { to: "/professional-tools", label: "Professional Tools" },
        { to: "/news", label: t("nav.news") },
        { to: "/contact", label: t("nav.contact") },
      ],
    },
  ];

  return (
    <nav
      className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="section-container flex items-center justify-between py-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-2xl font-bold tracking-tight rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="VisionEx home"
        >
          <img src={logo} alt="VisionEx logo" className="h-10 w-auto object-contain" width={240} height={160} />
          <span>VisionEx</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0.5 lg:flex" role="menubar">
          {primaryNavLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              role="menuitem"
              className={`rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-2 xl:px-3.5 xl:text-base ${
                location.pathname === link.to
                  ? "bg-primary/10 text-primary"
                  : "text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-lg px-2.5 py-2 text-sm font-medium xl:px-3.5 xl:text-base gap-1 ${
                  secondaryNavLinks.some((l) => location.pathname === l.to)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground"
                }`}
              >
                {t("nav.more") || "More"}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {secondaryNavLinks.map((link) => (
                <DropdownMenuItem key={link.to} asChild>
                  <Link
                    to={link.to}
                    className={`w-full cursor-pointer ${
                      location.pathname === link.to ? "text-primary font-medium" : ""
                    }`}
                  >
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSoundEnabled(!soundEnabled); }}
            aria-label={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            className="hidden xl:inline-flex"
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
          </Button>
          <ThemeToggle />
          <LanguageSwitcher />
          <CartDrawer />
          {user && <NotificationBell />}
          {user && (
            <Link to="/coins-store" className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors xl:flex">
              <Coins className="h-4 w-4" />
              <span>{totalPoints.toLocaleString()} VX</span>
            </Link>
          )}
          {user && (
            <>
              <Link to="/messages">
                <Button variant="ghost" size="icon" className="relative" aria-label={t("msg.title")}>
                  <MessageCircle className="h-5 w-5" />
                  {unreadMessages > 0 && (
                    <Badge variant="destructive" className="absolute -end-1 -top-1 h-5 min-w-[1.25rem] px-1 text-[10px]">
                      {unreadMessages}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link to="/wishlist" className="hidden xl:inline-flex">
                <Button variant="ghost" size="icon" aria-label={t("nav.wishlist")}>
                  <Heart className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="icon" aria-label={t("nav.profile")}>
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/settings" className="hidden xl:inline-flex">
                <Button variant="ghost" size="icon" aria-label={t("nav.settings")}>
                  <Settings className="h-5 w-5" />
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
        <div className="flex items-center gap-2 lg:hidden">
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
        <div className="border-t bg-card px-4 pb-4 pt-2 lg:hidden" role="menu">
          {mobileNavGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              {groupIdx > 0 && (
                <div className="my-2 border-t border-border" />
              )}
              {group.label && (
                <p className="mb-1 px-4 pt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
              )}
              {group.links.map((link) => (
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
            </div>
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
                <Link to="/settings" onClick={() => setMenuOpen(false)}>
                  <Button variant="outline" size="lg" className="w-full text-base">
                    <Settings className="me-2 h-5 w-5" /> {t("nav.settings")}
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
