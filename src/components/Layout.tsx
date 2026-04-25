import { ReactNode, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Navbar } from "./Navbar";
import { NewsletterSubscribe } from "./NewsletterSubscribe";
import { AIChat } from "./AIChat";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  useMessageNotifications();

  // Scroll to top and move focus to main content on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    document.getElementById("main-content")?.focus();
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">
        {t("nav.skipToContent")}
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 animate-page-in">
        {children}
      </main>
      <footer className="border-t bg-card py-10" role="contentinfo">
        <div className="section-container">
          <NewsletterSubscribe />
          <nav aria-label="Legal links" className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-use" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Use</Link>
            <Link to="/marketplace-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Marketplace Policy</Link>
            <Link to="/community-guidelines" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Community Guidelines</Link>
            <Link to="/accessibility" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Accessibility</Link>
            <Link to="/legal-disclaimer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Legal Disclaimer</Link>
          </nav>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("footer.text").replace("{year}", new Date().getFullYear().toString())}
          </p>
        </div>
      </footer>
      <AIChat />
    </div>
  );
}
