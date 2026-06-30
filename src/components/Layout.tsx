import { ReactNode, useEffect, lazy, Suspense, createContext, useContext, useState } from "react";

/* ── Embedded mode — suppresses Navbar/Footer when rendering inside a Sheet ── */
const EmbeddedCtx = createContext(false);
export const EmbeddedLayout = ({ children }: { children: ReactNode }) => (
  <EmbeddedCtx.Provider value={true}>{children}</EmbeddedCtx.Provider>
);
import { Link, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { NewsletterSubscribe } from "./NewsletterSubscribe";
import { CookieBanner } from "./CookieBanner";
import { TrialBanner } from "./TrialBanner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import logo from "@/assets/logo.png";

// Lazy-load the AI chat widget — it's a floating button that users open on demand.
// This keeps the Layout chunk lean and defers the react-markdown + voice-chat weight.
const AIChat = lazy(() => import("./AIChat").then((m) => ({ default: m.AIChat })));

const FOOTER_LINKS = {
  pages: [
    { to: "/", labelKey: "footer.link.home" },
    { to: "/bazaar", labelKey: "footer.link.bazaar" },
    { to: "/services", labelKey: "footer.link.services" },
    { to: "/finance", labelKey: "footer.link.finance" },
    { to: "/services/ai-media-studio", labelKey: "footer.link.aiStudio" },
    { to: "/content", labelKey: "footer.link.content" },
    { to: "/games", labelKey: "footer.link.games" },
    { to: "/news", labelKey: "footer.link.news" },
    { to: "/contact-us", labelKey: "footer.link.contact" },
  ],
  more: [
    { to: "/professional-tools",      labelKey: "footer.link.professionalTools" },
    { to: "/services/file-studio",    labelKey: "footer.link.fileConverter" },
    { to: "/community",               labelKey: "footer.link.community" },
    { to: "/leaderboard",             labelKey: "footer.link.leaderboard" },
    { to: "/assistive-products",      labelKey: "footer.link.assistiveProducts" },
    { to: "/academy",                 labelKey: "footer.link.academy" },
  ],
};

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const isEmbedded = useContext(EmbeddedCtx);
  const [routeAnnouncement, setRouteAnnouncement] = useState("");
  useMessageNotifications();

  useEffect(() => {
    if (isEmbedded) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    document.getElementById("main-content")?.focus();
    setRouteAnnouncement(`${t("nav.mainContent") || "Main content"}: ${document.title}`);
  }, [pathname, isEmbedded]);

  /* In embedded mode (inside LegalCenter Sheet) — render content only */
  if (isEmbedded) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link" aria-label={t("nav.skipToContent")}>
        {t("nav.skipToContent")}
      </a>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {routeAnnouncement}
      </div>
      <Navbar />
      <TrialBanner />
      <main id="main-content" tabIndex={-1} aria-label={t("nav.mainContent") || "Main content"} className="flex-1 animate-page-in">
        {children}
      </main>

      <footer className="bg-card" role="contentinfo">
        {/* Top gradient bar — strong brand anchor */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" aria-hidden="true" />

        <div className="section-container py-12">
          <NewsletterSubscribe />

          {/* Sitemap columns */}
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {/* Brand */}
            <div className="sm:col-span-1">
              <Link to="/" className="inline-block mb-3" aria-label="VisionEx home">
                <img
                  src={logo}
                  alt="VisionEx logo"
                  className="h-11 w-auto object-contain"
                  width={240}
                  height={160}
                />
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[22ch]">
                {t("footer.brandDesc")}
              </p>
            </div>

            {/* Main pages */}
            <nav aria-labelledby="footer-pages-heading">
              <h2 id="footer-pages-heading" className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/50">{t("footer.pages")}</h2>
              <ul className="space-y-2.5">
                {FOOTER_LINKS.pages.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground hover:translate-x-0.5 transition-all inline-block">
                      {t(l.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* More */}
            <nav aria-labelledby="footer-more-heading">
              <h2 id="footer-more-heading" className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/50">{t("footer.more")}</h2>
              <ul className="space-y-2.5">
                {FOOTER_LINKS.more.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground hover:translate-x-0.5 transition-all inline-block">
                      {t(l.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 border-t border-border/40 pt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <Link to="/legal" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              {t("footer.link.legalCenter")} →
            </Link>
            <small className="text-xs text-muted-foreground/70">
              {t("footer.text").replace("{year}", new Date().getFullYear().toString())}
            </small>
          </div>
        </div>
      </footer>

      <Suspense fallback={null}>
        <AIChat />
      </Suspense>
      <CookieBanner />
    </div>
  );
}
