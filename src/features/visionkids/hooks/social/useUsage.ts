import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as usage from "@/features/visionkids/services/social/usage";
import type { KidsUsageStatus, UsageCategory } from "@/features/visionkids/types/social.types";

export function useUsageToday(childUserId?: string) {
  return useQuery({ queryKey: ["kids-social", "usage-today", childUserId ?? "me"], queryFn: () => usage.fetchUsageToday(childUserId) });
}

/** Mounted once in the VisionKids layout while a child is signed in — pings
 *  every 30s (matching the fixed 30s the server credits per call, see
 *  ping_kids_usage()'s own comment) and exposes live status so any page
 *  can show a lockout screen the instant the daily limit is hit. */
export function useUsageHeartbeat(category: UsageCategory, enabled: boolean) {
  const [status, setStatus] = useState<KidsUsageStatus | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const result = await usage.pingUsage(category);
        if (!cancelled) setStatus(result);
      } catch {
        // Not signed in as a child, or RPC unavailable — just stop pinging.
      }
    };

    tick();
    intervalRef.current = window.setInterval(tick, 30000);
    return () => {
      cancelled = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [category, enabled]);

  return status;
}
