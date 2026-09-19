// Operator screen: the VX price list, and what the one ledger says it earned.
//
// English literals rather than dictionary keys, as AdminDatabase and AdminInfra
// already do for internal tooling. The i18n parity test compares locale files
// with each other, not calls with keys, so this adds no translation debt — and
// an operator screen is not a customer surface.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Coins, Loader2, ShieldAlert, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { callEdge } from "@/lib/api/edgeFunctions";

interface PricingRow {
  service_id: string;
  display_name: string;
  provider: string | null;
  base_cost: number;
  vx_price: number;
  free_limit: number;
  plan_limits: Record<string, number>;
  max_daily_usage: number | null;
  enabled: boolean;
  admin_only: boolean;
  notes: string | null;
}

interface AnalyticsRow {
  service_id: string;
  source: string;
  reservations: number;
  settled: number;
  failed: number;
  reserved_vx: number;
  consumed_vx: number;
  refunded_vx: number;
  cost_usd: number;
  avg_execution_ms: number | null;
}

const number = (value: number | null | undefined) => (value ?? 0).toLocaleString();

export default function AdminVXPricing() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, Partial<PricingRow>>>({});

  const pricing = useQuery({
    queryKey: ["vx-pricing"],
    queryFn: async () => {
      const result = await callEdge({ fn: "billing-engine", body: { action: "pricing_list" }, auth: "user-jwt" }) as
        { ok?: boolean; error?: string; data?: PricingRow[] };
      if (!result?.ok) throw new Error(result?.error ?? "The price list could not be read.");
      return result.data ?? [];
    },
  });

  const analytics = useQuery({
    queryKey: ["vx-usage-analytics"],
    queryFn: async () => {
      const result = await callEdge({ fn: "billing-engine", body: { action: "usage_analytics", days: 30 }, auth: "user-jwt" }) as
        { ok?: boolean; error?: string; data?: AnalyticsRow[] };
      if (!result?.ok) throw new Error(result?.error ?? "Usage could not be read.");
      return result.data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (service: PricingRow) => {
      // Only the fields the operator actually touched. Everything omitted is
      // left as it was — the SQL function treats null as "leave it".
      const patch = draft[service.service_id] ?? {};
      const result = await callEdge({
        fn: "billing-engine",
        body: { action: "set_pricing", service_id: service.service_id, patch },
        auth: "user-jwt",
      }) as { ok?: boolean; error?: string };
      if (!result?.ok) throw new Error(result?.error ?? "The change was refused.");
      return result;
    },
    onSuccess: (_result, service) => {
      toast.success(`${service.display_name} updated.`);
      setDraft((current) => {
        const next = { ...current };
        delete next[service.service_id];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["vx-pricing"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const edit = (id: string, patch: Partial<PricingRow>) =>
    setDraft((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const value = <K extends keyof PricingRow>(row: PricingRow, key: K): PricingRow[K] =>
    (draft[row.service_id]?.[key] ?? row[key]) as PricingRow[K];

  const dirty = (id: string) => Object.keys(draft[id] ?? {}).length > 0;

  const totals = (analytics.data ?? []).reduce(
    (sum, row) => ({
      consumed: sum.consumed + Number(row.consumed_vx),
      refunded: sum.refunded + Number(row.refunded_vx),
      cost: sum.cost + Number(row.cost_usd),
    }),
    { consumed: 0, refunded: 0, cost: 0 },
  );

  return (
    <Layout>
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-10" aria-labelledby="vx-pricing-heading">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin" aria-label="Back to admin">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-500/10">
            <Coins className="h-6 w-6 text-yellow-500" aria-hidden="true" />
          </div>
          <div>
            <h1 id="vx-pricing-heading" className="text-2xl font-bold">VX pricing and usage</h1>
            <p className="text-sm text-muted-foreground">
              The only place a VX price, a free allowance or a daily ceiling is set.
            </p>
          </div>
        </div>

        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex gap-3 p-4 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p>
              A disabled service refuses every request, which is how each one ships. Enabling one
              starts charging real VX on the next call — check the usage below first.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Services</CardTitle>
            <CardDescription>
              Cost and provider are internal. Users only ever see the VX price and the free allowance.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {pricing.isLoading && (
              <p className="p-6 text-sm text-muted-foreground">
                <Loader2 className="me-2 inline h-4 w-4 animate-spin" aria-hidden="true" />
                Loading the price list…
              </p>
            )}
            {pricing.isError && (
              <p className="p-6 text-sm text-destructive">
                The price list could not be read. It is admin-only — check your role.
              </p>
            )}
            <ul className="divide-y">
              {(pricing.data ?? []).map((row) => (
                <li key={row.service_id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-semibold">{row.display_name}</h2>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">{row.service_id}</code>
                    <Badge variant={value(row, "enabled") ? "default" : "secondary"}>
                      {value(row, "enabled") ? "Enabled" : "Disabled"}
                    </Badge>
                    {value(row, "admin_only") && <Badge variant="outline">Admins only</Badge>}
                    <span className="ms-auto text-xs text-muted-foreground" dir="ltr">
                      cost ${Number(row.base_cost).toFixed(4)}/unit
                    </span>
                  </div>

                  {row.notes && <p className="text-xs text-muted-foreground">{row.notes}</p>}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`price-${row.service_id}`}>VX price</Label>
                      <Input
                        id={`price-${row.service_id}`} type="number" min={0} dir="ltr"
                        value={String(value(row, "vx_price"))}
                        onChange={(event) => edit(row.service_id, { vx_price: Number(event.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`free-${row.service_id}`}>Free units per day</Label>
                      <Input
                        id={`free-${row.service_id}`} type="number" min={0} dir="ltr"
                        value={String(value(row, "free_limit"))}
                        onChange={(event) => edit(row.service_id, { free_limit: Number(event.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`ceiling-${row.service_id}`}>Daily ceiling</Label>
                      <Input
                        id={`ceiling-${row.service_id}`} type="number" min={1} dir="ltr"
                        placeholder="no ceiling"
                        value={value(row, "max_daily_usage") === null ? "" : String(value(row, "max_daily_usage"))}
                        onChange={(event) =>
                          edit(row.service_id, {
                            max_daily_usage: event.target.value === "" ? null : Number(event.target.value),
                          })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`enabled-${row.service_id}`}
                        checked={Boolean(value(row, "enabled"))}
                        onCheckedChange={(checked) => edit(row.service_id, { enabled: checked })}
                      />
                      <Label htmlFor={`enabled-${row.service_id}`}>Enabled</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`admin-${row.service_id}`}
                        checked={Boolean(value(row, "admin_only"))}
                        onCheckedChange={(checked) => edit(row.service_id, { admin_only: checked })}
                      />
                      <Label htmlFor={`admin-${row.service_id}`}>Admins only</Label>
                    </div>
                    <Button
                      className="ms-auto" size="sm"
                      disabled={!dirty(row.service_id) || save.isPending}
                      onClick={() => save.mutate(row)}
                    >
                      {save.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" aria-hidden="true" /> Last 30 days
            </CardTitle>
            <CardDescription>
              One ledger, every surface. {number(totals.consumed)} VX consumed,{" "}
              {number(totals.refunded)} refunded, ${totals.cost.toFixed(2)} of provider cost.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(analytics.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Nothing has been metered yet — every service is still disabled.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">VX usage by service and surface over the last 30 days</caption>
                  <thead>
                    <tr className="border-b text-start text-xs uppercase text-muted-foreground">
                      <th scope="col" className="p-3 text-start">Service</th>
                      <th scope="col" className="p-3 text-start">Source</th>
                      <th scope="col" className="p-3 text-end">Jobs</th>
                      <th scope="col" className="p-3 text-end">Failed</th>
                      <th scope="col" className="p-3 text-end">VX used</th>
                      <th scope="col" className="p-3 text-end">VX back</th>
                      <th scope="col" className="p-3 text-end">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(analytics.data ?? []).map((row) => (
                      <tr key={`${row.service_id}-${row.source}`}>
                        <th scope="row" className="p-3 text-start font-medium">{row.service_id}</th>
                        <td className="p-3">{row.source}</td>
                        <td className="p-3 text-end" dir="ltr">{number(row.reservations)}</td>
                        <td className="p-3 text-end" dir="ltr">{number(row.failed)}</td>
                        <td className="p-3 text-end" dir="ltr">{number(row.consumed_vx)}</td>
                        <td className="p-3 text-end" dir="ltr">{number(row.refunded_vx)}</td>
                        <td className="p-3 text-end" dir="ltr">${Number(row.cost_usd).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </Layout>
  );
}
