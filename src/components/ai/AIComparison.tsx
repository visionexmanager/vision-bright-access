import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SourcedItem } from "@/lib/types";

interface Props {
  items: SourcedItem[];
  onClose: () => void;
  onSelect: (item: SourcedItem) => void;
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
 * Side-by-side comparison.
 *
 * A comparison grid is one of the easiest things to make unusable without
 * sight, so this is a real <table> with scoped row headers. A screen reader
 * then announces "Price, row header" with each cell, and the user can move
 * across a row and know what they are hearing. A div grid would lose that
 * entirely.
 */
export function AIComparison({ items, onClose, onSelect }: Props) {
  const { t } = useLanguage();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const price = (item: SourcedItem) =>
    item.priceUsd !== null
      ? `${item.currency ?? "USD"} ${item.priceUsd.toFixed(2)}`
      : item.priceRangeUsd
        ? `${item.currency ?? "USD"} ${item.priceRangeUsd.min.toLocaleString()} – ${item.priceRangeUsd.max.toLocaleString()}`
        : t("aiResults.priceOnRequest");

  const spec = (item: SourcedItem, key: string) => {
    const value = item.specifications?.[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : "—";
  };

  // Union of specification keys across the compared items, so a spec present
  // on only one still gets a row rather than silently disappearing.
  const specKeys = [...new Set(items.flatMap((item) => Object.keys(item.specifications ?? {})))].slice(0, 8);

  return (
    <section aria-labelledby="ai-comparison-heading" className="rounded-lg border bg-muted/20 p-3">
      <h4
        id="ai-comparison-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mb-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {t("aiResults.comparing").replace("{count}", String(items.length))}
      </h4>

      {/* Wide tables must scroll inside their own box, and a scrollable region
          needs to be focusable so a keyboard user can reach the overflow. */}
      <div className="overflow-x-auto" tabIndex={0} role="group" aria-labelledby="ai-comparison-heading">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <caption className="sr-only">{t("aiResults.comparisonCaption")}</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-start text-xs font-medium text-muted-foreground">
                {t("aiResults.attribute")}
              </th>
              {items.map((item) => (
                <th key={item.ref} scope="col" className="p-2 text-start font-semibold">
                  {item.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <th scope="row" className="p-2 text-start text-xs font-medium text-muted-foreground">
                {t("aiResults.price")}
              </th>
              {items.map((item) => (
                <td key={item.ref} className="p-2 font-semibold text-primary">{price(item)}</td>
              ))}
            </tr>
            <tr className="border-t">
              <th scope="row" className="p-2 text-start text-xs font-medium text-muted-foreground">
                {t("aiResults.condition")}
              </th>
              {items.map((item) => (
                <td key={item.ref} className="p-2">{t(CONDITION_KEYS[item.condition] as Parameters<typeof t>[0])}</td>
              ))}
            </tr>
            <tr className="border-t">
              <th scope="row" className="p-2 text-start text-xs font-medium text-muted-foreground">
                {t("aiResults.availability")}
              </th>
              {items.map((item) => (
                <td key={item.ref} className="p-2">
                  {t(AVAILABILITY_KEYS[item.availability] as Parameters<typeof t>[0])}
                </td>
              ))}
            </tr>
            {specKeys.map((key) => (
              <tr key={key} className="border-t">
                <th scope="row" className="p-2 text-start text-xs font-medium text-muted-foreground">{key}</th>
                {items.map((item) => (
                  <td key={item.ref} className="p-2">{spec(item, key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
        {items.map((item) => (
          <Button
            key={item.ref}
            type="button"
            size="sm"
            onClick={() => onSelect(item)}
            aria-label={`${t("aiResults.select")}: ${item.title} — ${price(item)}`}
          >
            {t("aiResults.select")}: {item.title}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          {t("nav.back")}
        </Button>
      </div>
    </section>
  );
}
