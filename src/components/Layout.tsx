import { ReactNode, useEffect, lazy, Suspense, createContext, useContext } from "react";
import { ChevronRight, Scale } from "lucide-react";

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
    { to: "/content", labelKey: "footer.link.content" },
    { to: "/games", labelKey: "footer.link.games" },
    { to: "/news", labelKey: "footer.link.news" },
    { to: "/contact", labelKey: "footer.link.contact" },
  ],
  more: [
    { to: "/professional-tools",      labelKey: "footer.link.professionalTools" },
    { to: "/community",               labelKey: "footer.link.community" },
    { to: "/leaderboard",             labelKey: "footer.link.leaderboard" },
    { to: "/assistive-products",      labelKey: "footer.link.assistiveProducts" },
    { to: "/academy",                 labelKey: "footer.link.academy" },
    { to: "/purchase-history",        labelKey: "footer.link.purchaseHistory" },
  ],
};

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const isEmbedded = useContext(EmbeddedCtx);
  useMessageNotifications();

  useEffect(() => {
    if (isEmbedded) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    document.getElementById("main-content")?.focus();
  }, [pathname, isEmbedded]);

  /* In embedded mode (inside LegalCenter Sheet) — render content only */
  if (isEmbedded) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link" aria-label={t("nav.skipToContent")}>
        {t("nav.skipToContent")}
      </a>
      <Navbar />
      <TrialBanner />
      <main id="main-content" tabIndex={-1} aria-label={t("nav.mainContent") || "Main content"} className="flex-1 animate-page-in">
        {/* Legal sub-page breadcrumb — no longer shown (pages redirect to /legal) */}
        {false && ["/privacy-policy"].includes(pathname) && (
          <div className="border-b bg-muted/30">
            <div className="section-container py-2.5">
              <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Scale className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                <Link to="/legal" className="font-medium text-primary hover:underline underline-offset-2">
                  {t("footer.link.legalCenter")}
                </Link>
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate capitalize">{pathname.replace(/^\//, "").replace(/-/g, " ")}</span>
              </nav>
            </div>
          </div>
        )}
        {children}
      </main>

      <footer className="bg-card" role="contentinfo">
        {/* Brand accent line — anchors footer visually to the product color */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden="true" />
        <div className="border-t border-border/60">
          <div className="section-container py-8">
            <NewsletterSubscribe />

            {/* Sitemap columns */}
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {/* Brand */}
              <div>
                <Link to="/" className="inline-block mb-1" aria-label="VisionEx home">
                  <img
                    src={logo}
                    alt="VisionEx logo"
                    className="h-10 w-auto object-contain"
                    width={240}
                    height={160}
                  />
                </Link>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {t("footer.brandDesc")}
                </p>
              </div>

              {/* Main pages */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("footer.pages")}</p>
                <ul className="space-y-2">
                  {FOOTER_LINKS.pages.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {t(l.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* More */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("footer.more")}</p>
                <ul className="space-y-2">
                  {FOOTER_LINKS.more.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {t(l.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar: legal + copyright in one row */}
            <div className="mt-8 border-t pt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <Link to="/legal" className="text-xs font-semibold text-primary hover:underline transition-colors">
                {t("footer.link.legalCenter")} →
              </Link>
              <small className="text-xs text-muted-foreground">
                {t("footer.text").replace("{year}", new Date().getFullYear().toString())}
              </small>
            </div>
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
