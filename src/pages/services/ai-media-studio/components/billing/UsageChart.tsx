// What this account has spent, from the one ledger.
//
// It used to read `usage_logs` and price each row from a `VX_COSTS` map in the
// browser. `usage_logs` has never had a row in it — `billing_consume` was
// never called — so the screen showed everyone the same empty chart, and the
// price map was a second copy of numbers that now live in
// `central_pricing_registry`. Both are gone: the amounts come from
// `my_vx_usage()`, which reports what was actually reserved, consumed and
// returned.
//
// `my_vx_usage()` rather than the table, because `vx_usage_ledger` also carries
// `provider` and `actual_cost_usd`. Which vendor served a request, and what it
// cost Visionex, is not on a customer's statement.

import { useMemo } from "react";

import { useMyVxSummary, useMyVxUsage } from "@/hooks/useCredits";
import type { VxSummary, VxUsageRow, VxUsageStatus } from "@/lib/types/billing";
import { cn } from "@/lib/utils";

const STATUS: Record<VxUsageStatus, { label: string; tone: string }> = {
  settled:  { label: "Completed", tone: "text-emerald-500" },
  reserved: { label: "In progress", tone: "text-amber-500" },
  refunded: { label: "Refunded", tone: "text-blue-500" },
  failed:   { label: "Failed — VX returned", tone: "text-muted-foreground" },
  expired:  { label: "Timed out — VX returned", tone: "text-muted-foreground" },
};

const SOURCE: Record<string, string> = {
  website: "Website",
  whatsapp: "WhatsApp",
  api: "API",
  system: "Automatic",
};

function StatCard({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/**
 * The balance, the plan and what the period has cost.
 *
 * Rendered as a description list rather than a grid of divs so a screen reader
 * reads "VX balance, 6,123" as a pair instead of two loose numbers, and every
 * figure carries its unit in the text — nothing here is communicated by colour
 * or position alone.
 */
function PlanSummary({ summary }: { summary: VxSummary }) {
  const { plan, balance_vx, today, month } = summary;
  const allowance = plan.monthly_vx;
  const remaining = allowance === null ? null : Math.max(0, allowance - month.consumed_vx);

  return (
    <section aria-labelledby="vx-plan-heading" className="rounded-xl border border-border bg-card p-4">
      <h3 id="vx-plan-heading" className="text-xs font-medium text-muted-foreground">
        Your plan
      </h3>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Plan</dt>
          <dd className="mt-0.5 text-lg font-bold">
            {plan.name}
            {plan.is_trial && plan.trial_ends_at && (
              <span className="ms-2 align-middle text-xs font-normal text-muted-foreground">
                free week — ends{" "}
                <time dateTime={plan.trial_ends_at}>
                  {new Date(plan.trial_ends_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </time>
              </span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">VX balance</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums" dir="ltr">
            {balance_vx.toLocaleString()} VX
          </dd>
        </div>

        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Monthly allowance
          </dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums" dir="ltr">
            {allowance === null ? (
              <span className="text-base font-medium text-muted-foreground">
                None on this plan
              </span>
            ) : (
              `${allowance.toLocaleString()} VX`
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Remaining this month
          </dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums" dir="ltr">
            {remaining === null ? (
              <span className="text-base font-medium text-muted-foreground">Not metered</span>
            ) : (
              `${remaining.toLocaleString()} VX`
            )}
          </dd>
        </div>
      </dl>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Today</dt>
          <dd className="tabular-nums" dir="ltr">
            {today.consumed_vx.toLocaleString()} VX · {today.requests.toLocaleString()} requests
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">This month</dt>
          <dd className="tabular-nums" dir="ltr">
            {month.consumed_vx.toLocaleString()} VX · {month.requests.toLocaleString()} requests
          </dd>
        </div>
      </dl>

      {plan.whatsapp_daily !== null && (
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          {plan.whatsapp_daily === 0
            ? "WhatsApp assistant: no daily limit on this plan."
            : `WhatsApp assistant: up to ${plan.whatsapp_daily.toLocaleString()} requests a day.`}
        </p>
      )}
    </section>
  );
}

export function UsageChart() {
  const { data: rows = [], isLoading, isError, error } = useMyVxUsage({ limit: 200 });
  const { data: planSummary } = useMyVxSummary();

  const summary = useMemo(() => {
    const spent = rows.reduce((total, row) => total + row.consumed_vx, 0);
    const returned = rows.reduce((total, row) => total + row.refunded_vx, 0);
    // Only an open reservation is still holding anything — a settled row's
    // hold has already been split into consumed and refunded.
    const held = rows.filter((r) => r.status === "reserved")
      .reduce((total, row) => total + row.reserved_vx, 0);

    const byService = new Map<string, { name: string; vx: number; requests: number }>();
    for (const row of rows) {
      const entry = byService.get(row.service_id) ?? { name: row.display_name, vx: 0, requests: 0 };
      entry.vx += row.consumed_vx;
      entry.requests += 1;
      byService.set(row.service_id, entry);
    }

    return {
      spent,
      returned,
      held,
      requests: rows.length,
      services: [...byService.values()].sort((a, b) => b.vx - a.vx),
      // Shown only when there is more than one, because "Website" on every row
      // of a website-only account is noise.
      showSource: new Set(rows.map((r) => r.source)).size > 1,
    };
  }, [rows]);

  if (isLoading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <p className="sr-only">Loading your usage…</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-xl bg-muted" />)}
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <p className="font-medium">Your usage could not be loaded.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please try again in a moment."}
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        {planSummary?.ok && <PlanSummary summary={planSummary} />}
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="font-medium">No VX spent yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            When you use a service that costs VX, it appears here — what it was, when, what it
            cost, and anything that came back.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {planSummary?.ok && <PlanSummary summary={planSummary} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="VX spent" value={summary.spent.toLocaleString()} sub="across all requests" tone="text-amber-500" />
        <StatCard label="VX returned" value={summary.returned.toLocaleString()}
          sub="from unused or failed work" tone={summary.returned > 0 ? "text-blue-500" : undefined} />
        <StatCard label="Requests" value={summary.requests.toLocaleString()} sub="most recent 200" />
        <StatCard label="Currently held" value={summary.held.toLocaleString()}
          sub={summary.held > 0 ? "for work in progress" : "nothing in progress"} />
      </div>

      {summary.services.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">By service</h3>
          <ul className="space-y-2">
            {summary.services.map((service) => (
              <li key={service.name} className="flex items-baseline justify-between gap-4 text-sm">
                <span>{service.name}</span>
                <span className="text-muted-foreground tabular-nums" dir="ltr">
                  {service.requests} × · {service.vx.toLocaleString()} VX
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <h3 className="border-b p-4 text-xs font-medium text-muted-foreground">Recent activity</h3>
        <ul className="divide-y">
          {rows.slice(0, 50).map((row: VxUsageRow) => {
            const status = STATUS[row.status] ?? { label: row.status, tone: "" };
            return (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{row.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={row.created_at}>
                      {new Date(row.created_at).toLocaleString(undefined, {
                        dateStyle: "medium", timeStyle: "short",
                      })}
                    </time>
                    {summary.showSource && <> · {SOURCE[row.source] ?? row.source}</>}
                  </p>
                </div>
                <div className="text-end">
                  <p className="tabular-nums" dir="ltr">
                    {row.consumed_vx > 0 ? `${row.consumed_vx.toLocaleString()} VX` : "Free"}
                    {row.refunded_vx > 0 && (
                      <span className="text-blue-500"> · {row.refunded_vx.toLocaleString()} returned</span>
                    )}
                  </p>
                  <p className={cn("text-xs", status.tone)}>{status.label}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
