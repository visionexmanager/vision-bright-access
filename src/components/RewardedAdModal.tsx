import { useEffect, useRef, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// GPT network code and rewarded ad unit — set these in your .env file
const GAM_NETWORK_CODE = import.meta.env.VITE_GAM_NETWORK_CODE ?? "MISSING";
const GAM_AD_UNIT      = import.meta.env.VITE_GAM_REWARDED_UNIT ?? "rewarded";
const AD_UNIT_PATH     = `/${GAM_NETWORK_CODE}/${GAM_AD_UNIT}`;

const VX_REWARD = 5;

declare global {
  interface Window {
    googletag: {
      cmd: Array<() => void>;
      defineOutOfPageSlot: (
        adUnitPath: string,
        format: string
      ) => GPTSlot | null;
      enums: { OutOfPageFormat: { REWARDED: string } };
      pubads: () => GPTPubAds;
      enableServices: () => void;
      display: (slot: GPTSlot) => void;
      destroySlots: (slots: GPTSlot[]) => void;
    };
  }
}

interface GPTSlot {
  addService: (service: GPTPubAds) => GPTSlot;
}

interface GPTRewardedReadyEvent {
  makeRewardedVisible: () => void;
}

interface GPTRewardedGrantedEvent {
  payload: { type: string; amount: number } | null;
}

interface GPTPubAds {
  addEventListener: (
    event: "rewardedSlotReady" | "rewardedSlotGranted" | "rewardedSlotClosed",
    listener: (e: GPTRewardedReadyEvent & GPTRewardedGrantedEvent) => void
  ) => void;
  removeEventListener: (
    event: "rewardedSlotReady" | "rewardedSlotGranted" | "rewardedSlotClosed",
    listener: (e: GPTRewardedReadyEvent & GPTRewardedGrantedEvent) => void
  ) => void;
}

interface Props {
  onRewarded: () => void;
  onClose: () => void;
}

type AdState = "loading" | "ready" | "watching" | "granted" | "error";

export function RewardedAdModal({ onRewarded, onClose }: Props) {
  const { t } = useLanguage();
  const [state, setState] = useState<AdState>("loading");
  const slotRef = useRef<GPTSlot | null>(null);

  useEffect(() => {
    const gt = window.googletag;
    if (!gt) {
      setState("error");
      return;
    }

    const onReady = (e: GPTRewardedReadyEvent & GPTRewardedGrantedEvent) => {
      setState("watching");
      e.makeRewardedVisible();
    };

    const onGranted = () => {
      setState("granted");
      onRewarded();
    };

    const onClosed = () => {
      onClose();
    };

    gt.cmd.push(() => {
      const slot = gt.defineOutOfPageSlot(
        AD_UNIT_PATH,
        gt.enums.OutOfPageFormat.REWARDED
      );

      if (!slot) {
        // Browser doesn't support rewarded ads (e.g. ad blocker)
        setState("error");
        return;
      }

      slotRef.current = slot;
      slot.addService(gt.pubads());
      gt.enableServices();
      gt.display(slot);
      setState("ready");

      gt.pubads().addEventListener("rewardedSlotReady", onReady);
      gt.pubads().addEventListener("rewardedSlotGranted", onGranted);
      gt.pubads().addEventListener("rewardedSlotClosed", onClosed);
    });

    return () => {
      gt.cmd.push(() => {
        gt.pubads().removeEventListener("rewardedSlotReady", onReady);
        gt.pubads().removeEventListener("rewardedSlotGranted", onGranted);
        gt.pubads().removeEventListener("rewardedSlotClosed", onClosed);
        if (slotRef.current) {
          gt.destroySlots([slotRef.current]);
          slotRef.current = null;
        }
      });
    };
  }, [onRewarded, onClose]);

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

        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("dash.adLoading")}</p>
          </>
        )}

        {state === "ready" && (
          <p className="text-sm text-muted-foreground">{t("dash.adLoading")}</p>
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

        {state === "error" && (
          <>
            <p className="text-sm text-destructive">{t("dash.adError")}</p>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-lg border px-4 py-2 text-sm"
            >
              {t("vx.close")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
