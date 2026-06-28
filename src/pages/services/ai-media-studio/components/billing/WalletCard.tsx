import { cn } from "@/lib/utils";
import { Coins, TrendingDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveBalance } from "@/hooks/useBilling";
import { VX_COSTS } from "@/lib/types/billing";

interface WalletCardProps {
  onBuyCredits?: () => void;
  compact?:      boolean;
}

function TrialCountdown({ hoursLeft }: { hoursLeft: number }) {
  const daysLeft  = Math.floor(hoursLeft / 24);
  const hrsRemain = Math.floor(hoursLeft % 24);
  const isWarning = hoursLeft < 24;

  return (
    <div className={cn(
      "rounded-lg border px-3 py-2 text-sm",
      isWarning
        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
        : "border-green-500/30 bg-green-500/10 text-green-400"
    )}>
      <p className="font-medium">
        {isWarning ? "⚠️ Trial ending soon" : "🎉 Free Trial Active"}
      </p>
      <p className="text-[11px] opacity-80 mt-0.5">
        {daysLeft > 0 ? `${daysLeft}d ${hrsRemain}h remaining` : `${Math.floor(hoursLeft)}h remaining`}
      </p>
    </div>
  );
}

export function WalletCard({ onBuyCredits, compact }: WalletCardProps) {
  const { data: balance } = useLiveBalance();

  const isInTrial  = balance?.in_trial && (balance?.hours_left ?? 0) > 0;
  const vxBalance  = balance?.balance_vx ?? 0;
  const hoursLeft  = balance?.hours_left ?? 0;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <Coins className="size-3.5 text-amber-400" />
        {isInTrial ? (
          <span className="text-xs text-green-400 font-medium">
            Trial · {Math.ceil(hoursLeft)}h
          </span>
        ) : (
          <span className="text-xs font-mono font-semibold">
            {vxBalance.toLocaleString()} VX
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-500/15 p-2">
            <Coins className="size-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">VX Balance</p>
            <p className="text-2xl font-bold tabular-nums leading-tight">
              {isInTrial ? "∞" : vxBalance.toLocaleString()}
            </p>
          </div>
        </div>
        {!isInTrial && (
          <Button size="sm" onClick={onBuyCredits} className="gap-1.5">
            <Plus className="size-3.5" /> Buy VX
          </Button>
        )}
      </div>

      {/* Trial banner */}
      {isInTrial && <TrialCountdown hoursLeft={hoursLeft} />}

      {/* Not in trial: generation cost guide */}
      {!isInTrial && (
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(VX_COSTS) as [string, number][]).map(([type, cost]) => {
            const icons: Record<string, string> = { tts: "🎙️", voice_cloning: "🧬", text_to_video: "🎬" };
            const labels: Record<string, string> = { tts: "Speech", voice_cloning: "Clone", text_to_video: "Video" };
            const affordable = vxBalance >= cost;
            return (
              <div
                key={type}
                className={cn(
                  "rounded-lg border p-2 text-center",
                  affordable ? "border-border" : "border-red-500/20 bg-red-500/5"
                )}
              >
                <span className="text-base">{icons[type]}</span>
                <p className="text-[10px] text-muted-foreground">{labels[type]}</p>
                <p className={cn("text-xs font-bold", affordable ? "text-foreground" : "text-red-400")}>
                  {cost} VX
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Balance warning */}
      {!isInTrial && vxBalance < 300 && vxBalance > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2">
          <TrendingDown className="size-3.5 text-yellow-400" />
          <p className="text-[11px] text-yellow-400">
            Low balance — top up to continue generating
          </p>
        </div>
      )}

      {!isInTrial && vxBalance === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
          <p className="text-[11px] text-red-400">
            No VX credits remaining. Purchase credits or upgrade your plan to generate.
          </p>
        </div>
      )}
    </div>
  );
}
