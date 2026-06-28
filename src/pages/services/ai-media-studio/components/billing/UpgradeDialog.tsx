import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, Package } from "lucide-react";
import { PlanCard } from "./PlanCard";
import { usePlans } from "@/hooks/usePlans";
import { useSubscriptionMutations } from "@/hooks/useBilling";
import { useBillingStatus } from "@/hooks/useBilling";
import type { PlanId } from "@/lib/types/billing";

const CREDIT_PACKS = [
  { vx: 1_000,  label: "Starter",    price: "$1.99" },
  { vx: 5_000,  label: "Creator",    price: "$8.99" },
  { vx: 15_000, label: "Power",      price: "$22.99" },
  { vx: 50_000, label: "Pro Bundle", price: "$69.99" },
];

interface UpgradeDialogProps {
  open:      boolean;
  onClose:   () => void;
  tab?:      "plans" | "credits";
}

export function UpgradeDialog({ open, onClose, tab = "plans" }: UpgradeDialogProps) {
  const { data: plans = [], isLoading: plansLoading } = usePlans();
  const { data: billingStatus }                        = useBillingStatus();
  const { upgrade, purchase }                          = useSubscriptionMutations();
  const [activeTab, setActiveTab]                      = useState(tab);
  const [selectedPack, setSelectedPack]                = useState<number | null>(null);
  const [customVx, setCustomVx]                        = useState("");

  const currentPlanId = billingStatus?.subscription?.plan_id ?? "free_trial";
  const pendingUpgrade = upgrade.isPending;
  const pendingPurchase = purchase.isPending;

  function handleUpgrade(planId: PlanId) {
    upgrade.mutate(planId, { onSuccess: onClose });
  }

  function handlePurchase() {
    const amount = selectedPack ?? (parseInt(customVx) || 0);
    if (amount < 100) return;
    purchase.mutate(amount, { onSuccess: onClose });
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

          {/* Credits tab */}
          <TabsContent value="credits">
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CREDIT_PACKS.map((pack) => (
                  <button
                    key={pack.vx}
                    onClick={() => { setSelectedPack(pack.vx); setCustomVx(""); }}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      selectedPack === pack.vx
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="text-lg font-bold text-amber-400">
                      {pack.vx.toLocaleString()} VX
                    </p>
                    <p className="text-xs text-muted-foreground">{pack.label}</p>
                    <p className="text-sm font-semibold mt-2">{pack.price}</p>
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="flex gap-3 items-end pt-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Custom amount (min 100 VX)</Label>
                  <Input
                    type="number"
                    min={100}
                    step={100}
                    placeholder="e.g. 2000"
                    value={customVx}
                    onChange={(e) => { setCustomVx(e.target.value); setSelectedPack(null); }}
                    className="h-9"
                  />
                </div>
              </div>

              <Button
                className="w-full"
                disabled={pendingPurchase || (!selectedPack && !customVx)}
                onClick={handlePurchase}
              >
                {pendingPurchase ? "Processing…" : "Purchase Credits"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
