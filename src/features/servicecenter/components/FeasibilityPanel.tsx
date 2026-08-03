import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Info, TrendingUp } from "lucide-react";
import {
  FEASIBILITY_DISCLAIMER,
  RISK_BAND_CLASS,
  RISK_BAND_LABEL,
  calculateFeasibility,
  formatUsd,
} from "../feasibility";
import { pick, pickList } from "./localized";
import type { FeasibilityInput } from "../types";

/**
 * The automatic feasibility study. Every figure is labelled as an estimate,
 * because presenting a modelled payback period as a forecast is how people
 * lose money.
 */
export function FeasibilityPanel({ input }: { input: FeasibilityInput }) {
  const { t, lang } = useLanguage();
  const result = useMemo(() => calculateFeasibility(input), [input]);

  const stats: { label: string; value: string; hint?: string }[] = [
    {
      label: t("sc.feas.cashNeeded"),
      value: formatUsd(result.cashNeededUsd),
      hint: t("sc.feas.cashNeededHint"),
    },
    {
      label: t("sc.feas.monthlyProfit"),
      value: formatUsd(result.monthlyProfitUsd),
      hint: t("sc.feas.marginHint").replace("{n}", String(result.marginPercent)),
    },
    {
      label: t("sc.feas.breakEven"),
      value: formatUsd(result.breakEvenRevenueUsd),
      hint: t("sc.feas.breakEvenHint"),
    },
    {
      label: t("sc.feas.payback"),
      value:
        result.paybackMonths === null
          ? t("sc.feas.neverRepays")
          : t("sc.feas.months").replace("{n}", String(result.paybackMonths)),
      hint: t("sc.feas.paybackHint"),
    },
    {
      label: t("sc.feas.safetyMargin"),
      value: `${result.safetyMarginPercent}%`,
      hint: t("sc.feas.safetyMarginHint"),
    },
    {
      label: t("sc.feas.firstYear"),
      value: formatUsd(result.firstYearNetUsd),
      hint: t("sc.feas.firstYearHint"),
    },
  ];

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400" aria-hidden="true">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground">{t("sc.feas.title")}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{t("sc.feas.subtitle")}</p>
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${RISK_BAND_CLASS[result.riskBand]}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {pick(RISK_BAND_LABEL[result.riskBand], lang)}
          </span>
        </div>

        {/* Estimate disclaimer sits above the numbers, not buried under them. */}
        <p
          role="note"
          className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-foreground"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          {pick(FEASIBILITY_DISCLAIMER, lang)}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border p-3">
              <dt className="text-xs font-medium text-muted-foreground">{stat.label}</dt>
              <dd className="mt-1 text-lg font-bold text-foreground">{stat.value}</dd>
              {stat.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{stat.hint}</p>}
            </div>
          ))}
        </dl>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("sc.feas.revenueModel")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{pick(input.revenueModel, lang)}</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("sc.feas.startupCost")}</dt>
                <dd className="font-semibold text-foreground">{formatUsd(input.startupCostUsd)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("sc.feas.monthlyCost")}</dt>
                <dd className="font-semibold text-foreground">{formatUsd(input.monthlyCostUsd)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("sc.feas.monthlyRevenue")}</dt>
                <dd className="font-semibold text-foreground">
                  {formatUsd(input.monthlyRevenueUsd)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("sc.feas.rampUp")}</dt>
                <dd className="font-semibold text-foreground">
                  {t("sc.feas.months").replace("{n}", String(input.rampUpMonths))}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("sc.feas.risks")}</h3>
            <ul className="mt-2 space-y-2">
              {pickList(input.risks, lang).map((risk) => (
                <li key={risk} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                    aria-hidden="true"
                  />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
