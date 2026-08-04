import { useEffect, useRef, useState } from "react";
import { adsConfig, isAdSenseConfigured } from "./config";
import { useAdEligibility } from "./useAdEligibility";

let scriptPromise: Promise<void> | null = null;

function loadAdSense() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-visionex-adsense="true"]');
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("AdSense failed to load")), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.visionexAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsConfig.adsenseClient)}`;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => { scriptPromise = null; reject(new Error("AdSense failed to load")); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function AdSenseSlot({ className = "" }: { className?: string }) {
  const { advertisingConsent, routeEligible, pathname } = useAdEligibility();
  const pushedForPath = useRef("");
  const [failed, setFailed] = useState(false);
  const configured = isAdSenseConfigured();

  useEffect(() => {
    if (!configured || !advertisingConsent || !routeEligible || pushedForPath.current === pathname) return;
    let active = true;
    loadAdSense()
      .then(() => {
        if (!active) return;
        try {
          window.adsbygoogle = window.adsbygoogle || [];
          window.adsbygoogle.push({});
          pushedForPath.current = pathname;
        } catch {
          setFailed(true);
        }
      })
      .catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [advertisingConsent, configured, pathname, routeEligible]);

  if (!configured || !advertisingConsent || !routeEligible || failed) return null;

  return (
    <aside aria-label="Advertisement" className={`section-container py-4 ${className}`}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground">Advertisement</p>
      <ins
        className="adsbygoogle block min-h-[100px] overflow-hidden rounded-lg"
        style={{ display: "block" }}
        data-ad-client={adsConfig.adsenseClient}
        data-ad-slot={adsConfig.adsenseResponsiveSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

