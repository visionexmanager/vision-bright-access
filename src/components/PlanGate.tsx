// One gate, at the top of the router, instead of a guard on four hundred routes.
//
// `sectionForPath` decides which section the current route belongs to, and a
// route that belongs to none — the home page, the dashboard, settings, the
// legal centre, the pricing page itself — passes straight through. That is the
// safe direction for the default to point: a section nobody remembered to list
// stays open rather than silently closing.
//
// Signed-out visitors are not gated at all. Everything they can reach today is
// already public, and turning the public surface into a wall would be a
// different product decision than "the free week ends after seven days".

import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import {
  PRICING_PATH,
  TIERS,
  cheapestTierFor,
  sectionDef,
  sectionForPath,
  type SectionKey,
} from "@/lib/billing/plans";

function UpgradeNotice({ section }: { section: SectionKey }) {
  const { t, dir } = useLanguage();
  const tier = cheapestTierFor(section);
  const sectionName = t(sectionDef(section).labelKey);
  const tierName = tier ? t(`plans.tier.${tier}`) : "";
  const price = tier ? TIERS[tier].price : 0;

  const body = t("planGate.body")
    .replace("{section}", sectionName)
    .replace("{plan}", tierName)
    .replace("{price}", String(price));

  return (
    <Layout>
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center" dir={dir}>
      {/* The heading is what a screen reader lands on, so it names the section
          rather than saying "access denied" — somebody who followed a link
          needs to know which door this is. */}
      <Lock className="mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-2xl font-black">{t("planGate.title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("planGate.trialOver")}</p>
      <p className="mt-2 font-semibold">{body}</p>

      <Link
        to={PRICING_PATH}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t("planGate.seePlans")}
      </Link>

      <p className="mt-6 text-sm text-muted-foreground">{t("planGate.stillFree")}</p>
    </main>
    </Layout>
  );
}

export function PlanGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const { has } = usePlanAccess();

  const section = sectionForPath(location.pathname);
  if (!section || !user || has(section)) return <>{children}</>;

  return <UpgradeNotice section={section} />;
}
