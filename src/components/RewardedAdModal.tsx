import { useEffect, useRef, useState } from "react";
import { Coins, Loader2, Tv2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";

const GAM_NETWORK_CODE = import.meta.env.VITE_GAM_NETWORK_CODE ?? "MISSING";
const GAM_AD_UNIT      = import.meta.env.VITE_GAM_REWARDED_UNIT ?? "rewarded";
const AD_UNIT_PATH     = `/${GAM_NETWORK_CODE}/${GAM_AD_UNIT}`;
const GPT_ENABLED      = GAM_NETWORK_CODE !== "MISSING";

const VX_REWARD        = 5;
const SIMULATED_AD_SEC = 15;

declare global {
  interface Window {
    googletag: {
      cmd: Array<() => void>;
      defineOutOfPageSlot: (adUnitPath: string, format: string) => GPTSlot | null;
      enums: { OutOfPageFormat: { REWARDED: string } };
      pubads: () => GPTPubAds;
      enableServices: () => void;
      display: (slot: GPTSlot) => void;
      destroySlots: (slots: GPTSlot[]) => void;
    };
  }
}

interface GPTSlot { addService: (s: GPTPubAds) => GPTSlot; }
interface GPTRewardedReadyEvent   { makeRewardedVisible: () => void; }
interface GPTRewardedGrantedEvent { payload: { type: string; amount: number } | null; }
interface GPTPubAds {
  addEventListener:    (ev: "rewardedSlotReady" | "rewardedSlotGranted" | "rewardedSlotClosed", fn: (e: GPTRewardedReadyEvent & GPTRewardedGrantedEvent) => void) => void;
  removeEventListener: (ev: "rewardedSlotReady" | "rewardedSlotGranted" | "rewardedSlotClosed", fn: (e: GPTRewardedReadyEvent & GPTRewardedGrantedEvent) => void) => void;
}

interface Props {
  onRewarded: () => void;
  onClose: () => void;
}

type AdState = "loading" | "ready" | "watching" | "granted" | "error";

// ─── Simulated ad: countdown timer shown when GAM is not configured ──────────
function SimulatedAdModal({ onRewarded, onClose }: Props) {
  const { t } = useLanguage();
  const [secondsLeft, setSecondsLeft] = useState(SIMULATED_AD_SEC);
  const [granted, setGranted] = useState(false);
  const rewardedRef = useRef(false);

  useEffect(() => {
    if (granted) return;
    if (secondsLeft <= 0) {
      if (!rewardedRef.current) {
        rewardedRef.current = true;
        setGranted(true);
        onRewarded();
      }
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, granted, onRewarded]);

  const progress = ((SIMULATED_AD_SEC - secondsLeft) / SIMULATED_AD_SEC) * 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("dash.watchAd")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-8 text-center space-y-5">
        {!granted ? (
          <>
            <div className="flex justify-center">
              <div className="rounded-2xl bg-amber-500/15 p-4">
                <Tv2 className="h-10 w-10 text-amber-500" aria-hidden="true" />
              </div>
            </div>
            <p className="text-base font-semibold">{t("dash.adWatching")}</p>
            <div className="space-y-2">
              <Progress value={progress} className="h-3" />
              <p className="text-2xl font-bold tabular-nums text-amber-500">
                {t("dash.adSecondsLeft").replace("{s}", String(secondsLeft))}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              +{VX_REWARD} VX {t("dash.adWatched")?.split("!")[0] || "reward on completion"}
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Coins className="h-12 w-12 text-amber-500" aria-hidden="true" />
            </div>
            <p className="text-lg font-bold text-amber-500">
              🎉 {t("dash.adWatched").replace("{pts}", String(VX_REWARD))}
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {t("vx.close")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Real GPT rewarded ad ─────────────────────────────────────────────────────
function GptAdModal({ onRewarded, onClose }: Props) {
  const { t } = useLanguage();
  const [state, setState] = useState<AdState>("loading");
  const slotRef = useRef<GPTSlot | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const gt = window.googletag;
    if (!gt) { setFallback(true); return; }

    const onReady = (e: GPTRewardedReadyEvent & GPTRewardedGrantedEvent) => {
      setState("watching");
      e.makeRewardedVisible();
    };
    const onGranted = () => { setState("granted"); onRewarded(); };
    const onClosed  = () => { onClose(); };

    gt.cmd.push(() => {
      const slot = gt.defineOutOfPageSlot(AD_UNIT_PATH, gt.enums.OutOfPageFormat.REWARDED);
      if (!slot) { setFallback(true); return; }
      slotRef.current = slot;
      slot.addService(gt.pubads());
      gt.enableServices();
      gt.display(slot);
      setState("ready");
      gt.pubads().addEventListener("rewardedSlotReady",   onReady);
      gt.pubads().addEventListener("rewardedSlotGranted", onGranted);
      gt.pubads().addEventListener("rewardedSlotClosed",  onClosed);
    });

    return () => {
      gt.cmd.push(() => {
        gt.pubads().removeEventListener("rewardedSlotReady",   onReady);
        gt.pubads().removeEventListener("rewardedSlotGranted", onGranted);
        gt.pubads().removeEventListener("rewardedSlotClosed",  onClosed);
        if (slotRef.current) { gt.destroySlots([slotRef.current]); slotRef.current = null; }
      });
    };
  }, [onRewarded, onClose]);

  // If GPT fails for any reason, fall back to simulated ad
  if (fallback) {
    return <SimulatedAdModal onRewarded={onRewarded} onClose={onClose} />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("dash.watchAd")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-8 text-center space-y-4">
        <div className="flex justify-center">
          <Coins className="h-10 w-10 text-amber-500" aria-hidden="true" />
        </div>
        {(state === "loading" || state === "ready") && (
          <>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("dash.adLoading")}</p>
          </>
        )}
        {state === "watching" && (
          <p className="text-sm font-medium">{t("dash.adWatching")}</p>
        )}
        {state === "granted" && (
          <>
            <p className="text-base font-bold text-amber-500">
              🎉 {t("dash.adWatched").replace("{pts}", String(VX_REWARD))}
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {t("vx.close")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Export: uses real GPT if configured, falls back to simulated ─────────────
export function RewardedAdModal({ onRewarded, onClose }: Props) {
  return GPT_ENABLED
    ? <GptAdModal    onRewarded={onRewarded} onClose={onClose} />
    : <SimulatedAdModal onRewarded={onRewarded} onClose={onClose} />;
}
