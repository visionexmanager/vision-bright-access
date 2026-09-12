/**
 * The frame every Visionex Travel page sits in: the heading, the sub-navigation
 * between the three domains, and the one paragraph that says what this section
 * can actually do today.
 *
 * That paragraph is not written down. It is chosen from `readiness`, which reads
 * the same supplier registries the Edge Functions read — so the day somebody
 * integrates a supplier, the page stops promising a person and starts promising
 * a price, and nobody has to remember to edit it. See
 * `src/features/travel/readiness.ts`.
 */

import { Link, useLocation } from "react-router-dom";
import { Compass, Hotel, Car, Plane, Info } from "lucide-react";
import type { ReactNode } from "react";

import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { domainReadiness, type TravelDomain } from "@/features/travel/readiness";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/travel", labelKey: "travel.nav.overview", icon: Compass, exact: true },
  { path: "/travel/flights", labelKey: "travel.nav.flights", icon: Plane, exact: false },
  { path: "/travel/stays", labelKey: "travel.nav.stays", icon: Hotel, exact: false },
  { path: "/travel/rides", labelKey: "travel.nav.rides", icon: Car, exact: false },
] as const;

export function TravelNav() {
  const { pathname } = useLocation();
  const { t } = useLanguage();

  return (
    <nav aria-label={t("travel.nav.label")} className="flex gap-1 overflow-x-auto py-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = item.exact ? pathname === item.path : pathname.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * What this domain can do, in one sentence, derived rather than declared.
 *
 * Rendered as a plain region and not a live region: it is the same on every
 * visit and interrupting a screen reader with unchanging news is noise.
 */
export function StageNotice({ domain }: { domain: TravelDomain }) {
  const { t } = useLanguage();
  const { stage } = domainReadiness(domain);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{t(`travel.stage.${stage}.title`)}</h2>
        <p className="text-sm text-muted-foreground">{t(`travel.stage.${stage}.body`)}</p>
      </div>
    </div>
  );
}

export function TravelShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="text-muted-foreground">{lead}</p>
        </header>
        <div className="mt-6">
          <TravelNav />
        </div>
        <div className="mt-8 space-y-8">{children}</div>
      </div>
    </Layout>
  );
}
