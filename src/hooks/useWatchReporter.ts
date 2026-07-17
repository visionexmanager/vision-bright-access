/**
 * useWatchReporter
 *
 * Silently reports watch time to the DB (tv_watch_stats) every 30 seconds
 * while a channel is playing. Used for the recommendation engine and trending.
 *
 * The report is fire-and-forget — failures are silently swallowed so they
 * never interrupt playback.
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const REPORT_INTERVAL_MS = 30_000; // report every 30 seconds

export function useWatchReporter(channelId: string | null) {
  const { user }    = useAuth();
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const accRef      = useRef(0); // seconds accumulated since last report

  useEffect(() => {
    if (!channelId || !user) return;

    // Accumulate seconds every second
    const secTimer = setInterval(() => { accRef.current++; }, 1000);

    // Report to DB every 30s
    timerRef.current = setInterval(async () => {
      const secs = accRef.current;
      if (secs <= 0) return;
      accRef.current = 0;

      // Fire-and-forget — never block or error-surface to user
      supabase
        .rpc("record_tv_watch", { _channel_id: channelId, _seconds: secs })
        .then(() => {}, () => {});
    }, REPORT_INTERVAL_MS);

    return () => {
      clearInterval(secTimer);
      if (timerRef.current) clearInterval(timerRef.current);

      // Final flush on unmount
      const remaining = accRef.current;
      if (remaining > 0 && channelId && user) {
        supabase
          .rpc("record_tv_watch", { _channel_id: channelId, _seconds: remaining })
          .then(() => {}, () => {});
      }
      accRef.current = 0;
    };
  }, [channelId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
