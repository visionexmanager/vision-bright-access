import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { useLanguage } from "@/contexts/LanguageContext";

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        {t("nav.skipToContent")}
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="border-t bg-card py-8 text-center" role="contentinfo">
        <p className="text-muted-foreground">
          {t("footer.text").replace("{year}", new Date().getFullYear().toString())}
        </p>
      </footer>
    </div>
  );
}
