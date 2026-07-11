import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NetworkProvider, useNetwork } from "@/contexts/NetworkContext";
import { NetworkSidebar } from "./NetworkSidebar";
import { NetworkTopBar } from "./NetworkTopBar";
import "./NetworkTokens.css";

function NetworkShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { accessibility } = useNetwork();

  return (
    <div
      data-network
      data-high-contrast={accessibility.highContrast}
      data-large-text={accessibility.largeText}
      data-reduced-motion={accessibility.reducedMotion}
      className="flex h-screen flex-col overflow-hidden bg-background"
    >
      <a
        href="#network-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t("networkUI.skipToContent")}
      </a>

      <NetworkTopBar />

      <div className="flex flex-1 overflow-hidden">
        <NetworkSidebar />
        <main id="network-main" tabIndex={-1} role="main" className="flex-1 overflow-y-auto p-4 focus:outline-none sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function NetworkLayout({ children }: { children: ReactNode }) {
  return (
    <NetworkProvider>
      <NetworkShell>{children}</NetworkShell>
    </NetworkProvider>
  );
}
