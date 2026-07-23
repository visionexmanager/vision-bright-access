import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface FlashDealBadgeProps {
  endsAt: string;
  className?: string;
}

function formatTimeLeft(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** A live countdown badge for library_books.flash_deal_ends_at. Ticks once a
 *  minute (a flash deal doesn't need second-level precision) and unmounts
 *  itself once the deal expires, rather than relying on a stale server-side
 *  filter to hide it. */
export function FlashDealBadge({ endsAt, className }: FlashDealBadgeProps) {
  const { t } = useLanguage();
  const endsAtMs = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const remaining = endsAtMs - now;
  if (remaining <= 0) return null;

  return (
    <Badge variant="destructive" className={className}>
      <Zap className="h-3 w-3" aria-hidden="true" />
      {t("library.flashDeal.timeLeft").replace("{time}", formatTimeLeft(remaining))}
    </Badge>
  );
}
