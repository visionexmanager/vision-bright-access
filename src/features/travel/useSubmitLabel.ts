/**
 * The verb on the submit button.
 *
 * "Search" is a promise of a list of fares. While no supplier can answer, the
 * button says what actually happens instead — a person reads the request and
 * comes back to you. Derived from the registries rather than written down, so
 * the day a supplier goes live the wording changes without an edit.
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { domainReadiness, type TravelDomain } from "@/features/travel/readiness";

export function useSubmitLabel(domain: TravelDomain): string {
  const { t } = useLanguage();
  return domainReadiness(domain).sellable
    ? t("travel.form.submitSearch")
    : t("travel.form.submitRequest");
}
