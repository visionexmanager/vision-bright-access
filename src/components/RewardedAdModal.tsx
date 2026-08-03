import { useEffect, useRef, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { adsConfig, isRewardedAdsConfigured } from "@/features/ads/config";

const AD_UNIT_PATH = `/${adsConfig.gamNetworkCode}/${adsConfig.gamRewardedUnit}`;

let gptScriptPromise: Promise<void> | null = null;

function ensureGpt() {
  if (gptScriptPromise) return gptScriptPromise;
  gptScriptPromise = new Promise((resolve, reject) => {
    window.googletag = window.googletag || ({ cmd: [] } as typeof window.googletag);
    const existing = document.querySelector<HTMLScriptElement>('script[data-visionex-gpt="true"]');
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("GPT failed to load")), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
    script.crossOrigin = "anonymous";
    script.dataset.visionexGpt = "true";
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => { gptScriptPromise = null; reject(new Error("GPT failed to load")); };
    document.head.appendChild(script);
  });
  return gptScriptPromise;
}

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

interface GPTSlot { addService: (service: GPTPubAds) => GPTSlot; }
interface GPTRewardedEvent {
  makeRewardedVisible?: () => void;
  payload?: { type: string; amount: number } | null;
}
interface GPTPubAds {
  addEventListener: (event: "rewardedSlotReady" | "rewardedSlotGranted" | "rewardedSlotClosed", handler: (event: GPTRewardedEvent) => void) => void;
  removeEventListener: (event: "rewardedSlotReady" | "rewardedSlotGranted" | "rewardedSlotClosed", handler: (event: GPTRewardedEvent) => void) => void;
}

interface Props { onRewarded: () => void; onClose: () => void; }
type AdState = "loading" | "watching" | "granted" | "error";

export function RewardedAdModal({ onRewarded, onClose }: Props) {
  const { t } = useLanguage();
  const [state, setState] = useState<AdState>("loading");
  const slotRef = useRef<GPTSlot | null>(null);
  const grantedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { dialogRef.current?.focus(); }, []);

  useEffect(() => {
    if (!isRewardedAdsConfigured()) { setState("error"); return; }
    let active = true;
    let pubads: GPTPubAds | null = null;

    const onReady = (event: GPTRewardedEvent) => {
      if (!active || !event.makeRewardedVisible) return;
      setState("watching");
      event.makeRewardedVisible();
    };
    const onGranted = () => {
      if (!active || grantedRef.current) return;
      grantedRef.current = true;
      setState("granted");
      onRewarded();
    };
    const onClosed = () => { if (active) onClose(); };

    ensureGpt().then(() => {
      if (!active) return;
      window.googletag.cmd.push(() => {
        if (!active) return;
        const slot = window.googletag.defineOutOfPageSlot(AD_UNIT_PATH, window.googletag.enums.OutOfPageFormat.REWARDED);
        if (!slot) { setState("error"); return; }
        slotRef.current = slot;
        pubads = window.googletag.pubads();
        slot.addService(pubads);
        pubads.addEventListener("rewardedSlotReady", onReady);
        pubads.addEventListener("rewardedSlotGranted", onGranted);
        pubads.addEventListener("rewardedSlotClosed", onClosed);
        window.googletag.enableServices();
        window.googletag.display(slot);
      });
    }).catch(() => active && setState("error"));

    return () => {
      active = false;
      if (!window.googletag) return;
      window.googletag.cmd.push(() => {
        pubads?.removeEventListener("rewardedSlotReady", onReady);
        pubads?.removeEventListener("rewardedSlotGranted", onGranted);
        pubads?.removeEventListener("rewardedSlotClosed", onClosed);
        if (slotRef.current) window.googletag.destroySlots([slotRef.current]);
      });
    };
  }, [onClose, onRewarded]);

  return (
    <div role="dialog" aria-modal="true" aria-label={t("dash.watchAd")} tabIndex={-1} ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
        <Coins className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
        {state === "loading" && <><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" /><p role="status" className="text-sm text-muted-foreground">{t("dash.adLoading")}</p></>}
        {state === "watching" && <p role="status" className="text-sm font-medium">{t("dash.adWatching")}</p>}
        {state === "granted" && <p role="status" className="font-bold text-amber-500">{t("dash.adWatched").replace("{pts}", "5")}</p>}
        {state === "error" && <p role="alert" className="text-sm text-destructive">The advertisement is not available right now.</p>}
        {(state === "granted" || state === "error") && <button type="button" onClick={onClose} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">{t("vx.close")}</button>}
      </div>
    </div>
  );
}
