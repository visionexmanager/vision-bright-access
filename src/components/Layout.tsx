import { ReactNode, useEffect, lazy, Suspense } from "react";
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
    { to: "/community/voice-rooms",   labelKey: "footer.link.voiceRooms" },
    { to: "/services/live-tv",        labelKey: "footer.link.liveTV" },
    { to: "/services/live-radio",     labelKey: "footer.link.liveRadio" },
    { to: "/leaderboard",             labelKey: "footer.link.leaderboard" },
    { to: "/assistive-products",      labelKey: "footer.link.assistiveProducts" },
    { to: "/academy",                 labelKey: "footer.link.academy" },
    { to: "/purchase-history",        labelKey: "footer.link.purchaseHistory" },
  ],
  legalCore: [
    { to: "/privacy-policy",       labelKey: "footer.link.privacyPolicy" },
    { to: "/terms-of-use",         labelKey: "footer.link.termsOfUse" },
    { to: "/community-guidelines", labelKey: "footer.link.communityGuidelines" },
    { to: "/legal-disclaimer",     labelKey: "footer.link.legalDisclaimer" },
    { to: "/accessibility",        labelKey: "footer.link.accessibility" },
  ],
  legalMarket: [
    { to: "/marketplace-policy",    labelKey: "footer.link.marketplacePolicy" },
    { to: "/buyer-protection",      labelKey: "footer.link.buyerProtection" },
    { to: "/vx-coins-policy",       labelKey: "footer.link.vxCoinsPolicy" },
    { to: "/intellectual-property", labelKey: "footer.link.intellectualProperty" },
  ],
  legalPlatform: [
    { to: "/ai-policy",           labelKey: "footer.link.aiPolicy" },
    { to: "/enforcement-appeals", labelKey: "footer.link.enforcementAppeals" },
  ],
};

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  useMessageNotifications();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    document.getElementById("main-content")?.focus();
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link" aria-label={t("nav.skipToContent")}>
        {t("nav.skipToContent")}
      </a>
      <Navbar />
      <TrialBanner />
      <main id="main-content" tabIndex={-1} aria-label={t("nav.mainContent") || "Main content"} className="flex-1 animate-page-in">
        {children}
      </main>

      <footer className="border-t bg-card" role="contentinfo">
        <div className="section-container py-8">
          <NewsletterSubscribe />

          {/* Sitemap columns: 3 columns (Brand + Pages + More) */}
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {/* Brand */}
            <div>
              <img
                src={logo}
                alt="VisionEx logo"
                className="h-9 w-auto object-contain mb-3"
                width={240}
                height={160}
              />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("footer.brandDesc")}
              </p>
            </div>

            {/* Main pages */}
            <div>
              <h3 className="text-sm font-semibold mb-3">{t("footer.pages")}</h3>
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
              <h3 className="text-sm font-semibold mb-3">{t("footer.more")}</h3>
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

          {/* Legal Policy Groups */}
          <div className="mt-8 border-t pt-6">
            <div className="grid gap-6 sm:grid-cols-3">
              {/* Legal Core */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("footer.legal")}
                </p>
                <ul className="space-y-1.5">
                  {FOOTER_LINKS.legalCore.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {t(l.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Marketplace */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("footer.marketplace")}
                </p>
                <ul className="space-y-1.5">
                  {FOOTER_LINKS.legalMarket.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {t(l.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Platform Governance */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("footer.platform")}
                </p>
                <ul className="space-y-1.5">
                  {FOOTER_LINKS.legalPlatform.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {t(l.labelKey)}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link to="/legal" className="text-xs font-semibold text-primary hover:underline transition-colors">
                      {t("footer.link.legalCenter")} →
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Copyright strip */}
          <div className="mt-6 border-t pt-4">
            <small className="block text-center text-xs text-muted-foreground">
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
