import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { NewsletterSubscribe } from "./NewsletterSubscribe";
import { AIChat } from "./AIChat";
import { CookieBanner } from "./CookieBanner";
import { TrialBanner } from "./TrialBanner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import logo from "@/assets/logo.png";

const FOOTER_LINKS = {
  pages: [
    { to: "/", labelAr: "الرئيسية",        labelEn: "Home" },
    { to: "/bazaar", labelAr: "VXBazaar", labelEn: "VXBazaar" },
    { to: "/services",    labelAr: "الخدمات", labelEn: "Services" },
    { to: "/content",     labelAr: "المحتوى", labelEn: "Content" },
    { to: "/games",       labelAr: "الألعاب", labelEn: "Games" },
    { to: "/news",        labelAr: "الأخبار", labelEn: "News" },
    { to: "/contact",     labelAr: "تواصل معنا", labelEn: "Contact" },
  ],
  more: [
    { to: "/professional-tools", labelAr: "الأدوات الاحترافية", labelEn: "Professional Tools" },
    { to: "/academy",            labelAr: "الأكاديمية",          labelEn: "Academy" },
    { to: "/community",          labelAr: "المجتمع",             labelEn: "Community" },
    { to: "/leaderboard",        labelAr: "المتصدرين",           labelEn: "Leaderboard" },
    { to: "/assistive-products", labelAr: "المنتجات المساعدة",   labelEn: "Assistive Products" },
  ],
  legal: [
    { to: "/privacy-policy",      labelAr: "سياسة الخصوصية",       labelEn: "Privacy Policy" },
    { to: "/terms-of-use",        labelAr: "شروط الاستخدام",        labelEn: "Terms of Use" },
    { to: "/community-guidelines",labelAr: "إرشادات المجتمع",       labelEn: "Community Guidelines" },
    { to: "/marketplace-policy",  labelAr: "سياسة المتجر",          labelEn: "Marketplace Policy" },
    { to: "/accessibility",       labelAr: "إمكانية الوصول",        labelEn: "Accessibility" },
    { to: "/legal-disclaimer",    labelAr: "إخلاء المسؤولية",       labelEn: "Legal Disclaimer" },
  ],
};

export function Layout({ children }: { children: ReactNode }) {
  const { t, lang } = useLanguage();
  const { pathname } = useLocation();
  const isAr = lang === "ar";
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
                {isAr ? "منصة مصممة للجميع — سهلة الوصول من البداية." : "A platform built for everyone — accessible by design."}
              </p>
            </div>

            {/* Main pages */}
            <div>
              <h3 className="text-sm font-semibold mb-3">{isAr ? "الصفحات" : "Pages"}</h3>
              <ul className="space-y-2">
                {FOOTER_LINKS.pages.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {isAr ? l.labelAr : l.labelEn}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* More */}
            <div>
              <h3 className="text-sm font-semibold mb-3">{isAr ? "المزيد" : "More"}</h3>
              <ul className="space-y-2">
                {FOOTER_LINKS.more.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {isAr ? l.labelAr : l.labelEn}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Copyright + Legal links strip */}
          <div className="mt-8 border-t pt-5">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <small className="text-sm text-muted-foreground">
                {t("footer.text").replace("{year}", new Date().getFullYear().toString())}
              </small>
              <nav aria-label={isAr ? "روابط قانونية" : "Legal links"} className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                {FOOTER_LINKS.legal.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    {isAr ? l.labelAr : l.labelEn}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </footer>

      <AIChat />
      <CookieBanner />
    </div>
  );
}
