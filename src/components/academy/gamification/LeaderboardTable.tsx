import { Trophy, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AcademyLeaderboardEntry, AcademyLeaderboardPrivacyRow } from "@/lib/types/academy-gamification";

interface LeaderboardTableProps {
  myEntry: AcademyLeaderboardEntry;
  privacy: AcademyLeaderboardPrivacyRow;
  onTogglePrivacy: (visible: boolean) => void;
}

/**
 * Honest by design: localStorage is per-browser, so this can only ever know
 * the current user's own rank — no fabricated competitors. Scope/period
 * selectors (global/friends/course/…) are modeled in the types layer and
 * will populate for real once a server-backed leaderboard exists.
 */
export function LeaderboardTable({ myEntry, privacy, onTogglePrivacy }: LeaderboardTableProps) {
  return (
    <div className="bg-card p-6 rounded-2xl border border-border space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch id="leaderboard-visibility" checked={privacy.visible_on_leaderboards} onCheckedChange={onTogglePrivacy} />
          <Label htmlFor="leaderboard-visibility" className="text-xs text-foreground cursor-pointer">إظهاري في المتصدرين</Label>
        </div>
      </div>

      <ul aria-label="لوحة المتصدرين" className="space-y-2">
        <li className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-500 font-black text-sm shrink-0">
            <Trophy className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground text-sm truncate">{myEntry.display_name} (أنت)</p>
            <p className="text-xs text-muted-foreground">المستوى {myEntry.level}</p>
          </div>
          <span className="text-sm font-black text-foreground shrink-0">{myEntry.xp.toLocaleString()} XP</span>
        </li>
      </ul>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        ترتيبك الحالي يعرض بياناتك فقط — سيظهر بقية المتعلّمين هنا بعد ربط لوحة المتصدرين بخادم مركزي.
      </p>
    </div>
  );
}
