import { cn } from "@/lib/utils";
import { Check, Zap, Crown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_COLORS } from "@/lib/types/billing";
import type { BillingPlan, PlanId } from "@/lib/types/billing";

const PLAN_ICONS: Record<PlanId, React.ElementType> = {
  free_trial: Zap,
  basic:      Zap,
  pro:        Crown,
  enterprise: Building2,
};

interface PlanCardProps {
  plan:           BillingPlan;
  isCurrent?:     boolean;
  onSelect?:      (planId: PlanId) => void;
  isPending?:     boolean;
  highlighted?:   boolean;
}

export function PlanCard({ plan, isCurrent, onSelect, isPending, highlighted }: PlanCardProps) {
  const Icon = PLAN_ICONS[plan.id] ?? Zap;

  return (
    <div className={cn(
      "relative rounded-2xl border-2 bg-card p-6 flex flex-col gap-4 transition-shadow",
      isCurrent   && "border-primary/60 shadow-md",
      highlighted && !isCurrent && "border-violet-500/60 shadow-violet-500/10 shadow-lg",
      !isCurrent && !highlighted && "border-border hover:border-border/80"
    )}>
      {/* Recommended badge */}
      {highlighted && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-violet-600 text-white text-[10px] px-3">Most popular</Badge>
        </div>
      )}

      {/* Plan header */}
      <div className="flex items-start gap-3">
        <div className={cn(
          "rounded-xl p-2.5 bg-gradient-to-br text-white",
          PLAN_COLORS[plan.id]
        )}>
          <Icon className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">{plan.name}</h3>
            {isCurrent && (
              <Badge variant="outline" className="text-[10px] border-primary text-primary">
                Current
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
        </div>
      </div>

      {/* Price */}
      <div>
        {plan.price_monthly_usd === 0 ? (
          <p className="text-3xl font-black">Free</p>
        ) : (
          <div className="flex items-end gap-1">
            <p className="text-3xl font-black">${plan.price_monthly_usd.toFixed(0)}</p>
            <p className="text-sm text-muted-foreground pb-1">/month</p>
          </div>
        )}
        {plan.vx_credits_monthly > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-semibold text-amber-400">
              {plan.vx_credits_monthly.toLocaleString()} VX
            </span>
            {" "}credits/month
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-1.5 flex-1">
        {(plan.features as string[]).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="size-3.5 mt-0.5 text-green-400 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {plan.id !== "free_trial" && (
        <Button
          className={cn("w-full", highlighted && "bg-violet-600 hover:bg-violet-700")}
          variant={isCurrent ? "outline" : "default"}
          disabled={isCurrent || isPending}
          onClick={() => !isCurrent && onSelect?.(plan.id)}
        >
          {isPending ? "Processing…"
            : isCurrent ? "Current Plan"
            : `Upgrade to ${plan.name}`}
        </Button>
      )}
    </div>
  );
}
