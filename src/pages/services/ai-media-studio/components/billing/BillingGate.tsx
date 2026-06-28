// BillingGate — wraps any AI generation action.
// Shows an "insufficient credits" wall instead of allowing the action.
// All actual credit validation happens server-side in billing_consume().
import { useState, type ReactNode } from "react";
import { Coins, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanGenerate } from "@/hooks/useBilling";
import { VX_COSTS } from "@/lib/types/billing";
import type { OperationType } from "@/lib/types/billing";
import { UpgradeDialog } from "./UpgradeDialog";

interface BillingGateProps {
  operation:  OperationType;
  children:   ReactNode;
}

export function BillingGate({ operation, children }: BillingGateProps) {
  const { canGenerate, reason, balance } = useCanGenerate();
  const [upgradeOpen, setUpgradeOpen]   = useState(false);

  // While loading or can generate: render children normally
  if (reason === "loading" || canGenerate) {
    return (
      <>
        {children}
        <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} tab="credits" />
      </>
    );
  }

  // Blocked state
  const cost  = VX_COSTS[operation];
  const icons: Record<OperationType, string> = {
    tts: "🎙️", voice_cloning: "🧬", text_to_video: "🎬",
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <div className="rounded-full bg-red-500/15 p-4">
          <Lock className="size-6 text-red-400" />
        </div>
        <div>
          <p className="text-base font-semibold">{icons[operation]} Insufficient VX Credits</p>
          <p className="text-sm text-muted-foreground mt-1">
            This operation costs <span className="font-bold text-amber-400">{cost} VX</span>.
            {typeof balance === "number" && (
              <> You have <span className="font-bold">{balance.toLocaleString()} VX</span>.</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setUpgradeOpen(true)} size="sm" className="gap-1.5">
            <Coins className="size-3.5" /> Buy VX Credits
          </Button>
          <Button
            onClick={() => setUpgradeOpen(true)}
            size="sm"
            variant="outline"
          >
            View Plans
          </Button>
        </div>
      </div>
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} tab="credits" />
    </>
  );
}
