import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SourcedItem } from "@/lib/types";

interface Props {
  item: SourcedItem;
  onRequestSourcing: (item: SourcedItem) => void;
  onBack: () => void;
  requesting?: boolean;
}

const AVAILABILITY_KEYS: Record<SourcedItem["availability"], string> = {
  in_visionex: "aiResults.availableInVisionex",
  available_for_sourcing: "aiResults.availableForSourcing",
  external_recommendation: "aiResults.externalRecommendation",
  requires_sourcing_confirmation: "aiResults.requiresConfirmation",
  unavailable: "aiResults.unavailable",
};

const CONDITION_KEYS = {
  new: "aiResults.conditionNew",
  used: "aiResults.conditionUsed",
  refurbished: "aiResults.conditionRefurbished",
} as const;

/**
 * One product, in full.
 *
 * The action offered depends on what Visionex can honestly do. Only an item
 * already in the catalogue gets a direct next step; anything sourced offers
 * "request sourcing", which starts a human confirmation rather than pretending
 * an order was placed. There is no order system behind the main catalogue, so
 * no order number and no shipment state appear anywhere here.
 */
export function AIResultDetail({ item, onRequestSourcing, onBack, requesting = false }: Props) {
  const { t } = useLanguage();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headingRef.current?.focus(); }, [item.ref]);

  const price = item.priceUsd === null
    ? t("aiResults.priceOnRequest")
    : `${item.currency ?? "USD"} ${item.priceUsd.toFixed(2)}`;

  const specs = Object.entries(item.specifications ?? {}).filter(
    ([, value]) => typeof value === "string" || typeof value === "number",
  );

  const canRequest = item.availability !== "unavailable";

  return (
    <section aria-labelledby="ai-detail-heading" className="rounded-lg border bg-muted/20 p-3">
      <h4
        id="ai-detail-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mb-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {item.title}
      </h4>

      <dl className="grid gap-1 text-sm">
        {item.brand && (
          <div><dt className="inline font-medium">{t("aiResults.brand")}: </dt><dd className="inline">{item.brand}</dd></div>
        )}
        {item.model && (
          <div><dt className="inline font-medium">{t("aiResults.model")}: </dt><dd className="inline">{item.model}</dd></div>
        )}
        <div>
          <dt className="inline font-medium">{t("aiResults.condition")}: </dt>
          <dd className="inline">{t(CONDITION_KEYS[item.condition] as Parameters<typeof t>[0])}</dd>
        </div>
        <div>
          <dt className="inline font-medium">{t("aiResults.availability")}: </dt>
          <dd className="inline">{t(AVAILABILITY_KEYS[item.availability] as Parameters<typeof t>[0])}</dd>
        </div>
        <div>
          <dt className="inline font-medium">{t("aiResults.price")}: </dt>
          <dd className="inline font-semibold text-primary">{price}</dd>
        </div>
        {/* Present only when a source's agreement requires naming it. */}
        {item.sourceName && (
          <div><dt className="inline font-medium">{t("aiResults.providedBy")}: </dt><dd className="inline">{item.sourceName}</dd></div>
        )}
        {specs.length > 0 && (
          <div className="mt-1">
            <dt className="font-medium">{t("aiResults.specifications")}</dt>
            <dd>
              <ul className="ms-4 list-disc">
                {specs.map(([key, value]) => <li key={key}>{key}: {String(value)}</li>)}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      {/* Said plainly, before the button, so nobody reads "request" as "buy". */}
      {item.availability !== "in_visionex" && (
        <p className="mt-2 rounded bg-muted p-2 text-xs">{t("aiResults.sourcingNote")}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
        {canRequest && (
          <Button
            type="button"
            size="sm"
            disabled={requesting}
            onClick={() => onRequestSourcing(item)}
            aria-label={`${t("aiResults.requestSourcing")}: ${item.title}`}
          >
            {requesting ? t("aiResults.requesting") : t("aiResults.requestSourcing")}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onBack}>{t("nav.back")}</Button>
      </div>
    </section>
  );
}
