import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { NewsletterSubscribe } from "./NewsletterSubscribe";
import { AIChat } from "./AIChat";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  useMessageNotifications();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
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
        <div className="mx-auto max-w-5xl px-4">
          <NewsletterSubscribe />
          <p className="mt-8 text-center text-muted-foreground">
            {t("footer.text").replace("{year}", new Date().getFullYear().toString())}
          </p>
        </div>
      </footer>
      <AIChat />
    </div>
  );
}
