import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RadioSubscription } from "@/hooks/useRadioSubscription";

type Props = {
  subscription:  RadioSubscription | null | undefined;
  isSubscribed:  boolean;
  daysRemaining: number;
  className?:    string;
};

export function RadioSubscriptionStatus({ subscription, isSubscribed, daysRemaining, className }: Props) {
  if (!subscription) {
    return (
      <Badge variant="outline" className={cn("gap-1.5 text-muted-foreground", className)}>
        <XCircle className="w-3.5 h-3.5" />
        غير مشترك
      </Badge>
    );
  }

  const expiresDate = new Date(subscription.expires_at).toLocaleDateString("ar-EG", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Badge
      className={cn(
        "gap-1.5",
        isSubscribed
          ? "bg-orange-500/15 text-orange-600 border-orange-500/30 hover:bg-orange-500/20"
          : "bg-red-500/15 text-red-600 border-red-500/30",
        className
      )}
      variant="outline"
    >
      {isSubscribed ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5" />
          {daysRemaining <= 3
            ? `ينتهي خلال ${daysRemaining} ${daysRemaining === 1 ? "يوم" : "أيام"}`
            : `${subscription.plan_name_ar} — حتى ${expiresDate}`}
        </>
      ) : (
        <>
          <Clock className="w-3.5 h-3.5" />
          انتهى الاشتراك
        </>
      )}
    </Badge>
  );
}
