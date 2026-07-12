import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Coins, Package, ExternalLink } from "lucide-react";
import { PlanCard } from "./PlanCard";
import { usePlans } from "@/hooks/usePlans";
import { useSubscriptionMutations } from "@/hooks/useBilling";
import { useBillingStatus } from "@/hooks/useBilling";
import type { PlanId } from "@/lib/types/billing";

interface UpgradeDialogProps {
  open:      boolean;
  onClose:   () => void;
  tab?:      "plans" | "credits";
}

export function UpgradeDialog({ open, onClose, tab = "plans" }: UpgradeDialogProps) {
  const { data: plans = [], isLoading: plansLoading } = usePlans();
  const { data: billingStatus }                        = useBillingStatus();
  const { upgrade }                                    = useSubscriptionMutations();
  const [activeTab, setActiveTab]                      = useState(tab);

  const currentPlanId = billingStatus?.subscription?.plan_id ?? "free_trial";
  const pendingUpgrade = upgrade.isPending;

  function handleUpgrade(planId: PlanId) {
    upgrade.mutate(planId, { onSuccess: onClose });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Get More Credits</DialogTitle>
          <DialogDescription>
            Choose a subscription plan for monthly VX credits, or buy one-time packs.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "plans" | "credits")}>
          <TabsList className="mb-4">
            <TabsTrigger value="plans" className="gap-1.5">
              <Package className="size-3.5" /> Subscription Plans
            </TabsTrigger>
            <TabsTrigger value="credits" className="gap-1.5">
              <Coins className="size-3.5" /> Buy VX Credits
            </TabsTrigger>
          </TabsList>

          {/* Plans tab */}
          <TabsContent value="plans">
            {plansLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1,2,3].map((i) => (
                  <div key={i} className="rounded-2xl border border-border h-64 animate-pulse bg-muted" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {plans
                  .filter((p) => p.id !== "free_trial")
                  .map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isCurrent={currentPlanId === plan.id}
                      highlighted={plan.id === "pro"}
                      onSelect={handleUpgrade}
                      isPending={pendingUpgrade}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          {/* Credits tab — buying VX happens on the real checkout page (WishMoney/
              OMT/PayPal, admin-reviewed), not inline here; there's no payment
              provider integrated into this dialog. */}
          <TabsContent value="credits">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-10 text-center">
              <div className="rounded-full bg-amber-500/15 p-3">
                <Coins className="size-6 text-amber-400" />
              </div>
              <div className="max-w-sm space-y-1">
                <p className="font-semibold">Buy VX in the Coins Store</p>
                <p className="text-sm text-muted-foreground">
                  Pick any amount, pay via WishMoney, OMT, or PayPal, and your balance updates as soon as it's confirmed.
                </p>
              </div>
              <Button asChild onClick={onClose}>
                <Link to="/coins-store">
                  Go to Coins Store <ExternalLink className="ms-1.5 size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
