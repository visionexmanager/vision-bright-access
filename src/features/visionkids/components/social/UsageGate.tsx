import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMyLinkedParents } from "@/features/visionkids/hooks/academy/useAcademyParent";
import { useUsageHeartbeat } from "@/features/visionkids/hooks/social/useUsage";
import { useChildSettings } from "@/features/visionkids/hooks/social/useChildSettings";
import { isWithinTimeWindow } from "@/features/visionkids/services/social/usage";
import { TimeLockoutScreen } from "@/features/visionkids/components/social/TimeLockoutScreen";
import type { UsageCategory } from "@/features/visionkids/types/social.types";

function categoryForPath(pathname: string): UsageCategory {
  if (pathname.startsWith("/kids/stories") || pathname.startsWith("/kids/academy")) return "learning";
  if (pathname.startsWith("/kids/games")) return "play";
  if (pathname.startsWith("/kids/studio")) return "creative";
  if (pathname.startsWith("/kids/social")) return "social";
  if (pathname.startsWith("/kids/explorer")) return "explore";
  return "other";
}

// Pages a locked-out child can still reach — never trap them away from
// their own settings/passport or the parents area.
const ALWAYS_ALLOWED_PREFIXES = ["/kids/social/settings", "/kids/social/parents", "/kids/settings"];

/** Mounted once in VisionKidsLayout — pings usage every 30s for any
 *  signed-in child account (detected via useMyLinkedParents, i.e. "does
 *  this user have at least one linked parent") and swaps in a full-screen
 *  stop message when the daily limit, bedtime, or study-time window says
 *  so. A parent or admin browsing /kids/* under their own account is
 *  unaffected — they have no linked parent, so the gate never engages. */
export function UsageGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const { data: linkedParents = [] } = useMyLinkedParents();
  const isChildAccount = !!user && linkedParents.length > 0;

  const status = useUsageHeartbeat(categoryForPath(location.pathname), isChildAccount);
  const { data: settings } = useChildSettings(isChildAccount ? user?.id : undefined);

  const isAlwaysAllowed = ALWAYS_ALLOWED_PREFIXES.some((p) => location.pathname.startsWith(p));
  if (!isChildAccount || isAlwaysAllowed) return <>{children}</>;

  if (status?.is_over_limit) return <TimeLockoutScreen reason="daily_limit" />;

  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (settings && isWithinTimeWindow(nowHHMM, settings.bedtime_start, settings.bedtime_end)) {
    return <TimeLockoutScreen reason="bedtime" />;
  }

  // During the study-time window, non-learning categories are paused —
  // stories/academy stay open, everything else shows the study-time screen.
  const category = categoryForPath(location.pathname);
  if (settings && category !== "learning" && isWithinTimeWindow(nowHHMM, settings.study_time_start, settings.study_time_end)) {
    return <TimeLockoutScreen reason="study_time" />;
  }

  return <>{children}</>;
}
