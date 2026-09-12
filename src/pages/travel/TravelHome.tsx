/**
 * Visionex Travel — what the section is, and what it can do today.
 *
 * The page leads with the honest answer rather than burying it under three
 * search boxes: nothing here sells a ticket yet, a person does the booking, and
 * the forms exist because a filled itinerary is worth more to that person than a
 * paragraph of free text. When a supplier is integrated the wording changes on
 * its own — `StageNotice` reads the registries.
 */

import { Link } from "react-router-dom";
import { ArrowRight, Car, Hotel, Plane } from "lucide-react";

import { TravelShell } from "@/components/travel/TravelShell";
import { useLanguage } from "@/contexts/LanguageContext";
import { travelReadiness } from "@/features/travel/readiness";

const CARDS = [
  { domain: "flights", to: "/travel/flights", icon: Plane },
  { domain: "stays", to: "/travel/stays", icon: Hotel },
  { domain: "rides", to: "/travel/rides", icon: Car },
] as const;

export default function TravelHome() {
  const { t } = useLanguage();
  const readiness = travelReadiness();

  return (
    <TravelShell title={t("travel.title")} lead={t("travel.subtitle")}>
      <p className="max-w-prose text-sm text-muted-foreground">{t("travel.home.lead")}</p>

      <ul className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const stage = readiness.find((row) => row.domain === card.domain)?.stage ?? "concierge";
          return (
            <li key={card.domain}>
              <Link
                to={card.to}
                className="group flex h-full flex-col gap-2 rounded-lg border border-border p-5 transition-colors hover:border-primary hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon aria-hidden="true" className="h-6 w-6 text-primary" />
                <h2 className="text-base font-semibold">{t(`travel.home.${card.domain}.title`)}</h2>
                <p className="text-sm text-muted-foreground">{t(`travel.home.${card.domain}.body`)}</p>
                <span className="mt-auto pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`travel.stage.${stage}.badge`)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="rounded-lg border border-border bg-muted/40 p-5">
        <h2 className="text-base font-semibold">{t("travel.home.conciergeTitle")}</h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          {t("travel.home.conciergeBody")}
        </p>
        <Link
          to="/services/travel-agency"
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t("travel.home.conciergeCta")}
          <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </section>
    </TravelShell>
  );
}
