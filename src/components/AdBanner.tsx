import { useEffect, useRef } from "react";
import { useAdEligibility } from "@/features/ads/useAdEligibility";

const AD_CLIENT = "ca-pub-6897088904832302";

// Inject adsbygoogle.js once, the first time any banner mounts
let adsenseScriptInjected = false;
function ensureAdsense() {
  if (adsenseScriptInjected || typeof document === "undefined") return;
  adsenseScriptInjected = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

interface Props {
  slot: string;
  format?: "auto" | "horizontal" | "rectangle" | "vertical";
  className?: string;
}

/**
 * Reusable AdSense display banner.
 * Usage: <AdBanner slot="XXXXXXXXXX" format="horizontal" />
 *
 * Loads nothing, and renders nothing, until the visitor has accepted advertising
 * cookies and the route is ad-eligible (same gate as AdSenseSlot). Before this
 * check the script and its third-party cookie loaded on first paint.
 */
export function AdBanner({ slot, format = "auto", className = "" }: Props) {
  const pushedSlot = useRef<string | null>(null);
  const { advertisingConsent, routeEligible } = useAdEligibility();
  const allowed = advertisingConsent && routeEligible;

  useEffect(() => {
    if (!allowed) return;
    ensureAdsense();
    if (pushedSlot.current === slot) return;
    pushedSlot.current = slot;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch { /* already initialised */ }
  }, [slot, allowed]);

  if (!allowed) return null;

  return (
    <div
      className={`overflow-hidden rounded-lg ${className}`}
      aria-hidden="true"          // decorative — screen readers skip it
      role="presentation"
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
