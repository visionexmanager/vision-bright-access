import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

/** Mirrors the customer-facing projection from the sourcing layer. */
export interface AIResultItem {
  ref: string;
  title: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  specifications?: Record<string, unknown>;
  condition: "new" | "used" | "refurbished";
  availability:
    | "in_visionex"
    | "available_for_sourcing"
    | "external_recommendation"
    | "requires_sourcing_confirmation"
    | "unavailable";
  priceUsd: number | null;
  /** Shown instead of a price when only a researched range is known. */
  priceRangeUsd?: { min: number; max: number };
  currency?: string;
  /** Present only when a source's terms require naming it. */
  sourceName?: string;
}

export interface AIResultGroups {
  new: AIResultItem[];
  used: AIResultItem[];
  refurbished: AIResultItem[];
}

interface Props {
  groups: AIResultGroups;
  onSelect: (item: AIResultItem) => void;
  onCompare: () => void;
  onDetails: (item: AIResultItem) => void;
  onShowMore?: () => void;
  onFilterCondition: (condition: "new" | "used") => void;
  onBack: () => void;
  loading?: boolean;
}

const AVAILABILITY_KEYS: Record<AIResultItem["availability"], string> = {
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
 * Product and service results.
 *
 * Written so the list is fully usable by ear:
 *  - New, used and refurbished are separate <section>s with their own
 *    headings, never one interleaved list, so a second-hand listing cannot be
 *    mistaken for new stock.
 *  - Availability and condition are announced as words inside each item's
 *    accessible name. No state is carried by colour or an icon alone.
 *  - The count is announced through a live region when results arrive, and the
 *    first heading takes focus so the user lands on the results rather than
 *    being left where they were typing.
 *  - No result exposes a supplier: the projection that produced these items
 *    already removed it unless attribution is contractually required, in which
 *    case `sourceName` is present and is shown.
 */
export function AIResultList({
  groups,
  onSelect,
  onCompare,
  onDetails,
  onShowMore,
  onFilterCondition,
  onBack,
  loading = false,
}: Props) {
  const { t } = useLanguage();
  const firstHeadingRef = useRef<HTMLHeadingElement>(null);

  const total = groups.new.length + groups.used.length + groups.refurbished.length;

  useEffect(() => {
    if (!loading && total > 0) firstHeadingRef.current?.focus();
  }, [loading, total]);

  // A range answers "what does this cost" and beats "on request", so it is
  // preferred whenever a source knew one but could not quote a single price.
  const priceLabel = (item: AIResultItem) => {
    if (item.priceUsd !== null) return `${item.currency ?? "USD"} ${item.priceUsd.toFixed(2)}`;
    if (item.priceRangeUsd) {
      const { min, max } = item.priceRangeUsd;
      return `${item.currency ?? "USD"} ${min.toLocaleString()} – ${max.toLocaleString()}`;
    }
    return t("aiResults.priceOnRequest");
  };

  const renderGroup = (
    key: "new" | "used" | "refurbished",
    items: AIResultItem[],
    isFirst: boolean,
  ) => {
    if (items.length === 0) return null;
    const headingId = `ai-results-${key}`;
    return (
      <section key={key} aria-labelledby={headingId} className="mt-3 first:mt-0">
        <h4
          id={headingId}
          ref={isFirst ? firstHeadingRef : undefined}
          tabIndex={-1}
          className="mb-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t(CONDITION_KEYS[key] as Parameters<typeof t>[0])} ({items.length})
        </h4>
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => {
            const availability = t(AVAILABILITY_KEYS[item.availability] as Parameters<typeof t>[0]);
            const condition = t(CONDITION_KEYS[item.condition] as Parameters<typeof t>[0]);
            // Everything a sighted user gets from layout is packed into the
            // name a screen reader reads out.
            // The position joins the title directly — separating them with a
            // dash makes a screen reader say "one, dash, Dell". Everything
            // after is dash-separated so each fact lands as its own phrase.
            const accessibleName = [
              `${index + 1}. ${item.title}`,
              item.brand,
              item.model,
              condition,
              availability,
              priceLabel(item),
              item.sourceName,
            ]
              .filter(Boolean)
              .join(" — ");

            return (
              <li key={item.ref} className="rounded-lg border p-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">
                    <span aria-hidden="true" className="me-1 tabular-nums">{index + 1}.</span>
                    {item.title}
                  </p>
                  {(item.brand || item.model) && (
                    <p className="text-xs text-muted-foreground">
                      {[item.brand, item.model].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {/* Words, not badges: state must survive with styling off. */}
                  <p className="text-xs">
                    <span className="font-medium">{condition}</span>
                    {" · "}
                    <span>{availability}</span>
                  </p>
                  <p className="text-sm font-semibold text-primary">{priceLabel(item)}</p>
                  {item.sourceName && (
                    <p className="text-xs text-muted-foreground">{item.sourceName}</p>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" onClick={() => onSelect(item)} aria-label={`${t("aiResults.select")}: ${accessibleName}`}>
                    {t("aiResults.select")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => onDetails(item)} aria-label={`${t("aiResults.details")}: ${item.title}`}>
                    {t("aiResults.details")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    );
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      {/* Announced on arrival. aria-atomic so the whole sentence is read, not
          just the number that changed. */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {loading
          ? t("aiResults.loading")
          : t("aiResults.announce")
              .replace("{total}", String(total))
              .replace("{new}", String(groups.new.length))
              .replace("{used}", String(groups.used.length))}
      </p>

      {!loading && total === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("aiResults.empty")}</p>
      ) : (
        <>
          {renderGroup("new", groups.new, true)}
          {renderGroup("used", groups.used, groups.new.length === 0)}
          {renderGroup("refurbished", groups.refurbished, groups.new.length === 0 && groups.used.length === 0)}
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
        <Button type="button" size="sm" variant="outline" onClick={onCompare} disabled={total < 2}>
          {t("aiResults.compare")}
        </Button>
        {onShowMore && (
          <Button type="button" size="sm" variant="outline" onClick={onShowMore}>
            {t("aiResults.showMore")}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => onFilterCondition("new")}>
          {t("aiResults.onlyNew")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onFilterCondition("used")}>
          {t("aiResults.onlyUsed")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onBack}>
          {t("nav.back")}
        </Button>
      </div>
    </div>
  );
}
