import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TVSubscription } from "@/hooks/useTVSubscription";

type Props = {
  subscription:   TVSubscription | null | undefined;
  isSubscribed:   boolean;
  daysRemaining:  number;
  className?:     string;
};

export function TVSubscriptionStatus({ subscription, isSubscribed, daysRemaining, className }: Props) {
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
          ? "bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20"
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
