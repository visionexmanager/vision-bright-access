import { useState, useEffect, useCallback } from "react";
import { Coins, Play, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEarnPoints, DAILY_AD_LIMIT } from "@/hooks/useEarnPoints";
import { useSound } from "@/contexts/SoundContext";
import { RewardedAdModal } from "@/components/RewardedAdModal";
import { toast } from "@/hooks/use-toast";

const VX_REWARD = 5;

/**
 * variant:
 *  "card"    – full card with title/desc (for page sections)
 *  "banner"  – slim horizontal strip (between content areas)
 *  "compact" – single small button (navbar / sidebar)
 *  "float"   – fixed floating button bottom-left (for game / sim pages)
 */
interface Props {
  variant?: "card" | "banner" | "compact" | "float";
  className?: string;
}

export function WatchAdButton({ variant = "card", className = "" }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { earnPoints, getTodayAdCount } = useEarnPoints();
  const { playSound } = useSound();
  const [showAd, setShowAd] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  // Load today's count once when user is known
  useEffect(() => {
    if (!user) return;
    getTodayAdCount().then(setTodayCount);
  }, [user, getTodayAdCount]);

  const handleRewarded = useCallback(async () => {
    const fresh = await getTodayAdCount();
    if (fresh >= DAILY_AD_LIMIT) {
      toast({ title: t("dash.adLimitReached"), variant: "destructive" });
      setTodayCount(DAILY_AD_LIMIT);
      return;
    }
    const ok = await earnPoints(VX_REWARD, "Watched an ad");
    if (ok) {
      playSound("points");
      setTodayCount((c) => (c ?? 0) + 1);
      toast({ title: t("dash.adWatched").replace("{pts}", String(VX_REWARD)) });
    }
  }, [getTodayAdCount, earnPoints, playSound, t]);

  // Don't render if not logged in
  if (!user) return null;

  const count = todayCount ?? 0;
  const remaining = Math.max(0, DAILY_AD_LIMIT - count);
  const exhausted = remaining === 0;

  // ── FLOAT variant ─────────────────────────────────────────────
  if (variant === "float") {
    return (
      <>
        <div className={`fixed bottom-6 left-6 z-40 ${className}`}>
          <Button
            onClick={() => setShowAd(true)}
            disabled={exhausted}
            size="sm"
            variant="outline"
            className="gap-2 rounded-full shadow-lg border-amber-500/50 bg-background hover:bg-amber-500/10"
            aria-label={exhausted ? t("dash.adLimitReached") : `${t("dash.watchAd")} +${VX_REWARD} VX`}
          >
            <Tv2 className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <span className="text-xs font-semibold">+{VX_REWARD} VX</span>
            {!exhausted && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {remaining}
              </Badge>
            )}
          </Button>
        </div>
        {showAd && (
          <RewardedAdModal onRewarded={handleRewarded} onClose={() => setShowAd(false)} />
        )}
      </>
    );
  }

  // ── COMPACT variant ────────────────────────────────────────────
  if (variant === "compact") {
    return (
      <>
        <Button
          onClick={() => setShowAd(true)}
          disabled={exhausted}
          size="sm"
          variant="ghost"
          className={`gap-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 ${className}`}
          aria-label={exhausted ? t("dash.adLimitReached") : `${t("dash.watchAd")} +${VX_REWARD} VX`}
        >
          <Tv2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline text-xs font-medium">+{VX_REWARD} VX</span>
          {!exhausted && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-500/40">
              {remaining}
            </Badge>
          )}
        </Button>
        {showAd && (
          <RewardedAdModal onRewarded={handleRewarded} onClose={() => setShowAd(false)} />
        )}
      </>
    );
  }

  // ── BANNER variant ─────────────────────────────────────────────
  if (variant === "banner") {
    return (
      <>
        <div
          className={`flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Tv2 className="h-5 w-5 text-amber-500" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{t("dash.watchAd")}</p>
              <p className="text-xs text-muted-foreground">
                {exhausted
                  ? t("dash.adLimitReached")
                  : t("dash.watchAdDesc") + ` — ${remaining}/${DAILY_AD_LIMIT} ${t("dash.remaining") ?? "remaining"}`}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowAd(true)}
            disabled={exhausted}
            size="sm"
            className="shrink-0 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
            aria-label={`${t("dash.watchAd")} +${VX_REWARD} VX`}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            +{VX_REWARD} VX
          </Button>
        </div>
        {showAd && (
          <RewardedAdModal onRewarded={handleRewarded} onClose={() => setShowAd(false)} />
        )}
      </>
    );
  }

  // ── CARD variant (default) ─────────────────────────────────────
  return (
    <>
      <Card className={`border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors ${className}`}>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-amber-500/15 p-3 shrink-0">
            <Tv2 className="h-7 w-7 text-amber-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight">{t("dash.watchAd")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{t("dash.watchAdDesc")}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs gap-1">
                <Coins className="h-3 w-3" aria-hidden="true" />
                +{VX_REWARD} VX
              </Badge>
              <span className="text-xs text-muted-foreground">
                {count}/{DAILY_AD_LIMIT} {t("dash.today") ?? "today"}
              </span>
            </div>
          </div>
          <Button
            onClick={() => setShowAd(true)}
            disabled={exhausted}
            size="sm"
            className="shrink-0 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
            aria-label={exhausted ? t("dash.adLimitReached") : `${t("dash.watchAd")} +${VX_REWARD} VX`}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {exhausted ? "✓" : t("dash.watchAd")}
          </Button>
        </CardContent>
      </Card>
      {showAd && (
        <RewardedAdModal onRewarded={handleRewarded} onClose={() => setShowAd(false)} />
      )}
    </>
  );
}
