// Global trial countdown banner — rendered inside StudioLayout
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Clock, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveBalance } from "@/hooks/useBilling";

interface TrialBannerProps {
  onUpgrade?: () => void;
}

export function TrialBanner({ onUpgrade }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { data: balance }         = useLiveBalance();

  if (dismissed) return null;
  if (!balance?.in_trial) return null;

  const hoursLeft = balance.hours_left ?? 0;
  const isWarning = hoursLeft < 24;
  const isUrgent  = hoursLeft < 6;
  const daysLeft  = Math.floor(hoursLeft / 24);
  const hrsOnly   = Math.floor(hoursLeft % 24);

  const timeStr = daysLeft > 0
    ? `${daysLeft}d ${hrsOnly}h`
    : `${Math.ceil(hoursLeft)}h`;

  if (!isWarning) return null; // only show banner when < 24h left

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 text-sm border-b",
      isUrgent
        ? "bg-red-500/15 border-red-500/20 text-red-300"
        : "bg-yellow-500/15 border-yellow-500/20 text-yellow-300"
    )}>
      <Clock className="size-3.5 shrink-0" />
      <p className="flex-1 text-[12px]">
        <span className="font-semibold">
          {isUrgent ? "⚠️ Trial expiring soon — " : "Trial ends in "}
        </span>
        <span>{timeStr} remaining.</span>
        <span className="ml-1">Upgrade to keep generating.</span>
      </p>
      <Button
        size="sm"
        variant="outline"
        className={cn(
          "h-6 text-[11px] shrink-0",
          isUrgent ? "border-red-400 text-red-300 hover:bg-red-500/20" : "border-yellow-400 text-yellow-300 hover:bg-yellow-500/20"
        )}
        onClick={onUpgrade}
      >
        <Zap className="mr-1 size-2.5" />
        Upgrade
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="text-current opacity-60 hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
