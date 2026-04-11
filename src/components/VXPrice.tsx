import { Coins } from "lucide-react";
import { formatVX } from "@/systems/pricingSystem";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

interface VXPriceProps {
  amount: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLocal?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { text: "text-sm", icon: "h-3 w-3", local: "text-xs" },
  md: { text: "text-base", icon: "h-4 w-4", local: "text-xs" },
  lg: { text: "text-xl", icon: "h-4 w-4", local: "text-sm" },
  xl: { text: "text-4xl", icon: "h-6 w-6", local: "text-base" },
};

export function VXPrice({ amount, size = "md", showLocal = true, className }: VXPriceProps) {
  const { vxToLocal } = useCurrency();
  const s = sizeMap[size];

  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn("font-bold flex items-center gap-1", s.text)}>
        <Coins className={cn(s.icon, "text-primary")} />
        {formatVX(amount)}
      </span>
      {showLocal && (
        <span className={cn(s.local, "text-muted-foreground")}>{vxToLocal(amount)}</span>
      )}
    </div>
  );
}
