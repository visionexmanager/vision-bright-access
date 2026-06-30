import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, BarChart2, Receipt, Package, Zap } from "lucide-react";
import { WalletCard } from "./components/billing/WalletCard";
import { UsageChart } from "./components/billing/UsageChart";
import { TransactionHistory } from "./components/billing/TransactionHistory";
import { PlanCard } from "./components/billing/PlanCard";
import { UpgradeDialog } from "./components/billing/UpgradeDialog";
import { useBillingStatus, useBillingInit, useSubscriptionMutations } from "@/hooks/useBilling";
import { usePlans } from "@/hooks/usePlans";
import { PLAN_BADGE_COLORS } from "@/lib/types/billing";
import type { PlanId } from "@/lib/types/billing";

export default function Billing() {
  useBillingInit();

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeTab,  setUpgradeTab]  = useState<"plans" | "credits">("plans");
  const { data: billingStatus, isLoading } = useBillingStatus();
  const { data: plans = [] }               = usePlans();
  const { upgrade, cancel }                = useSubscriptionMutations();

  const currentPlanId  = billingStatus?.subscription?.plan_id ?? "free_trial";
  const isInTrial      = billingStatus?.trial?.is_active && (billingStatus?.trial?.hours_left ?? 0) > 0;
  const hoursLeft      = billingStatus?.trial?.hours_left ?? 0;

  function openUpgrade(tab: "plans" | "credits") {
    setUpgradeTab(tab);
    setUpgradeOpen(true);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Page header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">Billing & Credits</h1>
            <p className="text-sm text-muted-foreground">
              Manage your VX token balance, subscription, and usage history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isInTrial && (
              <Badge className="bg-green-500/15 text-green-400 border-green-500/20 text-[10px]">
                Trial Active · {Math.ceil(hoursLeft)}h left
              </Badge>
            )}
            {!isInTrial && currentPlanId !== "free_trial" && (
              <Badge className={`${PLAN_BADGE_COLORS[currentPlanId as PlanId] ?? ""} text-[10px]`}>
                {billingStatus?.subscription?.plan_name}
              </Badge>
            )}
            <Button size="sm" onClick={() => openUpgrade("credits")} className="gap-1.5">
              <Coins className="size-3.5" /> Buy VX
            </Button>
            {!isInTrial && currentPlanId === "free_trial" && (
              <Button size="sm" variant="outline" onClick={() => openUpgrade("plans")} className="gap-1.5">
                <Zap className="size-3.5" /> Upgrade
              </Button>
            )}
          </div>
        </div>

        {/* Top row: wallet + quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <WalletCard onBuyCredits={() => openUpgrade("credits")} />
          </div>
          <div className="sm:col-span-2 grid grid-cols-2 gap-4">
            {/* Current plan card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Package className="size-3" /> Current Plan
              </p>
              {isLoading ? (
                <div className="h-6 bg-muted animate-pulse rounded w-24" />
              ) : (
                <>
                  <p className="text-lg font-bold">
                    {isInTrial ? "Free Trial" : (billingStatus?.subscription?.plan_name ?? "No Plan")}
                  </p>
                  {isInTrial && (
                    <p className="text-[11px] text-muted-foreground">
                      Full access for {Math.ceil(hoursLeft)}h
                    </p>
                  )}
                  {!isInTrial && billingStatus?.subscription && (
                    <p className="text-[11px] text-muted-foreground">
                      {(billingStatus.subscription.vx_credits_remaining ?? 0).toLocaleString()} VX remaining this period
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Usage stats */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <BarChart2 className="size-3" /> All Time Usage
              </p>
              {isLoading ? (
                <div className="h-6 bg-muted animate-pulse rounded w-24" />
              ) : (
                <>
                  <p className="text-lg font-bold">
                    {billingStatus?.usage.total_operations.toLocaleString() ?? "0"} ops
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {billingStatus?.usage.total_credits_spent.toLocaleString() ?? "0"} VX consumed
                  </p>
                </>
              )}
            </div>

            {/* 24h activity */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Last 24 Hours
              </p>
              <p className="text-lg font-bold">
                {billingStatus?.usage.ops_last_24h ?? 0} ops
              </p>
            </div>

            {/* Monthly activity */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                This Month
              </p>
              <p className="text-lg font-bold">
                {billingStatus?.usage.ops_last_30d ?? 0} ops
              </p>
            </div>
          </div>
        </div>

        {/* Main tabs */}
        <Tabs defaultValue="usage">
          <TabsList>
            <TabsTrigger value="usage" className="gap-1.5">
              <BarChart2 className="size-3.5" /> Usage Analytics
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <Receipt className="size-3.5" /> Transaction History
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5">
              <Package className="size-3.5" /> Plans
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage" className="mt-4">
            <UsageChart />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <TransactionHistory />
          </TabsContent>

          <TabsContent value="plans" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                All plans include full AI Media Studio access. VX credits reset monthly.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4">
                {plans
                  .filter((p) => p.id !== "free_trial")
                  .map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isCurrent={currentPlanId === plan.id}
                      highlighted={plan.id === "pro"}
                      onSelect={() => openUpgrade("plans")}
                    />
                  ))}
              </div>
              {/* Cancel option */}
              {!isInTrial && currentPlanId !== "free_trial" && (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive text-xs"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate()}
                  >
                    Cancel subscription
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <UpgradeDialog
        open={upgradeOpen}
        tab={upgradeTab}
        onClose={() => setUpgradeOpen(false)}
      />
    </div>
  );
}
