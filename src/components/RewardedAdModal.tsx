import { useEffect, useRef, useState } from "react";
import { X, Coins, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const AD_CLIENT = "ca-pub-6897088904832302";
const AD_SLOT   = "3569383992";
const WATCH_SECONDS = 30;
const VX_REWARD     = 5;

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface Props {
  onRewarded: () => void;
  onClose: () => void;
}

export function RewardedAdModal({ onRewarded, onClose }: Props) {
  const adRef = useRef<HTMLModElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(WATCH_SECONDS);
  const [rewarded, setRewarded] = useState(false);
  const pushedRef = useRef(false);

  // Push the AdSense ad once on mount
  useEffect(() => {
    if (pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch { /* already initialised */ }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (rewarded) return;
    if (secondsLeft <= 0) {
      setRewarded(true);
      onRewarded();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, rewarded, onRewarded]);

  const pct = ((WATCH_SECONDS - secondsLeft) / WATCH_SECONDS) * 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Watch ad to earn VX coins"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" aria-hidden="true" />
            <span className="font-bold text-base">
              {rewarded
                ? `+${VX_REWARD} VX earned!`
                : `Watch ${secondsLeft}s to earn ${VX_REWARD} VX`}
            </span>
          </div>
          {rewarded && (
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full bg-muted" aria-hidden="true">
          <div
            className="h-full bg-amber-500 transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Ad container */}
        <div className="px-4 py-4 min-h-[250px] flex items-center justify-center bg-muted/30">
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minHeight: 250 }}
            data-ad-client={AD_CLIENT}
            data-ad-slot={AD_SLOT}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 text-center">
          {rewarded ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-amber-500">
                🎉 {VX_REWARD} VX coins added to your balance!
              </p>
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          ) : (
            <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span aria-live="polite" aria-atomic="true">
                {secondsLeft} seconds remaining — please keep this open
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
